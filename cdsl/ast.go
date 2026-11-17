// Package cdsl parses and checks Upskale Studio's component language — a
// port of upskaleapp's parser.ts, languageService.ts (analysis) and
// dataBindings.ts (binding types). Positions are UTF-16 code units, as the
// browser editor counts them.
package cdsl

import "github.com/iamsinyagepr/flux/js"

// ExprKind is the kind of an expression node.
type ExprKind uint8

const (
	Literal ExprKind = iota
	Ref
	List
	Call
	Unary
	Binary
	Conditional
	Index
)

// Segment is one part of an interpolated string: text, or an expression.
type Segment struct {
	Text string
	Expr *Expr
}

// Args are a call's named arguments, in source order.
type Args struct {
	keys  []string
	items map[string]*Expr
}

func (a *Args) set(key string, value *Expr) {
	if a.items == nil {
		a.items = map[string]*Expr{}
	}
	a.keys = append(a.keys, key)
	a.items[key] = value
}

// Get is node.args[key] (nil when absent).
func (a *Args) Get(key string) *Expr {
	if a == nil {
		return nil
	}
	return a.items[key]
}

// Has is Object.hasOwn(node.args, key).
func (a *Args) Has(key string) bool { return a.Get(key) != nil }

// Keys are the argument names in source order.
func (a *Args) Keys() []string {
	if a == nil {
		return nil
	}
	return a.keys
}

// Len is the number of named arguments.
func (a *Args) Len() int { return len(a.Keys()) }

// Expr is a CDSL expression node.
type Expr struct {
	Kind     ExprKind
	From, To int

	// Literal: Value; Segments is non-nil only for an interpolated string.
	Value    js.Value
	Segments []Segment

	// Ref and Call: the dotted name.
	Name string

	// List.
	Items []*Expr

	// Call.
	Args       *Args
	Positional []*Expr

	// Unary and Binary.
	Op    string
	Child *Expr
	Left  *Expr
	Right *Expr

	// Conditional.
	Condition, Yes, No *Expr

	// Index.
	Target, IndexExpr *Expr
}

// Arg is node.args[key] for a call (nil otherwise).
func (e *Expr) Arg(key string) *Expr {
	if e == nil || e.Kind != Call {
		return nil
	}
	return e.Args.Get(key)
}

// IsCall reports whether e is a call to name.
func (e *Expr) IsCall(name string) bool { return e != nil && e.Kind == Call && e.Name == name }

// Children are the direct sub-expressions, in childrenOf order: named
// arguments, then positional ones; list items; operands; interpolations.
func Children(e *Expr) []*Expr {
	if e == nil {
		return nil
	}
	switch e.Kind {
	case Call:
		out := make([]*Expr, 0, e.Args.Len()+len(e.Positional))
		for _, key := range e.Args.Keys() {
			out = append(out, e.Args.Get(key))
		}
		return append(out, e.Positional...)
	case List:
		return e.Items
	case Unary:
		return []*Expr{e.Child}
	case Binary:
		return []*Expr{e.Left, e.Right}
	case Conditional:
		return []*Expr{e.Condition, e.Yes, e.No}
	case Index:
		return []*Expr{e.Target, e.IndexExpr}
	case Literal:
		var out []*Expr
		for _, s := range e.Segments {
			if s.Expr != nil {
				out = append(out, s.Expr)
			}
		}
		return out
	}
	return nil
}

// LiteralValue is the value of a plain (not interpolated) literal, and
// undefined for anything else.
func LiteralValue(e *Expr) js.Value {
	if e != nil && e.Kind == Literal && e.Segments == nil {
		return e.Value
	}
	return js.UndefinedValue()
}

// Text is String(literalValue(node) ?? "").
func Text(e *Expr) string {
	v := LiteralValue(e)
	if v.IsNullish() {
		return ""
	}
	return v.String()
}

// NumericLiteral is a number literal, or a negated one; ok is false otherwise.
func NumericLiteral(e *Expr) (float64, bool) {
	v := LiteralValue(e)
	if v.Kind() == js.Number {
		return v.Num(), true
	}
	if e != nil && e.Kind == Unary && e.Op == "-" {
		if n, ok := NumericLiteral(e.Child); ok {
			return -n, true
		}
	}
	return 0, false
}

// CallItems are the calls in a list expression (nil for anything else).
func CallItems(e *Expr) []*Expr {
	if e == nil || e.Kind != List {
		return nil
	}
	var out []*Expr
	for _, item := range e.Items {
		if item.Kind == Call {
			out = append(out, item)
		}
	}
	return out
}

// ListItems are a list's items (nil for anything else).
func ListItems(e *Expr) []*Expr {
	if e == nil || e.Kind != List {
		return nil
	}
	return e.Items
}

// Set adds or replaces a named argument (a call built by a compiler, such
// as a loading outline), keeping the order arguments were first set in.
func (a *Args) Set(key string, value *Expr) {
	if a.items != nil {
		if _, ok := a.items[key]; ok {
			a.items[key] = value
			return
		}
	}
	a.set(key, value)
}
