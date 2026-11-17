// Package web compiles an Upskale Studio project to a website: a Vite +
// React project, routed by TanStack Router, its server reads cached by
// TanStack Query, that builds to static files.
//
// It is the web counterpart of the dart package (the Flutter app): the same
// Flux sources, analysed the same way (cdsl), drawn by a React runtime
// (runtime/, embedded) that follows the Flutter runtime's layout and the
// Studio preview's look, and talking to the tenant API the same way
// package:upskale_storefront does. Everything here is pure: no database,
// network or environment.
package web

import (
	"embed"
	"encoding/json"
	"regexp"
	"sort"
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/config"
	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/pagedata"
	"github.com/iamsinyagepr/flux/registry"
)

// Version is the web compiler's version.
const Version = "0.1.0"

// Dir is the folder of the packed source the website's project is in, next
// to the Flutter project: the build workflow builds it when it's there.
const Dir = "web-app"

// The runtime's own files: its server and TypeScript settings as they are;
// its code and styles as modules (modules.go), a site getting what it uses.
//
//go:embed runtime/server.mjs runtime/tsconfig.json
var runtimeFiles embed.FS

// Input is what the web compiler reads.
type Input struct {
	Name             string
	Description      string
	Pages            []dart.Page
	EntryPageID      string
	ComponentSources *js.Object[string]
	Config           *js.JSON
	// APIURL is the tenant API; StoreID pins a single-store site to its store.
	APIURL  string
	StoreID string
	// Site is the business's website settings (repository.WebMeta, as JSON):
	// its head, canonical address and structured data.
	Site json.RawMessage

	// Marks wraps each widget in an element saying where it's written,
	// <span data-flx="<document>:<from>:<to>" style="display: contents">,
	// for flux dev's editor. Never in a build that ships.
	Marks bool
	// OverlayURL is flux dev's editor script, added to every page. Empty: none.
	OverlayURL string
}

// File is one file of the generated project, by its path inside it.
type File struct {
	Path    string
	Content string
}

// Result is a compilation. Warnings are what compiles but doesn't work on
// the web yet (a storefront control it doesn't draw): a build can choose
// the Flutter website instead.
type Result struct {
	Version     string
	Success     bool
	Files       []File
	Diagnostics []dart.Diagnostic
}

var (
	componentName = regexp.MustCompile(`^[A-Z][A-Za-z0-9]{0,59}$`)
	wordSplit     = regexp.MustCompile(`[^a-zA-Z0-9]`)
	unsafeFile    = regexp.MustCompile(`[^a-z0-9-]`)
)

// Compile turns a project with pages into a website's project. A project
// without pages (a single component) has nothing to route and isn't built.
func Compile(in Input) Result {
	result := Result{Version: Version}
	problem := func(code, message string) Result {
		result.Diagnostics = append(result.Diagnostics, dart.Diagnostic{Code: code, Severity: "error", Message: message})
		return result
	}
	if len(in.Pages) == 0 {
		return problem("WEB_PROJECT", "A website needs at least one page.")
	}
	if !config.Valid(in.Config) {
		return problem("WEB_CONFIG", "Project theme configuration is invalid.")
	}
	keys := in.ComponentSources.Keys()
	for _, name := range keys {
		if !componentName.MatchString(name) {
			return problem("WEB_PROJECT", "Component names must start with a capital letter and contain only letters and numbers (up to 60 characters).")
		}
	}
	customTokens := func(family string) []string { return config.FamilyCustomTokens(in.Config, family) }
	var sources []cdsl.Source
	for _, name := range keys {
		source, _ := in.ComponentSources.Get(name)
		sources = append(sources, cdsl.Source{Name: name, Source: source})
	}
	analyses, entries := cdsl.AnalyzeComponents(sources, customTokens)

	var definitions []*definition
	components := map[string]*definition{}
	sorted := append([]string{}, keys...)
	sort.Strings(sorted)
	for _, name := range sorted {
		d := &definition{documentID: "component:" + name, name: "StudioComponent" + name,
			file: "src/components/" + name + ".tsx", analysis: analyses[name]}
		definitions = append(definitions, d)
		components[name] = d
	}
	pages := map[string]*definition{}
	files := map[string]bool{}
	for index, page := range in.Pages {
		var class strings.Builder
		for _, word := range wordSplit.Split(page.ID, -1) {
			if word != "" {
				class.WriteString(strings.ToUpper(word[:1]) + word[1:])
			}
		}
		file := unsafeFile.ReplaceAllString(strings.ToLower(page.ID), "-")
		if file == "" || files[file] {
			file += "-" + js.NumberString(float64(index+1))
		}
		files[file] = true
		analysis := cdsl.AnalyzeSource(page.Source, cdsl.Context{Components: entries, CustomTokens: customTokens,
			Data: pagedata.ImportScope(page.Data)})
		d := &definition{documentID: page.ID, name: "StudioPage" + js.NumberString(float64(index+1)) + class.String(),
			file: "src/pages/" + file + ".tsx", analysis: analysis}
		definitions = append(definitions, d)
		pages[page.ID] = d
	}
	entry := in.Pages[0]
	for _, page := range in.Pages {
		if page.ID == in.EntryPageID {
			entry = page
		}
	}
	// The site's root address shows the start page: the page that had "/"
	// moves to its own, and the start page answers at "/" as well as at its
	// own path (one with $params can't be the root: it keeps its path).
	in.Pages, entry = rootedPages(in.Pages, entry)

	failed := map[*definition]bool{}
	for _, d := range definitions {
		for _, issue := range d.analysis.Diagnostics {
			if issue.Severity == "error" {
				failed[d] = true
				result.Diagnostics = append(result.Diagnostics, dart.Diagnostic{DocumentID: d.documentID, Code: issue.Code,
					Severity: "error", Message: issue.Message, From: issue.From, To: issue.To})
			}
		}
	}
	sourceFiles := map[string]string{}
	dependencies := map[*definition][]*definition{}
	for _, d := range definitions {
		if failed[d] {
			continue
		}
		e := newEmitter(&in, d, components)
		source, failure := e.tryEmit()
		if failure != nil {
			failed[d] = true
			result.Diagnostics = append(result.Diagnostics, dart.Diagnostic{DocumentID: d.documentID, Code: "WEB_UNSUPPORTED",
				Severity: "error", Message: failure.message, From: failure.node.From, To: failure.node.To})
			continue
		}
		for _, w := range e.warnings {
			result.Diagnostics = append(result.Diagnostics, dart.Diagnostic{DocumentID: d.documentID, Code: "WEB_INTEGRATION",
				Severity: "warning", Message: w.message, From: w.node.From, To: w.node.To})
		}
		sourceFiles[d.file] = source
		dependencies[d] = e.deps
	}
	// A document is only as good as what it places.
	for changed := true; changed; {
		changed = false
		for _, d := range definitions {
			if failed[d] {
				continue
			}
			for _, dep := range dependencies[d] {
				if failed[dep] {
					failed[d], changed = true, true
					result.Diagnostics = append(result.Diagnostics, dart.Diagnostic{DocumentID: d.documentID, Code: "WEB_DEPENDENCY",
						Severity: "error", Message: "Fix " + dep.documentID + " before this file can be compiled."})
					break
				}
			}
		}
	}
	// Each page's route: its data, its SEO and its component.
	routes := map[string]string{}
	for _, page := range in.Pages {
		d := pages[page.ID]
		if failed[d] {
			continue
		}
		padded := true
		for _, variant := range d.analysis.Variants {
			if scaffolded(variant.Arg("build"), components, map[string]bool{}) {
				padded = false
			}
		}
		e := newEmitter(&in, d, components)
		source, failure := e.tryRoute(page, padded)
		if failure != nil {
			result.Diagnostics = append(result.Diagnostics, dart.Diagnostic{DocumentID: d.documentID, Code: "WEB_DATA",
				Severity: "error", Message: failure.message})
			continue
		}
		routes[page.ID] = source
		if page.ID == entry.ID && entry.Path != "/" && !strings.Contains(entry.Path, "$") {
			// The start page at the site's root too: its own route, at "/".
			root := page
			root.Path = "/"
			home, _ := newEmitter(&in, d, components).tryRoute(root, padded)
			routes[homeRouteFile] = home
		}
	}
	result.Success = true
	for _, issue := range result.Diagnostics {
		if issue.Severity == "error" {
			result.Success = false
		}
	}
	if !result.Success {
		return result
	}

	out := []File{}
	add := func(path, content string) { out = append(out, File{Path: path, Content: content}) }
	for _, name := range []string{"server.mjs", "tsconfig.json"} {
		content, err := runtimeFiles.ReadFile("runtime/" + name)
		if err != nil {
			panic(err) // the embedded runtime is part of this binary
		}
		add(name, string(content))
	}
	for _, d := range definitions {
		add(d.file, sourceFiles[d.file])
	}
	name := in.Name
	if strings.TrimSpace(name) == "" {
		name = "Storefront"
	}
	add("package.json", packageJSON(name, nil))
	data, secrets := siteData(in.Pages)
	add("vite.config.ts", viteConfig(in.Pages, entry, secrets))
	add("public/manifest.json", manifest(name, in.Config, hasIcon(in.Site)))
	robots, sitemap := robotsAndSitemap(in)
	add("public/robots.txt", robots)
	if sitemap != "" {
		add("public/sitemap.xml", sitemap)
	}
	// ToggleDarkMode switches the site between its light and dark palettes.
	toggles := false
	for _, source := range sourceFiles {
		toggles = toggles || strings.Contains(source, `"ToggleDarkMode"`)
	}
	for _, source := range routes {
		toggles = toggles || strings.Contains(source, `"ToggleDarkMode"`)
	}
	add("src/theme.css", themeCSS(in.Config, toggles))
	add("src/site.json", siteJSON(in, name))
	add("src/router.tsx", routerTSX(in, entry))
	root := rootTSX
	if in.OverlayURL != "" {
		// flux dev's editor, after the site's own scripts.
		root = strings.Replace(root, "        <Scripts />\n", "        <Scripts />\n        <script type=\"module\" src={"+q(in.OverlayURL)+"} />\n", 1)
	}
	add("src/routes/__root.tsx", root)
	// The pages' data, fetched on the server: only for a site that has any;
	// /studio-data only for one with data the apps can't fetch themselves.
	if data {
		add("src/data.ts", dataTS)
		add("src/data.server.ts", dataServerTS(in, pageFields(in.Pages, pages, components)))
	}
	if secrets {
		add("src/routes/studio-data.ts", studioDataRoute)
	}
	for _, page := range in.Pages {
		add("src/routes/"+routeFile(page), routes[page.ID])
		if queries := pageQueries(page); queries != "" {
			add("src/queries/"+queriesFile(page)+".ts", queries)
		}
	}
	if entry.Path != "/" && !strings.Contains(entry.Path, "$") {
		// The start page at "/" too: its route, at the root.
		add("src/routes/"+homeRouteFile, routes[homeRouteFile])
	}
	// Only the runtime those files use.
	out = append(out, runtimeFor(out)...)
	// The Library's packages, for what the site draws of it.
	if extra := libraryDependencies(out); len(extra) > 0 {
		for i := range out {
			if out[i].Path == "package.json" {
				out[i].Content = packageJSON(name, extra)
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Path < out[j].Path })
	result.Files = out
	return result
}

// Integrations reports whether a compilation has anything the web draws as a
// placeholder (said as a WEB_INTEGRATION warning; it's still built).
func (r Result) Integrations() bool {
	for _, issue := range r.Diagnostics {
		if issue.Code == "WEB_INTEGRATION" {
			return true
		}
	}
	return false
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func htmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;").Replace(s)
}

// hasIcon is whether the business's icon comes with the build (public/icons).
func hasIcon(site json.RawMessage) bool {
	var meta struct {
		HasIcon bool `json:"has_icon"`
	}
	_ = json.Unmarshal(site, &meta)
	return meta.HasIcon
}

func manifest(name string, cfg *js.JSON, icons bool) string {
	value := map[string]any{
		"name": name, "short_name": name, "start_url": "/", "display": "standalone",
		"background_color": palette(cfg, false)["background"], "theme_color": palette(cfg, false)["primary"],
		"icons": []map[string]string{},
	}
	if icons {
		value["icons"] = []map[string]string{
			{"src": "/icons/Icon-192.png", "sizes": "192x192", "type": "image/png"},
			{"src": "/icons/Icon-512.png", "sizes": "512x512", "type": "image/png"},
			{"src": "/icons/Icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
			{"src": "/icons/Icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
		}
	}
	raw, _ := json.MarshalIndent(value, "", "  ")
	return string(raw) + "\n"
}

// The Studio preview's palettes (the Flutter runtime's studioDefaultColors
// and studioDarkDefaultColors), under the project's own colours.
var (
	lightDefaults = [][2]string{
		{"primary", "#00d2a6"}, {"primaryInk", "#0f1115"}, {"background", "#f8f9fa"}, {"surface", "#ffffff"},
		{"surfaceAlt", "#f8f9fa"}, {"text", "#2b2d31"}, {"textMuted", "#5c6068"}, {"border", "#e2e8f0"},
		{"success", "#00d2a6"}, {"danger", "#e5484d"}, {"warning", "#e8a33d"},
	}
	darkDefaults = [][2]string{
		{"primary", "#00d2a6"}, {"primaryInk", "#0f1115"}, {"background", "#0f1115"}, {"surface", "#171a21"},
		{"surfaceAlt", "#0f1115"}, {"text", "#e9ebef"}, {"textMuted", "#9ba1ac"}, {"border", "#262b35"},
		{"success", "#00d2a6"}, {"danger", "#ff6b70"}, {"warning", "#f5b95c"},
	}
)

// palette is a theme's colours by name: the defaults, then the project's.
func palette(cfg *js.JSON, dark bool) map[string]string {
	out := map[string]string{}
	defaults := lightDefaults
	if dark {
		defaults = darkDefaults
	}
	for _, pair := range defaults {
		out[pair[0]] = pair[1]
	}
	if colors := cfg.Field("colors"); colors.IsObject() {
		for _, name := range colors.Object.Keys() {
			if value := colors.Field(name); config.ValidHexColor(value) && (!dark || !config.BuiltIn("colors", name)) {
				out[name] = value.String
			}
		}
	}
	if dark {
		overrides := config.DarkPalette(cfg)
		for _, name := range overrides.Keys() {
			if value, _ := overrides.Get(name); config.ValidHexColor(value) {
				out[name] = value.String
			}
		}
	}
	return out
}

func cssVars(colors map[string]string, indent string) string {
	names := make([]string, 0, len(colors))
	for name := range colors {
		names = append(names, name)
	}
	sort.Strings(names)
	var b strings.Builder
	for _, name := range names {
		b.WriteString(indent + "--studio-" + name + ": " + colors[name] + ";\n")
	}
	return b.String()
}

func themeCSS(cfg *js.JSON, toggles bool) string {
	size := func(group, key string, fallback float64) string {
		if v := cfg.Field(group).Field(key); v != nil && v.Kind == js.JSONNumber && v.Number > 0 {
			return js.NumberString(v.Number)
		}
		if v, ok := registry.SizeDefault(group, key); ok && v > 0 {
			return js.NumberString(v)
		}
		return js.NumberString(fallback)
	}
	buttonRadius := "6"
	if radius := cfg.Field("radii").Field("md"); radius != nil && radius.Kind == js.JSONNumber && radius.Number >= 0 {
		buttonRadius = js.NumberString(radius.Number)
	}
	buttonFont := "14"
	if v := cfg.Field("fontSizes").Field("md"); v != nil && v.Kind == js.JSONNumber && v.Number > 0 {
		buttonFont = js.NumberString(v.Number)
	}
	light := cssVars(palette(cfg, false), "  ")
	sizes := "  --studio-font-size: " + size("fontSizes", "md", 16) + "px;\n" +
		"  --studio-button-radius: " + buttonRadius + "px;\n" +
		"  --studio-button-font-size: " + buttonFont + "px;\n" +
		"  --studio-icon-size: " + size("iconSizes", "md", 22) + "px;\n"
	css := "/* Generated by Upskale Studio: this project's theme. */\n:root {\n  color-scheme: light;\n" + light + sizes + "}\n"
	switch config.ThemeMode(cfg) {
	case "dark":
		css += ":root {\n  color-scheme: dark;\n" + cssVars(palette(cfg, true), "  ") + "}\n"
	case "system":
		css += "@media (prefers-color-scheme: dark) {\n  :root {\n    color-scheme: dark;\n" + cssVars(palette(cfg, true), "    ") + "  }\n}\n"
	}
	if notice := cfg.Field("notice"); notice != nil && notice.IsObject() {
		// The messages actions show (Config's notice): colours from the palette.
		css += "/* The messages actions show. */\n.studio-notice {\n"
		if v := notice.Field("background"); v != nil {
			css += "  background: var(--studio-" + v.String + ");\n"
		}
		if v := notice.Field("color"); v != nil {
			css += "  color: var(--studio-" + v.String + ");\n"
		}
		css += "}\n"
		if v := notice.Field("position"); v != nil && v.String == "top" {
			css += ".studio-notices {\n  top: calc(24px + env(safe-area-inset-top));\n  bottom: auto;\n}\n"
		}
		if v := notice.Field("seconds"); v != nil && v.Kind == js.JSONNumber {
			css += ":root {\n  --studio-notice-ms: " + js.NumberString(v.Number*1000) + ";\n}\n"
		}
	}
	if toggles {
		// The mode ToggleDarkMode switched to, over Config's (data-theme on <html>).
		css += ":root[data-theme=\"light\"] {\n  color-scheme: light;\n" + light + "}\n" +
			":root[data-theme=\"dark\"] {\n  color-scheme: dark;\n" + cssVars(palette(cfg, true), "  ") + "}\n"
	}
	return css
}

// scaffolded is whether a page draws its own Scaffold (directly, or as the
// component it places): the others get the preview's 16px padding.
func scaffolded(node *cdsl.Expr, components map[string]*definition, seen map[string]bool) bool {
	if node == nil || node.Kind != cdsl.Call {
		return false
	}
	if node.Name == "Scaffold" {
		return true
	}
	if d := components[node.Name]; d != nil && !seen[node.Name] {
		seen[node.Name] = true
		for _, variant := range d.analysis.Variants {
			if scaffolded(variant.Arg("build"), components, seen) {
				return true
			}
		}
	}
	return false
}
