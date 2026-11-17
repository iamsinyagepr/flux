// Package registry is the Flux catalogue the compiler checks sources
// against — constructors, functions, token families, size defaults and the
// binding schemas — exported from upskaleapp's TypeScript registry by
// `node scripts/export-studio-compiler.mjs`, so the editor and this compiler
// never disagree about what a parameter is called or typed.
package registry

import (
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed registry.json
var registryJSON []byte

//go:embed bindings.json
var bindingsJSON []byte

// Param is one named parameter and its declared type ("Widget",
// "List<Action>", "Number"…).
type Param struct {
	Name string
	Type string
}

// Choice is one variant a component offers.
type Choice struct {
	ID    string
	Label string
}

// Entry is a constructor, function or project component.
type Entry struct {
	Name     string
	Group    string
	Params   []Param
	Required []string
	// Variants is nil for built-ins; a project component always has a list.
	Variants []Choice
	index    map[string]string
}

// Param returns a parameter's declared type.
func (e *Entry) Param(name string) (string, bool) {
	if e.index == nil {
		e.index = make(map[string]string, len(e.Params))
		for _, p := range e.Params {
			e.index[p.Name] = p.Type
		}
	}
	t, ok := e.index[name]
	return t, ok
}

// HasParam is Object.hasOwn(parameters, name).
func (e *Entry) HasParam(name string) bool { _, ok := e.Param(name); return ok }

// Field is one field of a binding schema.
type Field struct {
	Name string
	Type string
}

// Size is one built-in size token and its pixel value.
type Size struct {
	Name  string
	Value float64
}

// ScopeEntry is a root binding: a named type, or a fixed list of field names.
type ScopeEntry struct {
	Type   string
	Fields []string
	IsList bool
	// Typed: each field's type, for a name whose fields have their own (a
	// component's options: options.product is a Product for a DataOption,
	// "unknown" for any other option).
	Typed map[string]string
}

var (
	Constructors   map[string]*Entry
	Functions      map[string]*Entry
	TokenFamilies  map[string][]string
	SizeDefaults   map[string][]Size // spacing, radii, fontSizes, iconSizes
	ColorVariables []string
	IconNames      []string
	// IconGlyphs is each library's Dart glyph for each icon name:
	// MaterialIcons/FeatherIcons/BootstrapIcons → name → "Icons.shopping_bag".
	IconGlyphs   map[string]map[string]string
	Schemas      map[string][]Field
	PageFields   []Field
	RootBindings []struct {
		Name  string
		Entry ScopeEntry
	}
)

type rawEntry struct {
	Name       string      `json:"name"`
	Group      string      `json:"group"`
	Parameters [][2]string `json:"parameters"`
	Required   []string    `json:"required"`
}

func (r rawEntry) entry() *Entry {
	e := &Entry{Name: r.Name, Group: r.Group, Required: r.Required}
	for _, p := range r.Parameters {
		e.Params = append(e.Params, Param{Name: p[0], Type: p[1]})
	}
	return e
}

func init() {
	var data struct {
		Constructors   []rawEntry                      `json:"constructors"`
		Functions      []rawEntry                      `json:"functions"`
		TokenFamilies  [][2]json.RawMessage            `json:"tokenFamilies"`
		SizeDefaults   map[string][][2]json.RawMessage `json:"sizeDefaults"`
		ColorVariables []string                        `json:"colorVariables"`
		IconNames      []string                        `json:"iconNames"`
		IconGlyphs     map[string]map[string]string    `json:"iconGlyphs"`
	}
	must(json.Unmarshal(registryJSON, &data))
	Constructors = map[string]*Entry{}
	for _, raw := range data.Constructors {
		Constructors[raw.Name] = raw.entry() // later entries win, as new Map() does
	}
	Functions = map[string]*Entry{}
	for _, raw := range data.Functions {
		Functions[raw.Name] = raw.entry()
	}
	TokenFamilies = map[string][]string{}
	for _, pair := range data.TokenFamilies {
		var name string
		var values []string
		must(json.Unmarshal(pair[0], &name))
		must(json.Unmarshal(pair[1], &values))
		TokenFamilies[name] = values
	}
	SizeDefaults = map[string][]Size{}
	for group, pairs := range data.SizeDefaults {
		for _, pair := range pairs {
			var size Size
			must(json.Unmarshal(pair[0], &size.Name))
			must(json.Unmarshal(pair[1], &size.Value))
			SizeDefaults[group] = append(SizeDefaults[group], size)
		}
	}
	ColorVariables = data.ColorVariables
	IconNames = data.IconNames
	IconGlyphs = data.IconGlyphs

	var bindings struct {
		Schemas          map[string][][2]string `json:"schemas"`
		Page             [][2]string            `json:"page"`
		RootBindingTypes [][2]json.RawMessage   `json:"rootBindingTypes"`
		NotImported      [][3]string            `json:"notImported"`
	}
	must(json.Unmarshal(bindingsJSON, &bindings))
	Schemas = map[string][]Field{}
	for name, fields := range bindings.Schemas {
		for _, f := range fields {
			Schemas[name] = append(Schemas[name], Field{Name: f[0], Type: f[1]})
		}
	}
	for _, f := range bindings.Page {
		PageFields = append(PageFields, Field{Name: f[0], Type: f[1]})
	}
	NotImported = map[string][2]string{}
	for _, entry := range bindings.NotImported {
		NotImported[entry[0]] = [2]string{entry[1], entry[2]}
	}
	for _, pair := range bindings.RootBindingTypes {
		var name string
		must(json.Unmarshal(pair[0], &name))
		var entry ScopeEntry
		if err := json.Unmarshal(pair[1], &entry.Type); err != nil {
			must(json.Unmarshal(pair[1], &entry.Fields))
			entry.IsList = true
		}
		RootBindings = append(RootBindings, struct {
			Name  string
			Entry ScopeEntry
		}{name, entry})
	}
}

// NotImported is what the checker says of a name pages could once read
// without importing it: [in a page, in a component] (dataBindings.ts's
// notImportedMessage).
var NotImported map[string][2]string

func must(err error) {
	if err != nil {
		panic(fmt.Sprintf("studio registry: %v", err))
	}
}

// IsColorVariable is Object.hasOwn(colorVariables, name).
func IsColorVariable(name string) bool {
	for _, c := range ColorVariables {
		if c == name {
			return true
		}
	}
	return false
}

// SizeDefault is sizeDefaults[group][name].
func SizeDefault(group, name string) (float64, bool) {
	for _, s := range SizeDefaults[group] {
		if s.Name == name {
			return s.Value, true
		}
	}
	return 0, false
}

// InFamily is tokenFamilies[family]?.includes(name).
func InFamily(family, name string) bool {
	for _, v := range TokenFamilies[family] {
		if v == name {
			return true
		}
	}
	return false
}
