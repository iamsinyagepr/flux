package cdsl

import (
	"regexp"
	"strings"

	"github.com/iamsinyagepr/flux/registry"
)

// Scope is a binding scope: each root name is a type ("Store[]") or a fixed
// list of field names (state, options, viewport…).
type Scope map[string]registry.ScopeEntry

func (s Scope) clone() Scope {
	out := make(Scope, len(s)+2)
	for k, v := range s {
		out[k] = v
	}
	return out
}

var (
	nullable   = regexp.MustCompile(`\s*\|\s*(?:null|undefined)`)
	pageType   = regexp.MustCompile(`^Page<(.+)>$`)
	recordType = regexp.MustCompile(`^Record<string,\s*(.+)>$`)
	typeT      = regexp.MustCompile(`\bT\b`)
)

func nonNull(t string) string {
	return strings.TrimSpace(nullable.ReplaceAllString(t, ""))
}

// BindingFields are a type's fields (Page<T> substituted), or none.
func BindingFields(t string) []registry.Field {
	t = nonNull(t)
	if m := pageType.FindStringSubmatch(t); m != nil {
		fields := make([]registry.Field, len(registry.PageFields))
		for i, f := range registry.PageFields {
			fields[i] = registry.Field{Name: f.Name, Type: typeT.ReplaceAllLiteralString(f.Type, m[1])}
		}
		return fields
	}
	return registry.Schemas[t]
}

func bindingField(t, name string) (registry.Field, bool) {
	for _, f := range BindingFields(t) {
		if f.Name == name {
			return f, true
		}
	}
	return registry.Field{}, false
}

// ElementType is "X" for "X[]", and "" for anything else.
func ElementType(t string) string {
	t = nonNull(t)
	// An external API's answer: its items are as open as it is.
	if t == "json" {
		return "json"
	}
	if strings.HasSuffix(t, "[]") {
		return t[:len(t)-2]
	}
	return ""
}

// ReferenceType is the type a dotted reference resolves to, or "" when it
// doesn't resolve.
func ReferenceType(name string, scope Scope) string {
	parts := strings.Split(name, ".")
	root, fields := parts[0], parts[1:]
	entry, ok := scope[root]
	if !ok || (!entry.IsList && entry.Type == "" && entry.Typed == nil) {
		return ""
	}
	if entry.Typed != nil {
		// Typed fields: the first one picks its type, the rest go on from there.
		if len(fields) == 0 {
			return "unknown"
		}
		t, has := entry.Typed[fields[0]]
		if !has {
			return ""
		}
		fields = fields[1:]
		if t == "unknown" {
			if len(fields) > 0 {
				return ""
			}
			return "unknown"
		}
		entry = registry.ScopeEntry{Type: t}
	}
	if entry.IsList {
		if len(fields) == 0 {
			return "unknown"
		}
		if len(fields) == 1 {
			for _, f := range entry.Fields {
				if f == fields[0] {
					return "unknown"
				}
			}
		}
		return ""
	}
	t := entry.Type
	for _, field := range fields {
		t = nonNull(t)
		// An external API's answer: any field, of any shape.
		if t == "json" {
			return "json"
		}
		if strings.HasSuffix(t, "[]") && field == "length" {
			t = "number"
			continue
		}
		if m := recordType.FindStringSubmatch(t); m != nil {
			t = m[1]
			continue
		}
		f, ok := bindingField(t, field)
		if !ok {
			return ""
		}
		t = f.Type
	}
	return t
}

// ExpressionType is the type of an expression, when it is known ("" otherwise).
func ExpressionType(e *Expr, scope Scope) string {
	if e == nil {
		return ""
	}
	switch e.Kind {
	case Ref:
		return ReferenceType(e.Name, scope)
	case Index:
		return ElementType(ExpressionType(e.Target, scope))
	case Conditional:
		if t := ExpressionType(e.Yes, scope); t != "" {
			return t
		}
		return ExpressionType(e.No, scope)
	case Call:
		var first *Expr
		if len(e.Positional) > 0 {
			first = e.Positional[0]
		}
		switch e.Name {
		case "take", "search", "filter":
			return ExpressionType(first, scope)
		case "first":
			return ElementType(ExpressionType(first, scope))
		}
	case List:
		var first *Expr
		if len(e.Items) > 0 {
			first = e.Items[0]
		}
		if t := ExpressionType(first, scope); t != "" {
			return t + "[]"
		}
	}
	return ""
}

// rootScope is rootBindingTypes.
func rootScope() Scope {
	scope := Scope{}
	for _, b := range registry.RootBindings {
		scope[b.Name] = b.Entry
	}
	return scope
}
