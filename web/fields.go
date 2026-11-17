package web

import (
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/registry"
)

// **Only what a page reads of its data.**
//
// A website's page imports are fetched by its server (data.server.ts), and
// what the server answers is in the page: in its HTML, and in the browser's
// network panel when it navigates. So the server sends only the fields the
// page's code reads of each import (its own, its parts', the components it
// places', its SEO's and the other imports' parameters) and nothing else of
// the record: a store list read for its names and images is names and
// images.
//
// Read from the Flux, conservatively: anything it can't follow (a value
// handed to an action, to a function it doesn't know, or read whole) keeps
// the whole of that value. Lists are transparent: a field read of a list's
// items is read on each.

// fieldTree is what's read of a value: all of it, or some of its fields.
// An empty one is the value's being there (an If's condition, a list's
// length): an object of none of its fields, a text or a number as it is.
type fieldTree struct {
	whole bool
	kids  map[string]*fieldTree
}

func (t *fieldTree) mark(path []string, whole bool) {
	n := t
	for _, key := range path {
		if n.whole {
			return
		}
		if n.kids == nil {
			n.kids = map[string]*fieldTree{}
		}
		next := n.kids[key]
		if next == nil {
			next = &fieldTree{}
			n.kids[key] = next
		}
		n = next
	}
	if whole {
		n.whole, n.kids = true, nil
	}
}

// graft reads src's fields under path.
func (t *fieldTree) graft(path []string, src *fieldTree) {
	if src == nil {
		return
	}
	t.mark(path, src.whole)
	for key, kid := range src.kids {
		t.graft(append(append([]string{}, path...), key), kid)
	}
}

func (t *fieldTree) at(key string) *fieldTree {
	if t == nil || t.kids == nil {
		return nil
	}
	return t.kids[key]
}

// json is the tree as data.server.ts's projection: true for a whole field,
// an object of fields otherwise.
func (t *fieldTree) json() any {
	if t.whole {
		return true
	}
	out := map[string]any{}
	for key, kid := range t.kids {
		out[key] = kid.json()
	}
	return out
}

// optionsRoot is a component's options, as the root of what it reads: a
// path ["@o", name, …] is a read of its option name.
const optionsRoot = "@o"

type fieldReader struct {
	components map[string]*definition
	summaries  map[*definition]*fieldTree
	busy       map[*definition]bool
}

// fieldWalk is one document's reads: of bindings (their names the roots)
// and of its options (under optionsRoot).
type fieldWalk struct {
	r       *fieldReader
	def     *definition
	reads   *fieldTree
	parts   map[string]bool
	clients map[string]string
}

// fieldScope is ForEach's names: each the values its items come from.
type fieldScope map[string][][]string

func (s fieldScope) with(name string, paths [][]string) fieldScope {
	out := make(fieldScope, len(s)+1)
	for k, v := range s {
		out[k] = v
	}
	out[name] = paths
	return out
}

// segments is a dotted read's keys, without list positions (lists are
// transparent).
func segments(keys []string) []string {
	out := make([]string, 0, len(keys))
	for _, key := range keys {
		if key == "" || strings.Trim(key, "0123456789") == "" {
			continue
		}
		out = append(out, key)
	}
	return out
}

func extend(paths [][]string, keys ...string) [][]string {
	out := make([][]string, len(paths))
	for i, p := range paths {
		out[i] = append(append([]string{}, p...), segments(keys)...)
	}
	return out
}

// use reads the whole of what n is; present only that it's there.
func (w *fieldWalk) use(n *cdsl.Expr, s fieldScope) {
	for _, p := range w.value(n, s) {
		w.reads.mark(p, true)
	}
}

func (w *fieldWalk) present(n *cdsl.Expr, s fieldScope) {
	for _, p := range w.value(n, s) {
		w.reads.mark(p, false)
	}
}

// value is where n's value comes from (the paths it is), its own reads
// marked on the way.
func (w *fieldWalk) value(n *cdsl.Expr, s fieldScope) [][]string {
	if n == nil {
		return nil
	}
	switch n.Kind {
	case cdsl.Literal:
		for _, part := range n.Segments {
			if part.Expr != nil {
				w.use(part.Expr, s)
			}
		}
		return nil
	case cdsl.List:
		for _, item := range n.Items {
			w.use(item, s)
		}
		return nil
	case cdsl.Ref:
		parts := strings.Split(n.Name, ".")
		head, rest := parts[0], parts[1:]
		switch head {
		case "options":
			return [][]string{append([]string{optionsRoot}, segments(rest)...)}
		case "state", "event", "input":
			return nil
		}
		if alias, ok := s[head]; ok {
			return extend(alias, rest...)
		}
		if head == "" || (head[0] >= 'A' && head[0] <= 'Z') || w.clients[head] != "" {
			return nil
		}
		return [][]string{append([]string{head}, segments(rest)...)}
	case cdsl.Index:
		target := w.value(n.Target, s)
		if n.IndexExpr != nil && n.IndexExpr.Kind == cdsl.Literal && n.IndexExpr.Segments == nil {
			switch v := n.IndexExpr.Value; v.Kind() {
			case js.Number:
				return target
			case js.String:
				return extend(target, v.Str())
			}
		}
		w.use(n.IndexExpr, s)
		for _, p := range target {
			w.reads.mark(p, true)
		}
		return nil
	case cdsl.Conditional:
		w.present(n.Condition, s)
		return append(w.value(n.Yes, s), w.value(n.No, s)...)
	case cdsl.Unary:
		if n.Op == "!" {
			w.present(n.Child, s)
		} else {
			w.use(n.Child, s)
		}
		return nil
	case cdsl.Binary:
		switch n.Op {
		case "??", "||", "&&":
			// The value of one side or the other.
			left := w.value(n.Left, s)
			for _, p := range left {
				w.reads.mark(p, false)
			}
			return append(left, w.value(n.Right, s)...)
		}
		w.use(n.Left, s)
		w.use(n.Right, s)
		return nil
	case cdsl.Call:
		return w.call(n, s)
	}
	// Something not followed: whatever it reads, it reads whole.
	for _, child := range cdsl.Children(n) {
		w.use(child, s)
	}
	return nil
}

func (w *fieldWalk) call(n *cdsl.Expr, s fieldScope) [][]string {
	a := n.Args
	switch n.Name {
	case "ForEach":
		items := w.value(a.Get("items"), s)
		for _, p := range items {
			w.reads.mark(p, false)
			// Each item's key (rt.key): its id.
			w.reads.mark(append(append([]string{}, p...), "id"), true)
		}
		inner := s
		if as := cdsl.LiteralValue(a.Get("as")); as.Kind() == js.String {
			inner = inner.with(as.Str(), items)
		}
		if index := cdsl.LiteralValue(a.Get("indexAs")); index.Kind() == js.String {
			inner = inner.with(index.Str(), nil)
		}
		w.use(a.Get("limit"), s)
		w.use(a.Get("empty"), s)
		w.use(a.Get("child"), inner)
		return nil
	case "If":
		w.present(a.Get("condition"), s)
		w.use(a.Get("then"), s)
		w.use(a.Get("else"), s)
		return nil
	case "Use":
		name := cdsl.LiteralValue(a.Get("part")).String()
		if part := w.def.analysis.Parts.Get(name); part != nil && !w.parts[name] {
			w.parts[name] = true
			w.use(part, s)
			delete(w.parts, name)
		}
		return nil
	}
	if custom := w.r.components[n.Name]; custom != nil && custom != w.def {
		w.component(n, custom, s)
		return nil
	}
	if registry.Functions[n.Name] != nil {
		return w.function(n, s)
	}
	for _, child := range cdsl.Children(n) {
		w.use(child, s)
	}
	return nil
}

// function is a Flux function's reads (runtime.tsx's fn): a list one
// filters or takes from is still the list.
func (w *fieldWalk) function(n *cdsl.Expr, s fieldScope) [][]string {
	args := n.Positional
	arg := func(i int) *cdsl.Expr {
		if i < len(args) {
			return args[i]
		}
		return nil
	}
	rest := func(from int) {
		for i := from; i < len(args); i++ {
			w.use(args[i], s)
		}
	}
	// fieldsOf reads keys (literal dotted texts) on each item; anything else
	// reads the items whole.
	fieldsOf := func(list [][]string, keys ...*cdsl.Expr) {
		for _, key := range keys {
			v := cdsl.LiteralValue(key)
			if v.Kind() != js.String {
				for _, p := range list {
					w.reads.mark(p, true)
				}
				w.use(key, s)
				continue
			}
			for _, p := range extend(list, strings.Split(v.Str(), ".")...) {
				w.reads.mark(p, true)
			}
		}
	}
	switch n.Name {
	case "take", "first":
		list := w.value(arg(0), s)
		rest(1)
		return list
	case "filter":
		list := w.value(arg(0), s)
		fieldsOf(list, arg(1))
		rest(2)
		return list
	case "search":
		list := w.value(arg(0), s)
		w.use(arg(1), s)
		if fields := arg(2); fields != nil && fields.Kind == cdsl.List {
			fieldsOf(list, fields.Items...)
		} else {
			fieldsOf(list, fields)
		}
		return list
	case "length", "count", "isEmpty":
		w.present(arg(0), s)
		rest(1)
		return nil
	case "formatMoney":
		// The page's store's currency (or the storefront's).
		w.reads.mark([]string{"store", "currency"}, true)
	}
	rest(0)
	return nil
}

// component is a placed component's reads: of each value it's given, what
// the component reads of that option; and what it reads of the bindings.
func (w *fieldWalk) component(n *cdsl.Expr, custom *definition, s fieldScope) {
	summary := w.r.summary(custom)
	options := summary.at(optionsRoot)
	for _, name := range n.Args.Keys() {
		value := n.Args.Get(name)
		paths := w.value(value, s)
		for _, p := range paths {
			switch {
			case summary == nil || (options != nil && options.whole):
				// Placed within itself, or reading all of its options at once.
				w.reads.mark(p, true)
			default:
				w.reads.graft(p, options.at(name))
			}
		}
	}
	if summary != nil {
		for key, kid := range summary.kids {
			if key != optionsRoot {
				w.reads.graft([]string{key}, kid)
			}
		}
	}
}

// summary is what a component reads, followed once (nil while it's being
// followed: one placed within itself).
func (r *fieldReader) summary(d *definition) *fieldTree {
	if t, ok := r.summaries[d]; ok {
		return t
	}
	if r.busy[d] {
		return nil
	}
	r.busy[d] = true
	t := r.walk(d)
	delete(r.busy, d)
	r.summaries[d] = t
	return t
}

// walk follows one document: its options' defaults, its state, and each
// variant's build.
func (r *fieldReader) walk(d *definition) *fieldTree {
	w := &fieldWalk{r: r, def: d, reads: &fieldTree{}, parts: map[string]bool{}}
	analysis := d.analysis
	if analysis == nil {
		return &fieldTree{whole: true}
	}
	w.clients = cdsl.ClientImports(analysis.Root)
	root := fieldScope{}
	defaults := map[string][][]string{}
	option := func(o *cdsl.Expr) {
		if o.Name == "ActionOption" {
			return
		}
		name := cdsl.LiteralValue(o.Arg("name")).String()
		defaults[name] = append(defaults[name], w.value(o.Arg("default"), root)...)
	}
	for _, o := range analysis.Options {
		option(o)
	}
	for _, name := range analysis.States.Keys() {
		w.use(analysis.States.Get(name), root)
	}
	for _, variant := range analysis.Variants {
		for _, o := range cdsl.CallItems(variant.Arg("options")) {
			option(o)
		}
		w.use(variant.Arg("build"), root)
	}
	if analysis.Root != nil {
		w.use(analysis.Root.Arg("defaultVariant"), root)
	}
	// An option left to its default reads the default's value.
	for name, paths := range defaults {
		read := w.reads.at(optionsRoot)
		if read != nil && read.whole {
			for _, p := range paths {
				w.reads.mark(p, true)
			}
			continue
		}
		for _, p := range paths {
			w.reads.graft(p, read.at(name))
		}
	}
	return w.reads
}

// pageFields is, per page, what it reads of each import its server
// fetches: a projection for data.server.ts, or none (nil) where it reads
// one whole.
func pageFields(pages []dart.Page, documents map[string]*definition, components map[string]*definition) map[string]map[string]any {
	r := &fieldReader{components: components, summaries: map[*definition]*fieldTree{}, busy: map[*definition]bool{}}
	out := map[string]map[string]any{}
	for _, page := range pages {
		d := documents[page.ID]
		if d == nil || len(page.Data) == 0 {
			continue
		}
		reads := r.walk(d)
		w := &fieldWalk{r: r, def: d, reads: reads, parts: map[string]bool{}}
		if seo := page.SEO; seo != nil {
			for _, source := range []string{seo.Title, seo.Description, seo.Image} {
				if strings.TrimSpace(source) == "" {
					continue
				}
				node, problem := cdsl.ParseExpression(source)
				if problem != nil {
					continue
				}
				w.use(node, fieldScope{})
			}
			if seo.Schema != "" && seo.Subject != "" {
				// The schema.org description reads the record as it likes.
				reads.mark([]string{seo.Subject}, true)
				reads.mark([]string{"store", "currency"}, true)
			}
		}
		imported := map[string]bool{}
		for _, imp := range page.Data {
			imported[imp.Name] = true
			for _, p := range imp.Params {
				if p.From == "import" {
					reads.mark(segments(strings.Split(p.Value, ".")), true)
				}
			}
		}
		if imported["menu"] {
			// An imported menu is the page's store, categories and products
			// too (importedBindings): where it imports none of those, and
			// while one it imports isn't there yet (a browser one, loading).
			derived := map[string][][]string{
				"store":      {{"menu", "store"}},
				"categories": {{"menu", "categories"}},
				"category":   {{"menu", "categories"}},
				"products":   {{"menu", "categories", "products"}, {"menu", "uncategorised"}},
			}
			for name, targets := range derived {
				read := reads.at(name)
				if read == nil {
					continue
				}
				for _, target := range targets {
					reads.graft(target, read)
					if name == "products" {
						reads.mark(append(append([]string{}, target...), "is_available_online"), true)
					}
				}
			}
		}
		fields := map[string]any{}
		for _, imp := range page.Data {
			if signedInData(imp) || imp.Source == "client" {
				continue
			}
			if imp.Name == "product" {
				// The page's product: its options are chosen on it, and the
				// cart's actions read it as it is.
				continue
			}
			read := reads.at(imp.Name)
			if read == nil {
				read = &fieldTree{}
			}
			if read.whole {
				continue
			}
			fields[imp.Name] = read.json()
		}
		if len(fields) > 0 {
			out[page.ID] = fields
		}
	}
	return out
}
