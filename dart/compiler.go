// Package dart compiles a Studio project's Flux sources to Flutter widgets —
// a port of upskaleapp's dartCompiler.ts, producing the same files, byte for
// byte, and the same diagnostics.
package dart

import (
	_ "embed"
	"regexp"
	"sort"
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/config"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/pagedata"
	"github.com/iamsinyagepr/flux/registry"
)

// Version is the compiler version reported with every compilation.
const Version = "0.2.0"

//go:embed runtime/studio_runtime.dart
var Runtime string

// Diagnostic is a compile finding in one document.
type Diagnostic struct {
	DocumentID string `json:"documentId"`
	Code       string `json:"code"`
	Severity   string `json:"severity"`
	Message    string `json:"message"`
	From       int    `json:"from"`
	To         int    `json:"to"`
}

// File is one generated Dart file.
type File struct {
	Path       string
	Source     string
	DocumentID string
}

// Document maps a source document to its generated class and file.
type Document struct {
	DocumentID string `json:"documentId"`
	ClassName  string `json:"className"`
	Path       string `json:"path"`
}

// Compilation is the compiler's result.
type Compilation struct {
	Version     string
	Success     bool
	Files       []File
	Diagnostics []Diagnostic
	Documents   []Document
	EntryClass  string
}

// Page is one page of an app project.
type Page struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Path   string `json:"path"`
	Source string `json:"source"`
	// Transition is how the page is entered; empty follows the config's
	// pageTransition (pageTransitions.ts).
	Transition string `json:"transition,omitempty"`
	// Data is what the page fetches before it's drawn, and SEO its head
	// built from it (package pagedata).
	Data []pagedata.Import `json:"data,omitempty"`
	SEO  *pagedata.SEO     `json:"seo,omitempty"`
}

// Project is what the compiler reads: StudioAppFiles plus the main source.
type Project struct {
	Source string
	// Pages is nil when the project has none (a single-source component);
	// an empty, non-nil slice is an app with no pages, which is an error.
	Pages            []Page
	ShellSource      string
	EntryPageID      string
	ComponentSources *js.Object[string]
	Config           *js.JSON
}

type definition struct {
	documentID string
	className  string
	analysis   *cdsl.Analysis
	path       string
}

type scope struct {
	options string
	aliases map[string]string
}

type unsupported struct {
	node    *cdsl.Expr
	message string
}

// q is a Dart string literal: JSON.stringify with `$` and U+2028/9 escaped.
func q(value string) string { return js.DartString(value) }

// Placeholders for the widget's own fields and its resolved options,
// rewritten once the class's shape is known. q() escapes control characters,
// so they never appear inside generated strings.
const (
	fieldMark   = "\u0001W."
	optionsMark = "\u0001O"
)

func field(name string) string { return fieldMark + name }

type shape struct {
	variants, stateful, options, actions, bindings bool
}

func fullShape() shape { return shape{true, true, true, true, true} }

func optionName(option *cdsl.Expr) string { return cdsl.LiteralValue(option.Arg("name")).String() }

func allOptions(a *cdsl.Analysis) []*cdsl.Expr {
	out := append([]*cdsl.Expr{}, a.Options...)
	for _, v := range a.Variants {
		out = append(out, cdsl.CallItems(v.Arg("options"))...)
	}
	return out
}

var (
	componentName = regexp.MustCompile(`^[A-Z][A-Za-z0-9]{0,59}$`)
	camelBreak    = regexp.MustCompile(`([a-z0-9])([A-Z])`)
	unsafeFile    = regexp.MustCompile(`[^a-zA-Z0-9_-]`)
	wordSplit     = regexp.MustCompile(`[^a-zA-Z0-9]`)
	markers       = regexp.MustCompile(`(?m)^// @cdsl \d+ \d+ \d+\n|^// @cdsl-end\n`)
	usesRuntime   = regexp.MustCompile(`\bstudio[A-Z]\w*|\bStudio(?:Flex|TextInput|AspectRatio|PlatformWidget|Scope|Value|Platform|UnconnectedPlatform|Action|Tap|Fill|Capped|Sized|Colors)\b`)
	usesBootstrap = regexp.MustCompile(`\bBootstrapIcons\.`)
	usesLucide    = regexp.MustCompile(`\bLucideIcons\.`)
)

// Compile translates a project. It is pure and deterministic.
func Compile(project Project) Compilation {
	project = withEmbeddedCard(project)
	customTokens := func(family string) []string { return config.FamilyCustomTokens(project.Config, family) }
	var diagnostics []Diagnostic
	var definitions []*definition
	componentKeys := project.ComponentSources.Keys()
	for _, name := range componentKeys {
		if !componentName.MatchString(name) {
			return Compilation{Version: Version, Diagnostics: []Diagnostic{{
				Code: "DART_PROJECT", Severity: "error",
				Message: "Component names must start with a capital letter and contain only letters and numbers (up to 60 characters).",
			}}}
		}
	}
	var sources []cdsl.Source
	for _, name := range componentKeys {
		source, _ := project.ComponentSources.Get(name)
		sources = append(sources, cdsl.Source{Name: name, Source: source})
	}
	analyses, registryEntries := cdsl.AnalyzeComponents(sources, customTokens)
	add := func(documentID, source, className, componentName string, data map[string]string) {
		var analysis *cdsl.Analysis
		if componentName != "" {
			analysis = analyses[componentName]
		} else {
			analysis = cdsl.AnalyzeSource(source, cdsl.Context{Components: registryEntries, CustomTokens: customTokens, Data: data})
		}
		fileName := strings.TrimPrefix(documentID, "component:")
		fileName = camelBreak.ReplaceAllString(fileName, "${1}_${2}")
		fileName = unsafeFile.ReplaceAllString(fileName, "_")
		if fileName == "" {
			fileName = "main"
		}
		fileName = strings.ToLower(fileName)
		directory := "pages"
		if componentName != "" || documentID == "shared-shell" {
			directory = "components"
		}
		path := "lib/" + directory + "/" + fileName + ".dart"
		for _, item := range definitions {
			if item.path == path {
				path = "lib/" + directory + "/" + fileName + "_" + js.NumberString(float64(len(definitions))) + ".dart"
				break
			}
		}
		definitions = append(definitions, &definition{documentID, className, analysis, path})
		for _, issue := range analysis.Diagnostics {
			if issue.Severity == "error" {
				diagnostics = append(diagnostics, Diagnostic{documentID, issue.Code, "error", issue.Message, issue.From, issue.To})
			}
		}
	}
	components := map[string]*definition{}
	sorted := append([]string{}, componentKeys...)
	sort.SliceStable(sorted, func(i, j int) bool { return utf16Less(sorted[i], sorted[j]) })
	for _, name := range sorted {
		source, _ := project.ComponentSources.Get(name)
		add("component:"+name, source, "StudioComponent"+name, name, nil)
		components[name] = definitions[len(definitions)-1]
	}
	pages := project.Pages
	if len(pages) == 0 {
		pages = []Page{{ID: "", Source: project.Source}}
	}
	for index, page := range pages {
		var class strings.Builder
		for _, word := range wordSplit.Split(page.ID, -1) {
			if word != "" {
				class.WriteString(strings.ToUpper(word[:1]) + word[1:])
			}
		}
		// Its imports are names it may read.
		add(page.ID, page.Source, "StudioPage"+js.NumberString(float64(index+1))+class.String(), "", pagedata.ImportScope(page.Data))
	}
	ids := map[string]bool{}
	for _, page := range pages {
		ids[page.ID] = true
	}
	if (project.Pages != nil && len(project.Pages) == 0) || len(ids) != len(pages) || len(pages) > 20 || len(components) > 20 {
		diagnostics = append(diagnostics, Diagnostic{Code: "DART_PROJECT", Severity: "error",
			Message: "Use unique page IDs and at most 20 pages and 20 components."})
	}
	if project.ShellSource != "" {
		add("shared-shell", project.ShellSource, "StudioSharedShell", "", nil)
	}
	if !config.Valid(project.Config) {
		diagnostics = append(diagnostics, Diagnostic{Code: "DART_CONFIG", Severity: "error",
			Message: "Project theme configuration is invalid."})
	}
	entry := pages[0]
	entryFound := false
	for _, page := range pages {
		if page.ID == project.EntryPageID {
			entry, entryFound = page, true
			break
		}
	}
	if project.EntryPageID != "" && !entryFound {
		diagnostics = append(diagnostics, Diagnostic{Code: "DART_ENTRY", Severity: "error",
			Message: "The entry page does not exist."})
	}
	documents := make([]Document, len(definitions))
	for i, d := range definitions {
		documents[i] = Document{d.documentID, d.className, d.path}
	}
	result := Compilation{Version: Version, Diagnostics: diagnostics, Documents: documents}
	for _, issue := range diagnostics {
		if issue.Code == "DART_CONFIG" || issue.Code == "DART_PROJECT" || issue.Code == "DART_ENTRY" {
			return result
		}
	}
	failed := func(d *definition) bool {
		for _, issue := range diagnostics {
			if issue.DocumentID == d.documentID && issue.Severity == "error" {
				return true
			}
		}
		return false
	}
	// Settle what every widget needs before writing any of them: shapes start
	// at "needs everything" and shrink until stable.
	shapes := map[*definition]shape{}
	for _, d := range definitions {
		shapes[d] = fullShape()
	}
	for round := 0; round <= len(definitions); round++ {
		changed := false
		for index, d := range definitions {
			if failed(d) {
				continue
			}
			var scratch []Diagnostic
			e := newEmitter(project, d, components, index, &scratch, shapes)
			if _, ok := e.tryEmit(); !ok {
				continue
			}
			if e.shape != shapes[d] {
				shapes[d] = e.shape
				changed = true
			}
		}
		if !changed {
			break
		}
	}
	var files []File
	dependencies := map[string][]*definition{}
	for index, d := range definitions {
		if failed(d) {
			continue
		}
		e := newEmitter(project, d, components, index, &diagnostics, shapes)
		source, ok := e.tryEmit()
		if !ok {
			diagnostics = append(diagnostics, Diagnostic{d.documentID, "DART_UNSUPPORTED", "error",
				e.failure.message, e.failure.node.From, e.failure.node.To})
			continue
		}
		dependencies[d.path] = e.dependencies
		var imports []string
		for _, dep := range e.dependencies {
			imports = append(imports, "import '../"+dep.path[4:]+"';")
		}
		var marked strings.Builder
		marked.WriteString("// Generated by Upskale Studio. Edit the Flux source instead.\n")
		if usesBootstrap.MatchString(source) {
			marked.WriteString("import 'package:bootstrap_icons/bootstrap_icons.dart';\n")
		}
		marked.WriteString("import 'package:flutter/material.dart';\n")
		if usesLucide.MatchString(source) {
			marked.WriteString("import 'package:lucide_icons_flutter/lucide_icons.dart';\n")
		}
		if usesRuntime.MatchString(source) {
			marked.WriteString("import '../studio_runtime.dart';\n")
		}
		// The Library's components this file draws (library.go).
		for _, item := range Library {
			if item.Uses.MatchString(source) {
				marked.WriteString("import '../" + item.Path[4:] + "';\n")
			}
		}
		marked.WriteString(strings.Join(imports, "\n") + "\n\n" + source + "\n")
		files = append(files, File{Path: d.path, DocumentID: d.documentID, Source: Format(markers.ReplaceAllString(marked.String(), ""))})
	}
	// Remove files whose imports depend on a document that failed.
	for removed := true; removed; {
		removed = false
		for i := len(files) - 1; i >= 0; i-- {
			var missing *definition
			for _, dep := range dependencies[files[i].Path] {
				present := false
				for _, f := range files {
					if f.Path == dep.path {
						present = true
						break
					}
				}
				if !present {
					missing = dep
					break
				}
			}
			if missing != nil {
				diagnostics = append(diagnostics, Diagnostic{files[i].DocumentID, "DART_DEPENDENCY", "error",
					"Fix " + missing.documentID + " before this file can be compiled.", 0, 0})
				files = append(files[:i], files[i+1:]...)
				removed = true
			}
		}
	}
	var exports []string
	for _, f := range files {
		exports = append(exports, "export '"+f.Path[4:]+"';")
	}
	result.Diagnostics = diagnostics
	result.Success = true
	for _, issue := range diagnostics {
		if issue.Severity == "error" {
			result.Success = false
		}
	}
	for _, doc := range documents {
		if doc.DocumentID == entry.ID {
			result.EntryClass = doc.ClassName
			break
		}
	}
	result.Files = append([]File{
		{Path: "lib/studio_runtime.dart", Source: Runtime},
		{Path: "lib/studio_generated.dart", Source: "// Generated by Upskale Studio.\nexport 'studio_runtime.dart';\n" + strings.Join(exports, "\n") + "\n"},
	}, files...)
	// The Library's Dart, for what the app draws of it.
	for _, item := range UsedLibrary(files) {
		result.Files = append(result.Files, File{Path: item.Path, Source: item.Source})
	}
	return result
}

// utf16Less is JS `<` on strings: UTF-16 code unit order.
func utf16Less(a, b string) bool {
	ua, ub := js.Units(a), js.Units(b)
	for i := 0; i < len(ua) && i < len(ub); i++ {
		if ua[i] != ub[i] {
			return ua[i] < ub[i]
		}
	}
	return len(ua) < len(ub)
}

var _ = registry.Constructors

// Embed's catalog, as the preview resolves it (SourceContent's Embed): both
// names are Studio's example product card. A project that embeds one gets
// that card compiled in as a component of its own, under embeddedCard.
var embedCatalog = map[string]bool{"core/product-card": true, "acme/product-card-pro": true}

const embeddedCard = "EmbeddedProductCard"

//go:embed product_card.flx
var productCardSource string

var embedCall = regexp.MustCompile(`\bEmbed\s*\(`)

// withEmbeddedCard brings the catalog's card in with an Embed of it.
func withEmbeddedCard(project Project) Project {
	sources := []string{project.Source, project.ShellSource}
	for _, page := range project.Pages {
		sources = append(sources, page.Source)
	}
	for _, name := range project.ComponentSources.Keys() {
		source, _ := project.ComponentSources.Get(name)
		sources = append(sources, source)
	}
	embeds := false
	for _, source := range sources {
		if !embedCall.MatchString(source) {
			continue
		}
		for id := range embedCatalog {
			embeds = embeds || strings.Contains(source, `"`+id+`"`)
		}
	}
	if !embeds || project.ComponentSources.Has(embeddedCard) {
		return project
	}
	components := js.NewObject[string]()
	for _, name := range project.ComponentSources.Keys() {
		source, _ := project.ComponentSources.Get(name)
		components.Set(name, source)
	}
	components.Set(embeddedCard, productCardSource)
	project.ComponentSources = components
	return project
}
