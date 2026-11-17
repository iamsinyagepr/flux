package cdsl

import (
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/registry"
)

// Source is one named Flux source (a project component).
type Source struct {
	Name   string
	Source string
}

var optionTypes = map[string]string{
	"StringOption": "String", "NumberOption": "Number", "BoolOption": "Bool",
	"ColorOption": "Color", "ComponentOption": "String", "ActionOption": "Action",
}

// ComponentReferences describes each project component as a registry entry:
// its options as parameters (plus variant), and its variants.
func ComponentReferences(sources []Source) map[string]*registry.Entry {
	entries := make(map[string]*registry.Entry, len(sources))
	for _, s := range sources {
		root := ParseSource(s.Source).Root
		entry := &registry.Entry{
			Name: s.Name, Group: "Components", Required: []string{}, Variants: []registry.Choice{},
			Params: []registry.Param{{Name: "variant", Type: "String"}},
		}
		var variants []*Expr
		for _, item := range ListItems(root.Arg("variants")) {
			if item.IsCall("Variant") {
				variants = append(variants, item)
			}
		}
		options := append([]*Expr{}, ListItems(root.Arg("options"))...)
		for _, variant := range variants {
			options = append(options, ListItems(variant.Arg("options"))...)
		}
		declared := map[string]bool{"variant": true}
		for _, option := range options {
			if option.Kind != Call {
				continue
			}
			key := LiteralValue(option.Arg("name"))
			if key.Kind() != js.String || declared[key.Str()] {
				continue
			}
			declared[key.Str()] = true
			t, ok := optionTypes[option.Name]
			if !ok {
				t = "Value"
				// Data passed in: its type (Product, Store[]…).
				if dt := dataOptionType(option); option.Name == "DataOption" && dt != "" {
					t = dt
				}
			}
			entry.Params = append(entry.Params, registry.Param{Name: key.Str(), Type: t})
			if option.Name == "DataOption" && js.StrictEquals(LiteralValue(option.Arg("required")), js.BoolValue(true)) {
				entry.Required = append(entry.Required, key.Str())
			}
		}
		for _, variant := range variants {
			id := LiteralValue(variant.Arg("id"))
			label := LiteralValue(variant.Arg("label"))
			if label.IsNullish() {
				label = id
			}
			entry.Variants = append(entry.Variants, registry.Choice{ID: valueOrEmpty(id), Label: valueOrEmpty(label)})
		}
		entries[s.Name] = entry
	}
	return entries
}

func valueOrEmpty(v js.Value) string {
	if v.IsNullish() {
		return ""
	}
	return v.String()
}

// AnalyzeComponents analyses every project component against the others and
// reports component cycles.
func AnalyzeComponents(sources []Source, customTokens func(string) []string) (map[string]*Analysis, map[string]*registry.Entry) {
	components := ComponentReferences(sources)
	analyses := make(map[string]*Analysis, len(sources))
	for _, s := range sources {
		analyses[s.Name] = AnalyzeSource(s.Source, Context{Components: components, Current: s.Name, CustomTokens: customTokens})
	}
	for _, s := range sources {
		name, analysis := s.Name, analyses[s.Name]
		visited := map[string]bool{}
		var check func(current string, path []string) bool
		check = func(current string, path []string) bool {
			if contains(path, current) {
				return true
			}
			if visited[current] {
				return false
			}
			visited[current] = true
			definition := analyses[current]
			cyclic := false
			var walk func(node *Expr)
			walk = func(node *Expr) {
				if node.Kind == Call {
					// `cyclic ||= check(…)`: once cyclic, check is not called again.
					if _, ok := analyses[node.Name]; ok && !(node.Name == current && registry.Constructors[current] != nil) && !cyclic {
						cyclic = check(node.Name, append(append([]string{}, path...), current))
					}
				}
				for _, child := range Children(node) {
					walk(child)
				}
			}
			if definition != nil && definition.Root != nil {
				walk(definition.Root)
			}
			return cyclic
		}
		if check(name, nil) {
			analysis.Diagnostics = append(analysis.Diagnostics, Diagnostic{
				Code: "component-cycle", Severity: "error",
				Message: "Cyclic component reference involving " + name + ".",
				From:    0, To: min(js.Len(analysis.Source), 9),
			})
		}
	}
	return analyses, components
}
