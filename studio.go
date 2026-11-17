// Package flux compiles an Upskale Studio project to a Flutter project.
//
// It is a port of upskaleapp's in-browser compiler (dartCompiler.ts,
// dartFormat.ts, flutterProject.ts and the parts of the language service
// they use), checked against golden cases exported from the TypeScript by
// `node scripts/export-studio-compiler.mjs`. Everything here is pure: no
// database, network or environment.
package flux

import (
	"encoding/json"
	"path"
	"regexp"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/config"
	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/flutter"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/pagedata"
	"github.com/iamsinyagepr/flux/web"
)

// Project is a Studio project as the editor stores it.
type Project struct {
	Name             string             `json:"name"`
	Description      string             `json:"description"`
	Source           string             `json:"source"`
	Pages            []dart.Page        `json:"pages"`
	ShellSource      string             `json:"shellSource"`
	EntryPageID      string             `json:"entryPageId"`
	ComponentSources *js.Object[string] `json:"componentSources"`
	Config           *js.JSON           `json:"config"`
	// Language is "dart" for a project converted to Dart, for good: its
	// DartProject (path → file) is built as it is. See dartmode.go.
	Language    string             `json:"language,omitempty"`
	DartProject *js.Object[string] `json:"dartProject,omitempty"`
	// StoreID makes a single-store app: it opens on this store (id or slug),
	// whose menu loads at start-up. Empty for a store picker.
	StoreID string `json:"storeId,omitempty"`
	// SiteURL is the business's website, where an app fetches the page
	// imports sent with a secret (the website's server holds the key).
	SiteURL string `json:"siteUrl,omitempty"`
}

// File is one file of the generated project.
type File struct {
	// Name is the path inside the project ("lib/main.dart").
	Name string `json:"name"`
	// Type is what the file holds: dart, yaml, markdown or text.
	Type    string `json:"type"`
	Content string `json:"content"`
}

// Result is a compilation: every file that could be generated, and why the
// rest could not. Compile errors are a result, not a failure.
type Result struct {
	Version     string            `json:"version"`
	Success     bool              `json:"success"`
	Files       []File            `json:"files"`
	Diagnostics []dart.Diagnostic `json:"diagnostics"`
	Documents   []Document        `json:"documents"`
	EntryClass  *string           `json:"entryClass"`
	// ArchiveName is the folder the files unzip into, and the zip's name.
	ArchiveName string `json:"archiveName"`
}

// Document maps a source document to its generated class and file.
type Document struct {
	DocumentID string `json:"documentId"`
	ClassName  string `json:"className"`
	Name       string `json:"name"`
}

// Compile turns a project into its Flutter files. apiURL is the tenant API
// the app talks to; empty generates an app that runs on sample data.
func Compile(project Project, apiURL string) Result {
	if project.Language == LanguageDart {
		return compileDart(project, apiURL)
	}
	compilation := dart.Compile(dart.Project{
		Source:           project.Source,
		Pages:            project.Pages,
		ShellSource:      project.ShellSource,
		EntryPageID:      project.EntryPageID,
		ComponentSources: project.ComponentSources,
		Config:           project.Config,
	})
	files := flutter.Files(compilation, flutter.Input{
		Name:        project.Name,
		Description: project.Description,
		Pages:       project.Pages,
		EntryPageID: project.EntryPageID,
		Config:      project.Config,
		APIURL:      apiURL,
		StoreID:     project.StoreID,
		SiteURL:     project.SiteURL,
	})
	result := Result{
		Version:     compilation.Version,
		Success:     compilation.Success,
		Diagnostics: compilation.Diagnostics,
		ArchiveName: flutter.PackageName(project.Name),
	}
	if result.Diagnostics == nil {
		result.Diagnostics = []dart.Diagnostic{}
	}
	if compilation.EntryClass != "" {
		entry := compilation.EntryClass
		result.EntryClass = &entry
	}
	result.Documents = make([]Document, len(compilation.Documents))
	for i, d := range compilation.Documents {
		result.Documents[i] = Document{d.DocumentID, d.ClassName, d.Path}
	}
	result.Files = make([]File, len(files))
	for i, f := range files {
		result.Files[i] = File{Name: f.Path, Type: fileType(f.Path), Content: f.Source}
	}
	return result
}

// CompileWeb turns a project's pages into a website: a Vite + React project
// routed by TanStack Router (package web), the web counterpart of Compile.
// A project converted to Dart has no Flux to compile, and a project without
// pages nothing to route: ok is false for both, and its website is Flutter's.
//
// site is the business's website settings (its SEO, its address), as JSON.
func CompileWeb(project Project, apiURL string, site json.RawMessage) (result web.Result, ok bool) {
	if project.Language == LanguageDart || len(project.Pages) == 0 {
		return web.Result{}, false
	}
	return web.Compile(web.Input{
		Name:             project.Name,
		Description:      project.Description,
		Pages:            project.Pages,
		EntryPageID:      project.EntryPageID,
		ComponentSources: project.ComponentSources,
		Config:           project.Config,
		APIURL:           apiURL,
		StoreID:          project.StoreID,
		Site:             site,
	}), true
}

func fileType(name string) string {
	switch path.Ext(name) {
	case ".dart":
		return "dart"
	case ".yaml":
		return "yaml"
	case ".md":
		return "markdown"
	}
	return "text"
}

// Limits a project must fit — the same as the editor's validAppFiles.
const (
	MaxPages           = 20
	MaxComponents      = 20
	MaxProjectBytes    = 524288
	MaxPageNameLength  = 60
	MaxPagePathLength  = 200
	MaxNameLength      = 120
	MaxDescriptionSize = 2000
)

var (
	pageID        = regexp.MustCompile(`^[a-z][a-z0-9-]{0,59}$`)
	componentName = regexp.MustCompile(`^[A-Z][A-Za-z0-9]{0,59}$`)
)

// Validate reports the first way a project falls outside the editor's own
// limits (validAppFiles), as a field → message pair, or ok.
func Validate(p Project) (field, message string, ok bool) {
	if js.Len(p.Name) > MaxNameLength {
		return "project.name", "is longer than 120 characters", false
	}
	if js.Len(p.Description) > MaxDescriptionSize {
		return "project.description", "is longer than 2,000 characters", false
	}
	switch p.Language {
	case LanguageDart:
		// Its Dart is its own: only its files' paths and sizes are Studio's to check.
		return validateDartProject(p.DartProject)
	case "", "cdsl":
	default:
		return "project.language", "is cdsl or dart", false
	}
	if js.Bytes(p.Source) > cdsl.MaxSourceBytes {
		return "project.source", "is larger than 64 KB", false
	}
	if !config.Valid(p.Config) {
		return "project.config", "is not a valid Studio theme configuration", false
	}
	componentBytes := 0
	if p.ComponentSources.Len() > MaxComponents {
		return "project.componentSources", "has more than 20 components", false
	}
	for _, name := range p.ComponentSources.Keys() {
		source, _ := p.ComponentSources.Get(name)
		if !componentName.MatchString(name) {
			return "project.componentSources", "has an invalid component name: " + name, false
		}
		if js.Bytes(source) > cdsl.MaxSourceBytes {
			return "project.componentSources", name + " is larger than 64 KB", false
		}
		componentBytes += js.Bytes(source)
	}
	if componentBytes > MaxProjectBytes {
		return "project.componentSources", "is larger than 512 KB in total", false
	}
	if p.Pages == nil {
		return "", "", true
	}
	if len(p.Pages) == 0 || len(p.Pages) > MaxPages {
		return "project.pages", "needs between 1 and 20 pages", false
	}
	ids, paths := map[string]bool{}, map[string]bool{}
	total := js.Bytes(p.ShellSource) + componentBytes
	entry := false
	for _, page := range p.Pages {
		switch {
		case !pageID.MatchString(page.ID) || page.ID == "shared-shell":
			return "project.pages", "has an invalid page id: " + page.ID, false
		case ids[page.ID] || paths[page.Path]:
			return "project.pages", "repeats a page id or path", false
		case js.Len(page.Name) > MaxPageNameLength || len(page.Path) == 0 || page.Path[0] != '/' || js.Len(page.Path) > MaxPagePathLength:
			return "project.pages", "has an invalid page name or path: " + page.ID, false
		case js.Bytes(page.Source) > cdsl.MaxSourceBytes:
			return "project.pages", page.ID + " is larger than 64 KB", false
		case page.Transition != "" && !config.PageTransitions[page.Transition]:
			return "project.pages", "has an invalid page transition: " + page.ID, false
		}
		if problem := pagedata.Validate(page.Data, page.SEO, pagedata.RouteParams(page.Path)); problem != "" {
			return "project.pages", page.ID + " " + problem, false
		}
		ids[page.ID], paths[page.Path] = true, true
		entry = entry || page.ID == p.EntryPageID
		total += js.Bytes(page.Source)
	}
	if !entry {
		return "project.entryPageId", "is not one of the pages", false
	}
	if js.Bytes(p.ShellSource) > cdsl.MaxSourceBytes || total > MaxProjectBytes {
		return "project", "is larger than 512 KB in total", false
	}
	return "", "", true
}
