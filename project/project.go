// Package project reads a Flux project from disk: flux.json and its .flx
// sources, laid out as
//
//	flux.json
//	pages/<id>.flx           an app's pages: the file name is the page's id
//	components/<Name>.flx    the project's own components
//	shell.flx                an app's shared shell (optional)
//	main.flx                 a single-component project's one source
//
// and turns it into the Project the compilers take: the same JSON Upskale
// Studio stores, so a project on disk builds exactly as it does there.
package project

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/iamsinyagepr/flux"
	"github.com/iamsinyagepr/flux/pagedata"
)

// ConfigFile is the project's settings file.
const ConfigFile = "flux.json"

// Ext is a Flux source's extension.
const Ext = ".flx"

// Config is flux.json.
type Config struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	// Entry is the page the app opens on (a page id). Empty: "home" if there
	// is one, else the first page.
	Entry string `json:"entry,omitempty"`
	// Theme is the design tokens and settings (colours, fonts, sizes, icon
	// library, page transition): Studio's Config.
	Theme json.RawMessage `json:"theme,omitempty"`
	// Transitions are pages' own transitions, by page id ("cart": "slideUp").
	Transitions map[string]string `json:"transitions,omitempty"`
	// Site is the website's settings: its address, head and structured data.
	Site json.RawMessage `json:"site,omitempty"`
	// Providers are the data sources beyond Http(...) the project uses.
	Providers Providers `json:"providers,omitempty"`
}

// Providers are the data sources a project turns on.
type Providers struct {
	// Upskale is an Upskale business's API: Tenant.… and Client.… data, and
	// the storefront components.
	Upskale *Upskale `json:"upskale,omitempty"`
}

// Upskale is the upskale provider's settings.
type Upskale struct {
	// API is the business's API address. Empty runs on sample data.
	API string `json:"api,omitempty"`
	// Store pins the app to one store (id or slug). Empty is a store picker.
	Store string `json:"store,omitempty"`
}

// API is the provider's API address, or "" (sample data).
func (c Config) API() string {
	if c.Providers.Upskale == nil {
		return ""
	}
	return c.Providers.Upskale.API
}

// Store is the pinned store, or "".
func (c Config) Store() string {
	if c.Providers.Upskale == nil {
		return ""
	}
	return c.Providers.Upskale.Store
}

// File is one source as it is on disk.
type File struct {
	// Path is relative to the project ("pages/home.flx"), with forward slashes.
	Path string
	// DocumentID is how the compilers name it: a page's id,
	// "component:<Name>", "shared-shell", or "" for main.flx.
	DocumentID string
	Source     string
}

// Loaded is a project read from disk.
type Loaded struct {
	Dir     string
	Config  Config
	Project flux.Project
	Files   []File
	// Problems are each page's route, data and SEO problems, by document.
	Problems map[string][]pagedata.Problem
}

// FileFor is the source a document ID names.
func (l *Loaded) FileFor(documentID string) *File {
	for i := range l.Files {
		if l.Files[i].DocumentID == documentID {
			return &l.Files[i]
		}
	}
	return nil
}

var (
	pageID        = regexp.MustCompile(`^[a-z][a-z0-9-]{0,59}$`)
	componentName = regexp.MustCompile(`^[A-Z][A-Za-z0-9]{0,59}$`)
)

// Find walks up from dir to the nearest directory with a flux.json.
func Find(dir string) (string, error) {
	dir, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, ConfigFile)); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", errors.New("no " + ConfigFile + " here or in any folder above (flux new <name> starts a project)")
		}
		dir = parent
	}
}

// Overlay is sources an editor has open, by absolute path: read instead of
// what's on disk, which they may not have been saved to yet.
type Overlay map[string]string

func (o Overlay) read(path string) (string, error) {
	if abs, err := filepath.Abs(path); err == nil {
		if source, ok := o[abs]; ok {
			return strings.ReplaceAll(source, "\r\n", "\n"), nil
		}
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	// Positions are counted in the source as written; Windows line endings
	// would shift every one after them.
	return strings.ReplaceAll(string(raw), "\r\n", "\n"), nil
}

func sources(dir, sub string) ([]string, error) {
	entries, err := os.ReadDir(filepath.Join(dir, sub))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), Ext) {
			names = append(names, strings.TrimSuffix(e.Name(), Ext))
		}
	}
	sort.Strings(names)
	return names, nil
}

// Load reads the project in dir.
func Load(dir string) (*Loaded, error) { return LoadWith(dir, nil) }

// LoadWith reads the project in dir, the overlay's sources in place of
// those files on disk.
func LoadWith(dir string, overlay Overlay) (*Loaded, error) {
	read := overlay.read
	raw, err := os.ReadFile(filepath.Join(dir, ConfigFile))
	if err != nil {
		return nil, err
	}
	var config Config
	if err := json.Unmarshal(raw, &config); err != nil {
		return nil, fmt.Errorf("%s: %w", ConfigFile, err)
	}
	if config.Name == "" {
		config.Name = filepath.Base(dir)
	}
	loaded := &Loaded{Dir: dir, Config: config, Problems: map[string][]pagedata.Problem{}}

	type page struct {
		ID         string            `json:"id"`
		Name       string            `json:"name"`
		Path       string            `json:"path"`
		Source     string            `json:"source"`
		Transition string            `json:"transition,omitempty"`
		Data       []pagedata.Import `json:"data,omitempty"`
		SEO        *pagedata.SEO     `json:"seo,omitempty"`
	}
	stored := map[string]any{
		"name":        config.Name,
		"description": config.Description,
		"source":      "",
		"shellSource": "",
	}
	if len(config.Theme) > 0 {
		theme, err := withDefaults(config.Theme)
		if err != nil {
			return nil, fmt.Errorf("%s: theme: %w", ConfigFile, err)
		}
		stored["config"] = theme
	}
	if store := config.Store(); store != "" {
		stored["storeId"] = store
	}
	var site struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(config.Site, &site)
	if site.URL != "" {
		stored["siteUrl"] = site.URL
	}

	pageIDs, err := sources(dir, "pages")
	if err != nil {
		return nil, err
	}
	var pages []page
	for _, id := range pageIDs {
		if !pageID.MatchString(id) || id == "shared-shell" {
			return nil, fmt.Errorf("pages/%s%s: a page's file name is its id: lowercase letters, digits and dashes, starting with a letter", id, Ext)
		}
		source, err := read(filepath.Join(dir, "pages", id+Ext))
		if err != nil {
			return nil, err
		}
		fields := pagedata.FromSource(source)
		p := page{ID: id, Name: fields.Name, Path: fields.Path, Source: source, Data: fields.Data, SEO: fields.SEO, Transition: config.Transitions[id]}
		if p.Name == "" {
			p.Name = id
		}
		if p.Path == "" {
			p.Path = "/" + id
			if id == "home" {
				p.Path = "/"
			}
		}
		pages = append(pages, p)
		loaded.Files = append(loaded.Files, File{Path: "pages/" + id + Ext, DocumentID: id, Source: source})
		if len(fields.Problems) > 0 {
			loaded.Problems[id] = fields.Problems
		}
	}

	components := map[string]string{}
	names, err := sources(dir, "components")
	if err != nil {
		return nil, err
	}
	for _, name := range names {
		if !componentName.MatchString(name) {
			return nil, fmt.Errorf("components/%s%s: a component's file name is its name: a capital letter, then letters and digits", name, Ext)
		}
		source, err := read(filepath.Join(dir, "components", name+Ext))
		if err != nil {
			return nil, err
		}
		components[name] = source
		loaded.Files = append(loaded.Files, File{Path: "components/" + name + Ext, DocumentID: "component:" + name, Source: source})
	}
	if len(components) > 0 {
		stored["componentSources"] = components
	}

	if source, err := read(filepath.Join(dir, "shell"+Ext)); err == nil {
		stored["shellSource"] = source
		loaded.Files = append(loaded.Files, File{Path: "shell" + Ext, DocumentID: "shared-shell", Source: source})
	}
	main, mainErr := read(filepath.Join(dir, "main"+Ext))
	switch {
	case len(pages) > 0:
		if mainErr == nil {
			return nil, errors.New("main" + Ext + " is a single-component project's source; this project has pages/: move it into pages/ or components/")
		}
		stored["pages"] = pages
		entry := config.Entry
		if entry == "" {
			entry = pages[0].ID
			for _, p := range pages {
				if p.ID == "home" {
					entry = "home"
				}
			}
		}
		stored["entryPageId"] = entry
	case mainErr == nil:
		stored["source"] = main
		loaded.Files = append(loaded.Files, File{Path: "main" + Ext, DocumentID: "", Source: main})
	default:
		return nil, errors.New("nothing to build: add pages/<id>" + Ext + " (an app or a website) or main" + Ext + " (one component)")
	}

	raw, err = json.Marshal(stored)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(raw, &loaded.Project); err != nil {
		return nil, err
	}
	return loaded, nil
}

// defaultTheme is Studio's defaultStudioConfig (projectConfig.ts).
const defaultTheme = `{"colors":{},"spacing":{},"radii":{},"fontSizes":{},"iconSizes":{},"iconLibrary":"material"}`

// withDefaults is a theme with what it leaves out taken from Studio's
// defaults, so flux.json says only what it changes. Token groups (colors,
// spacing…) merge key by key.
func withDefaults(theme json.RawMessage) (map[string]any, error) {
	var base, given map[string]any
	if err := json.Unmarshal([]byte(defaultTheme), &base); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(theme, &given); err != nil {
		return nil, errors.New("is an object of settings")
	}
	for key, value := range given {
		into, isGroup := base[key].(map[string]any)
		group, givenGroup := value.(map[string]any)
		if isGroup && givenGroup {
			for name, v := range group {
				into[name] = v
			}
			continue
		}
		base[key] = value
	}
	return base, nil
}

// Position is a 1-based line and column (in characters) of a UTF-16 offset.
func Position(source string, offset int) (line, column int) {
	line, column = 1, 1
	units := 0
	for _, r := range source {
		if units >= offset {
			break
		}
		if r == '\n' {
			line, column = line+1, 1
		} else {
			column++
		}
		if r >= 0x10000 {
			units += 2
		} else {
			units++
		}
	}
	return line, column
}

// Offset is the UTF-16 offset of a 0-based line and UTF-16 character (LSP positions).
func Offset(source string, line, character int) int {
	units, l, c := 0, 0, 0
	for _, r := range source {
		if l == line && c >= character {
			return units
		}
		w := 1
		if r >= 0x10000 {
			w = 2
		}
		if r == '\n' {
			if l == line {
				return units
			}
			l, c = l+1, 0
		} else if l == line {
			c += w
		}
		units += w
	}
	return units
}
