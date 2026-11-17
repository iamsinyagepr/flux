package web

import (
	_ "embed"
	"encoding/json"
	"regexp"
	"sort"
	"strings"
	"sync"
)

// The website's runtime, as modules (runtime/modules.json, made from
// runtime/src/studio by upskaleapp's scripts/export-web-runtime.mjs): each
// top-level function, class, constant and type of the runtime is one
// { id, code, dependencies }, with the imports and studio-* classes it uses,
// and studio.css is one entry per rule. A site gets only the modules its
// pages, components and routes reference, and what those depend on; its
// stylesheet only the rules for the classes they draw with.

//go:embed runtime/modules.json
var modulesJSON []byte

type runtimeImport struct {
	Local    string `json:"local"`
	Module   string `json:"module"`
	Kind     string `json:"kind"` // named, default, namespace, side
	Imported string `json:"imported"`
	Type     bool   `json:"type"`
}

type runtimeFileInfo struct {
	Path    string          `json:"path"`
	Header  string          `json:"header"`
	Imports []runtimeImport `json:"imports"`
}

type runtimeModule struct {
	ID           string   `json:"id"`
	File         string   `json:"file"`
	Names        []string `json:"names"`
	Code         string   `json:"code"`
	Dependencies []string `json:"dependencies"`
	Imports      []string `json:"imports"`
	Classes      []string `json:"classes"`
	Always       bool     `json:"always"`
}

type cssRule struct {
	Code      string     `json:"code"`
	Wrap      string     `json:"wrap"`
	Selectors [][]string `json:"selectors"`
	Keyframes string     `json:"keyframes"`
}

type runtimeIndex struct {
	Sources map[string]string `json:"sources"`
	Files   []runtimeFileInfo `json:"files"`
	Modules []runtimeModule   `json:"modules"`
	CSS     struct {
		Path   string    `json:"path"`
		Header string    `json:"header"`
		Rules  []cssRule `json:"rules"`
	} `json:"css"`

	byID   map[string]*runtimeModule
	byName map[string][]string // "runtime:text" → module ids
	stems  map[string]string   // "runtime" → src/studio/runtime.tsx
}

var (
	runtimeOnce sync.Once
	runtimeIdx  *runtimeIndex
)

func runtimeModules() *runtimeIndex {
	runtimeOnce.Do(func() {
		idx := &runtimeIndex{}
		if err := json.Unmarshal(modulesJSON, idx); err != nil {
			panic(err) // the embedded runtime is part of this binary
		}
		idx.byID = map[string]*runtimeModule{}
		idx.byName = map[string][]string{}
		idx.stems = map[string]string{}
		for i := range idx.Modules {
			m := &idx.Modules[i]
			idx.byID[m.ID] = m
			stem := stemOf(m.File)
			for _, name := range m.Names {
				idx.byName[stem+":"+name] = append(idx.byName[stem+":"+name], m.ID)
			}
		}
		for _, f := range idx.Files {
			idx.stems[stemOf(f.Path)] = f.Path
		}
		runtimeIdx = idx
	})
	return runtimeIdx
}

// stemOf is a runtime file's module name: src/studio/fetch.server.ts → fetch.server.
func stemOf(path string) string {
	name := path[strings.LastIndex(path, "/")+1:]
	for _, ext := range []string{".tsx", ".ts", ".css"} {
		name = strings.TrimSuffix(name, ext)
	}
	return name
}

var (
	namespaceImport = regexp.MustCompile(`import\s+(?:type\s+)?\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+"(?:\.\.?/)+studio/([\w.]+)"`)
	namedImport     = regexp.MustCompile(`import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"(?:\.\.?/)+studio/([\w.]+)"`)
	studioClass     = regexp.MustCompile(`\bstudio-[a-z0-9-]+`)
)

// runtimeReferences are the runtime modules a generated file names: what it
// imports from studio/<file> by name, and every alias.member of a
// namespace import (rt.text, W.Carousel).
func (idx *runtimeIndex) runtimeReferences(content string, into map[string]bool) {
	add := func(stem, name string) {
		for _, id := range idx.byName[stem+":"+name] {
			into[id] = true
		}
	}
	for _, m := range namespaceImport.FindAllStringSubmatch(content, -1) {
		alias, stem := m[1], m[2]
		member := regexp.MustCompile(`\b` + regexp.QuoteMeta(alias) + `\.([A-Za-z_$][\w$]*)`)
		for _, use := range member.FindAllStringSubmatch(content, -1) {
			add(stem, use[1])
		}
	}
	for _, m := range namedImport.FindAllStringSubmatch(content, -1) {
		for _, part := range strings.Split(m[1], ",") {
			part = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(part), "type "))
			if name, _, ok := strings.Cut(part, " as "); ok {
				part = strings.TrimSpace(name)
			}
			if part != "" {
				add(m[2], part)
			}
		}
	}
}

// runtimeFor is the runtime a site's generated files need: the modules they
// reference and everything those depend on, each file only what it has of
// them, with only the imports they use; and the stylesheet's rules for the
// classes drawn.
func runtimeFor(generated []File) []File {
	idx := runtimeModules()
	wanted := map[string]bool{}
	classes := map[string]bool{}
	for _, f := range generated {
		idx.runtimeReferences(f.Content, wanted)
		for _, c := range studioClass.FindAllString(f.Content, -1) {
			classes[c] = true
		}
	}
	for _, m := range idx.Modules {
		if m.Always {
			wanted[m.ID] = true
		}
	}
	// Everything they depend on.
	queue := make([]string, 0, len(wanted))
	for id := range wanted {
		queue = append(queue, id)
	}
	for len(queue) > 0 {
		id := queue[len(queue)-1]
		queue = queue[:len(queue)-1]
		m := idx.byID[id]
		if m == nil {
			continue
		}
		for _, dep := range m.Dependencies {
			if !wanted[dep] {
				wanted[dep] = true
				queue = append(queue, dep)
			}
		}
	}

	var out []File
	for _, file := range idx.Files {
		var units []string
		used := map[string]bool{}
		for _, m := range idx.Modules {
			if m.File != file.Path || !wanted[m.ID] {
				continue
			}
			units = append(units, m.Code)
			for _, local := range m.Imports {
				used[local] = true
			}
			for _, c := range m.Classes {
				classes[c] = true
			}
		}
		if len(units) == 0 {
			continue
		}
		out = append(out, File{Path: file.Path, Content: file.Header + importLines(file.Imports, used) + "\n" + strings.Join(units, "\n\n") + "\n"})
	}
	if css := stylesheet(idx, classes); css != "" {
		out = append(out, File{Path: idx.CSS.Path, Content: css})
	}
	return out
}

// importLines are a runtime file's imports, only those its kept modules use:
// in the order the file had them, one line per module and kind.
func importLines(imports []runtimeImport, used map[string]bool) string {
	type group struct {
		module, kind string
		names        []string
		allTypes     bool
	}
	var groups []*group
	find := func(module, kind string) *group {
		for _, g := range groups {
			if g.module == module && g.kind == kind {
				return g
			}
		}
		g := &group{module: module, kind: kind, allTypes: true}
		groups = append(groups, g)
		return g
	}
	for _, imp := range imports {
		switch {
		case imp.Kind == "side":
			find(imp.Module, "side")
		case !used[imp.Local]:
			continue
		case imp.Kind == "named":
			g := find(imp.Module, "named")
			name := imp.Imported
			if imp.Local != imp.Imported {
				name += " as " + imp.Local
			}
			if imp.Type {
				name = "type " + name
			} else {
				g.allTypes = false
			}
			g.names = append(g.names, name)
		default:
			g := find(imp.Module, imp.Kind)
			g.names = append(g.names, imp.Local)
			g.allTypes = g.allTypes && imp.Type
		}
	}
	var b strings.Builder
	for _, g := range groups {
		from := " from " + q(g.module) + ";\n"
		keyword := "import "
		if g.allTypes && g.kind != "side" {
			keyword = "import type "
		}
		switch g.kind {
		case "side":
			b.WriteString("import " + q(g.module) + ";\n")
		case "namespace":
			b.WriteString(keyword + "* as " + g.names[0] + from)
		case "default":
			b.WriteString(keyword + g.names[0] + from)
		default:
			names := g.names
			if g.allTypes {
				for i, name := range names {
					names[i] = strings.TrimPrefix(name, "type ")
				}
			}
			b.WriteString(keyword + "{ " + strings.Join(names, ", ") + " }" + from)
		}
	}
	return b.String()
}

// stylesheet is studio.css with only the rules for classes the site draws
// (a rule without studio classes, :root or body, always), and the
// animations those rules name.
func stylesheet(idx *runtimeIndex, classes map[string]bool) string {
	var kept []cssRule
	for _, rule := range idx.CSS.Rules {
		if rule.Keyframes != "" {
			continue
		}
		for _, selector := range rule.Selectors {
			all := true
			for _, c := range selector {
				if !classes[c] {
					all = false
					break
				}
			}
			if all {
				kept = append(kept, rule)
				break
			}
		}
	}
	if len(kept) == 0 {
		return ""
	}
	var text strings.Builder
	for _, rule := range kept {
		text.WriteString(rule.Code)
	}
	named := text.String()
	var frames []string
	for _, rule := range idx.CSS.Rules {
		if rule.Keyframes != "" && strings.Contains(named, rule.Keyframes) {
			frames = append(frames, rule.Code)
		}
	}
	var b strings.Builder
	b.WriteString(idx.CSS.Header)
	wrap := ""
	for _, rule := range kept {
		if rule.Wrap != wrap {
			if wrap != "" {
				b.WriteString("}\n")
			}
			wrap = rule.Wrap
			if wrap != "" {
				b.WriteString("\n" + wrap + " {\n")
			}
		}
		if wrap != "" {
			b.WriteString("  " + strings.ReplaceAll(rule.Code, "\n", "\n  ") + "\n")
		} else {
			b.WriteString("\n" + rule.Code + "\n")
		}
	}
	if wrap != "" {
		b.WriteString("}\n")
	}
	for _, frame := range frames {
		b.WriteString("\n" + frame + "\n")
	}
	return b.String()
}

// sortedKeys is a set's members, sorted.
func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for key := range set {
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}
