package web

import (
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/config"
	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/registry"
)

// A document (a page or a project component) and the React function it
// compiles to.
type definition struct {
	documentID string
	name       string // the exported function: StudioPage3Menu, StudioComponentGrocerHeader
	file       string // src/pages/menu.tsx
	analysis   *cdsl.Analysis
}

// scope is what a name means where an expression is compiled: the variable
// holding the component's options, and ForEach's item and index names.
type scope struct {
	options string
	aliases map[string]string
}

func (s scope) with(name, code string) scope {
	aliases := make(map[string]string, len(s.aliases)+1)
	for k, v := range s.aliases {
		aliases[k] = v
	}
	aliases[name] = code
	return scope{options: s.options, aliases: aliases}
}

type unsupported struct {
	node    *cdsl.Expr
	message string
}

type emitter struct {
	in         *Input
	def        *definition
	components map[string]*definition
	// imports: module → names, for this file.
	imports map[string]map[string]bool
	deps    []*definition
	serial  int
	steps   int
	parts   map[string]bool
	// warnings are things that compile but don't work on the web yet.
	warnings []warning
	// clientData are the page's Data fetched in the browser (pageRoute):
	// its head, made on the server, can't read them.
	clientData map[string]bool
}

type warning struct {
	node    *cdsl.Expr
	message string
}

func newEmitter(in *Input, d *definition, components map[string]*definition) *emitter {
	return &emitter{in: in, def: d, components: components, imports: map[string]map[string]bool{}, parts: map[string]bool{}}
}

func (e *emitter) fail(node *cdsl.Expr, message string) {
	panic(&unsupported{node, message})
}

func (e *emitter) warn(node *cdsl.Expr, message string) {
	for _, w := range e.warnings {
		if w.node == node {
			return
		}
	}
	e.warnings = append(e.warnings, warning{node, message})
}

func (e *emitter) use(module, name string) {
	if e.imports[module] == nil {
		e.imports[module] = map[string]bool{}
	}
	e.imports[module][name] = true
}

// q is a JS string literal.
func q(s string) string { return js.Stringify(s) }

func (e *emitter) tick(node *cdsl.Expr) {
	e.steps++
	if e.steps > 40000 {
		e.fail(node, "Web generation expansion limit exceeded.")
	}
}

// ---------------------------------------------------------------- expressions

func (e *emitter) expr(node *cdsl.Expr, s scope) string {
	if node == nil {
		return "undefined"
	}
	e.tick(node)
	ex := func(x *cdsl.Expr) string { return e.expr(x, s) }
	switch node.Kind {
	case cdsl.Literal:
		if node.Segments != nil {
			parts := make([]string, len(node.Segments))
			for i, part := range node.Segments {
				if part.Expr == nil {
					parts[i] = q(part.Text)
				} else {
					parts[i] = "rt.text(" + ex(part.Expr) + ")"
				}
			}
			return "[" + strings.Join(parts, ", ") + "].join(\"\")"
		}
		if node.Value.Kind() == js.String {
			return q(node.Value.Str())
		}
		if node.Value.IsUndefined() {
			return "undefined"
		}
		return node.Value.String()
	case cdsl.List:
		items := make([]string, len(node.Items))
		for i, item := range node.Items {
			items[i] = ex(item)
		}
		return "[" + strings.Join(items, ", ") + "]"
	case cdsl.Ref:
		parts := strings.Split(node.Name, ".")
		head, path := parts[0], parts[1:]
		read := func(target string, path []string) string {
			if len(path) == 0 {
				return target
			}
			return "rt.read(" + target + ", " + pathList(path) + ")"
		}
		switch head {
		case "options":
			return read(s.options, path)
		case "state":
			return read("st", path)
		case "event":
			return read("event", path)
		case "input":
			return read("event", append([]string{"input"}, path...))
		}
		if alias, ok := s.aliases[head]; ok {
			return read(alias, path)
		}
		if head != "" && head[0] >= 'A' && head[0] <= 'Z' {
			return e.token(node)
		}
		// The customer's own (usingClient's Client.x()): read live.
		if client := cdsl.ClientImports(e.def.analysis.Root)[head]; client != "" {
			return read("rt.client(b, "+q(client)+")", path)
		}
		return read("b", parts)
	case cdsl.Index:
		return "rt.read(" + ex(node.Target) + ", [" + ex(node.IndexExpr) + "])"
	case cdsl.Conditional:
		return "(rt.truthy(" + ex(node.Condition) + ") ? " + ex(node.Yes) + " : " + ex(node.No) + ")"
	case cdsl.Unary:
		if node.Op == "!" {
			return "!rt.truthy(" + ex(node.Child) + ")"
		}
		return "(-rt.num(" + ex(node.Child) + "))"
	case cdsl.Binary:
		return "rt.binary(" + q(node.Op) + ", " + ex(node.Left) + ", () => " + ex(node.Right) + ")"
	case cdsl.Call:
		return e.callValue(node, s)
	}
	e.fail(node, "This expression is not supported on the web yet.")
	return ""
}

func (e *emitter) callValue(node *cdsl.Expr, s scope) string {
	ex := func(x *cdsl.Expr) string { return e.expr(x, s) }
	a := node.Args
	opt := func(name string) string {
		if a.Has(name) {
			return ex(a.Get(name))
		}
		return "undefined"
	}
	switch node.Name {
	case "Responsive":
		return "rt.responsive(b, " + opt("base") + ", " + opt("md") + ", " + opt("lg") + ")"
	case "Insets":
		either := func(first, second string) string {
			if a.Has(first) {
				return ex(a.Get(first))
			}
			if a.Has(second) {
				return ex(a.Get(second))
			}
			return "0"
		}
		return "rt.insets(" + either("top", "y") + ", " + either("right", "x") + ", " + either("bottom", "y") + ", " + either("left", "x") + ")"
	case "Gradient":
		stops := []string{opt("from")}
		if via := a.Get("via"); via != nil && via.Kind == cdsl.List {
			for _, item := range via.Items {
				stops = append(stops, ex(item))
			}
		}
		stops = append(stops, opt("to"))
		style := "linear"
		if st := a.Get("style"); st != nil && st.Kind == cdsl.Ref {
			style = strings.TrimPrefix(st.Name, "GradientStyle.")
		}
		return "rt.gradient(" + q(style) + ", [" + strings.Join(stops, ", ") + "], " + opt("begin") + ", " + opt("end") + ")"
	case "Border":
		return "rt.border(" + opt("width") + ", " + opt("color") + ")"
	case "isMobile", "isTablet", "isDesktop":
		return "rt." + node.Name + "(b)"
	}
	if registry.Functions[node.Name] != nil {
		args := make([]string, len(node.Positional))
		for i, p := range node.Positional {
			args[i] = ex(p)
		}
		return "rt.fn(b, " + q(node.Name) + ", [" + strings.Join(args, ", ") + "])"
	}
	if c := registry.Constructors[node.Name]; (c != nil && c.Group == "Actions") || node.Name == "Asset" {
		entries := []string{"$: " + q(node.Name)}
		for _, key := range a.Keys() {
			entries = append(entries, q(key)+": "+ex(a.Get(key)))
		}
		return "{ " + strings.Join(entries, ", ") + " }"
	}
	e.fail(node, node.Name+"() is not supported in web expressions yet.")
	return ""
}

var (
	sizeGroups = map[string]string{"Space": "spacing", "Radius": "radii", "FontSize": "fontSizes", "Size": "iconSizes"}
	weights    = map[string]string{"regular": "400", "medium": "500", "semibold": "600", "bold": "700"}
	iconFamily = map[string]string{"MaterialIcons": "material", "FeatherIcons": "feather", "BootstrapIcons": "bootstrap"}
)

func (e *emitter) configNumber(group, key string) (float64, bool) {
	if value := e.in.Config.Field(group).Field(key); value != nil && !value.Value().IsNullish() {
		return value.Number, true
	}
	return registry.SizeDefault(group, key)
}

// token is a Family.key token's value on the web: a number for sizes, a CSS
// colour for colours, a react-icons component for icons, its key otherwise.
func (e *emitter) token(node *cdsl.Expr) string {
	parts := strings.SplitN(node.Name, ".", 3)
	family, key := parts[0], ""
	if len(parts) > 1 {
		key = parts[1]
	}
	if family == "Route" {
		return "rt.route(" + q(key) + ")"
	}
	if group, ok := sizeGroups[family]; ok {
		if value, found := e.configNumber(group, key); found {
			return js.NumberString(value)
		}
	}
	if family == "Color" {
		colors := e.in.Config.Field("colors")
		if registry.IsColorVariable(key) || (colors.IsObject() && colors.Object.Has(key)) {
			// A theme variable, so a dark palette repaints it.
			return q("var(--studio-" + key + ")")
		}
	}
	if family == "FontWeight" {
		if w, ok := weights[key]; ok {
			return w
		}
	}
	library := iconFamily[family]
	if family == "Icons" {
		library = "material"
		if lib := e.in.Config.Field("iconLibrary"); lib != nil && !lib.Value().IsNullish() {
			library = lib.Value().String()
		}
	}
	if library != "" {
		if glyph := iconGlyphs[library][key]; glyph != "" {
			e.use(iconPackages[library], glyph)
			return glyph
		}
		e.fail(node, "There's no icon "+node.Name+".")
	}
	if family == "Shadow" || family == "Effect" || registry.InFamily(family, key) ||
		contains(config.FamilyCustomTokens(e.in.Config, family), key) {
		return q(key)
	}
	e.fail(node, "Token "+node.Name+" is not supported on the web yet.")
	return ""
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// -------------------------------------------------------------------- actions

// action is the statements an action runs, inside a handler with `event`.
func (e *emitter) action(node *cdsl.Expr, s scope) string {
	if node == nil {
		return ""
	}
	ex := func(x *cdsl.Expr) string { return e.expr(x, s) }
	if node.Kind == cdsl.Ref && strings.HasPrefix(node.Name, "options.") {
		return "act[" + q(node.Name[8:]) + "]?.(event);"
	}
	if node.Kind == cdsl.Conditional {
		return "if (rt.truthy(" + ex(node.Condition) + ")) { " + e.action(node.Yes, s) + " } else { " + e.action(node.No, s) + " }"
	}
	if node.Kind == cdsl.Literal && node.Value.IsNullish() {
		return ""
	}
	if node.Kind != cdsl.Call {
		e.fail(node, "This action must be a callback or action constructor.")
	}
	a := node.Args
	switch node.Name {
	case "Actions":
		actions := a.Get("actions")
		if actions == nil || actions.Kind != cdsl.List {
			e.fail(node, "Actions requires a literal list.")
		}
		steps := make([]string, len(actions.Items))
		for i, step := range actions.Items {
			steps[i] = e.action(step, s)
		}
		return strings.Join(steps, " ")
	case "SetState":
		name := cdsl.LiteralValue(a.Get("state")).String()
		return "{ const next = " + ex(a.Get("value")) + "; setSt((p) => ({ ...p, " + q(name) + ": next })); }"
	case "Toggle":
		name := cdsl.LiteralValue(a.Get("state")).String()
		return "setSt((p) => ({ ...p, " + q(name) + ": !rt.truthy(p[" + q(name) + "]) }));"
	case "RunAction":
		target := a.Get("action")
		if target == nil || target.Kind != cdsl.Ref || !strings.HasPrefix(target.Name, "options.") {
			e.fail(node, "RunAction requires an ActionOption reference.")
		}
		value := "event"
		if a.Has("value") {
			value = "{ ...event, value: " + ex(a.Get("value")) + " }"
		}
		return "act[" + q(target.Name[8:]) + "]?.(" + value + ");"
	case "ShowMessage":
		return "s.notice(rt.text(" + ex(a.Get("message")) + "));"
	case "Navigate":
		if search := a.Get("search"); search.IsCall("Search") {
			// Its search params, as ?name= in the address it opens.
			var entries []string
			for _, key := range search.Args.Keys() {
				entries = append(entries, q(key)+": "+ex(search.Args.Get(key)))
			}
			return "s.navigate(" + ex(a.Get("to")) + ", { " + strings.Join(entries, ", ") + " });"
		}
		return "s.navigate(" + ex(a.Get("to")) + ");"
	case "SubmitForm", "ResetForm":
		method := "submit"
		if node.Name == "ResetForm" {
			method = "reset"
		}
		return "s.form(rt.text(" + ex(a.Get("form")) + "))?." + method + "();"
	case "ScrollTo":
		return "rt.scrollTo(rt.text(" + ex(a.Get("id")) + "));"
	}
	if c := registry.Constructors[node.Name]; c != nil && c.Group == "Actions" {
		if !runtimeActions[node.Name] {
			e.warn(node, node.Name+" isn't available on the web yet.")
		}
		var entries []string
		for _, key := range a.Keys() {
			entries = append(entries, q(key)+": "+ex(a.Get(key)))
		}
		return "s.run(" + q(node.Name) + ", { " + strings.Join(entries, ", ") + " }, event, b);"
	}
	e.fail(node, node.Name+" is not supported as a web action yet.")
	return ""
}

// The platform actions the web runtime (storefront.ts's run) carries out.
var runtimeActions = map[string]bool{
	"OpenProduct": true, "AddToCart": true, "AddConfiguredProduct": true, "PlaceOrder": true, "SubmitExampleOrder": true,
	"SetCheckout": true, "SetTip": true, "PayOrder": true, "CancelOrder": true, "SubmitReview": true,
	"SavePreviewAddress": true, "SignIn": true, "SignUp": true, "SignOut": true, "SignOutPreviewCustomer": true,
	"ResetPreviewPassword": true, "SearchPlaces": true, "ChoosePlace": true, "UseMyLocation": true, "ChooseCity": true,
	"SearchStores": true, "ChooseStore": true, "ToggleOption": true, "ChangeCartLine": true, "RemoveCartLine": true,
	"OpenOrder": true, "RemoveAddress": true, "ConfirmDeliveryPoint": true, "ToggleDarkMode": true,
}

func (e *emitter) callback(node *cdsl.Expr, s scope) string {
	return "(event: rt.Event) => { " + e.action(node, s) + " }"
}

// -------------------------------------------------------------------- widgets

// The generated TSX is laid out as a person would write it: an element on
// one line while it is short, else a prop per line; children an item per
// line; everything nested indented by two spaces. Code is built inside out,
// so each piece is written as if at the margin and indented where placed.

// indent moves every line after the first in by one level.
func indent(code string) string {
	return strings.ReplaceAll(code, "\n", "\n  ")
}

// multiline reports whether code spans several lines.
func multiline(code string) bool { return strings.Contains(code, "\n") }

// element writes a JSX element: on one line when it is short and simple,
// otherwise a prop per line under the tag.
func element(tag, key string, props []string) string {
	if key != "" {
		props = append([]string{"key={" + key + "}"}, props...)
	}
	if len(props) == 0 {
		return "<" + tag + " />"
	}
	line := "<" + tag + " " + strings.Join(props, " ") + " />"
	if !multiline(line) && len(line) <= 100 {
		return line
	}
	var b strings.Builder
	b.WriteString("<" + tag)
	for _, p := range props {
		b.WriteString("\n  " + indent(p))
	}
	b.WriteString("\n/>")
	return b.String()
}

// pathList is a read path as a JS array: ["store", "name"].
func pathList(path []string) string {
	items := make([]string, len(path))
	for i, key := range path {
		items[i] = q(key)
	}
	return "[" + strings.Join(items, ", ") + "]"
}

// plainString is a JS string literal JSX can take as it is, in quotes: no
// escapes, and no & (JSX reads entities in quoted attributes).
var plainString = regexp.MustCompile(`^"[^"\\{}<>&]*"$`)

// prop is a JSX attribute; an element spanning lines gets lines of its own.
func prop(name, code string) string {
	if plainString.MatchString(code) {
		return name + "=" + code
	}
	if strings.HasPrefix(code, "<") && multiline(code) {
		return name + "={\n  " + indent(code) + "\n}"
	}
	return name + "={" + code + "}"
}

// block is an element in parentheses on lines of its own when it spans lines.
func block(code string) string {
	if multiline(code) {
		return "(\n  " + indent(code) + "\n)"
	}
	return code
}

// conditional is `condition ? then : otherwise` between elements.
func conditional(condition, then, otherwise string) string {
	return "rt.truthy(" + condition + ") ? " + block(then) + " : " + block(otherwise)
}

// list is a JS array of elements, an item per line.
func list(items []string) string {
	if len(items) == 0 {
		return "[]"
	}
	var b strings.Builder
	b.WriteString("[")
	for _, item := range items {
		b.WriteString("\n  " + indent(item) + ",")
	}
	b.WriteString("\n]")
	return b.String()
}

// children compiles a literal list of widgets into a JS array expression,
// with If and ForEach expanded in place.
func (e *emitter) children(node *cdsl.Expr, s scope) string {
	if node == nil {
		return "[]"
	}
	if node.Kind != cdsl.List {
		e.fail(node, "Widget children must be a literal list.")
	}
	items := make([]string, 0, len(node.Items))
	for i, item := range node.Items {
		key := q("c" + strconv.Itoa(i))
		if item.IsCall("ForEach") {
			items = append(items, "..."+e.forEach(item, s, key))
			continue
		}
		if item.IsCall("If") {
			then := e.widget(item.Arg("then"), s, key)
			otherwise := "null"
			if item.Arg("else") != nil {
				otherwise = e.widget(item.Arg("else"), s, key)
			}
			items = append(items, conditional(e.expr(item.Arg("condition"), s), then, otherwise))
			continue
		}
		items = append(items, e.widget(item, s, key))
	}
	return list(items)
}

// forEach is a ForEach as an array of keyed elements.
func (e *emitter) forEach(item *cdsl.Expr, s scope, prefix string) string {
	value := "item" + strconv.Itoa(e.serial)
	index := "index" + strconv.Itoa(e.serial)
	e.serial++
	inner := s.with(cdsl.LiteralValue(item.Arg("as")).String(), value)
	if item.Arg("indexAs") != nil {
		inner = inner.with(cdsl.LiteralValue(item.Arg("indexAs")).String(), index)
	}
	limit := "50"
	if item.Arg("limit") != nil {
		limit = e.expr(item.Arg("limit"), s)
	}
	empty := "null"
	if item.Arg("empty") != nil {
		empty = e.widget(item.Arg("empty"), s, prefix+" + \":empty\"")
	}
	child := e.widget(item.Arg("child"), inner, "rt.key("+prefix+", "+value+", "+index+")")
	return "rt.each(" + e.expr(item.Arg("items"), s) + ", " + limit + ", (" + value + ": any, " + index + ": number) => " + block(child) + ", " + block(empty) + ")"
}

// widget is one widget as a JSX element (or a JS expression for one).
func (e *emitter) widget(node *cdsl.Expr, s scope, key string) string {
	if node == nil {
		return "null"
	}
	e.tick(node)
	if node.Kind == cdsl.Literal && node.Value.IsNullish() {
		return "null"
	}
	if node.Kind != cdsl.Call {
		e.fail(node, "Expected a widget constructor.")
	}
	a := node.Args
	switch node.Name {
	case "Empty":
		return "null"
	case "If":
		then := e.widget(a.Get("then"), s, key)
		otherwise := e.widget(a.Get("else"), s, key)
		return "(" + conditional(e.expr(a.Get("condition"), s), then, otherwise) + ")"
	case "ForEach":
		// On its own, a full-width vertical stack, as the preview lays it out.
		return element("W.Flex", key, []string{`direction="vertical"`, `crossAxisAlignment="stretch"`,
			"children={[..." + e.forEach(node, s, q("e")) + "]}"})
	case "Use":
		name := cdsl.LiteralValue(a.Get("part")).String()
		part := e.def.analysis.Parts.Get(name)
		if part == nil || e.parts[name] {
			e.fail(node, "Missing or cyclic part: "+name)
		}
		e.parts[name] = true
		code := e.widget(part, s, key)
		delete(e.parts, name)
		return code
	case "Embed":
		e.fail(node, node.Name+" can't be built for the web: it is Flutter-only.")
	case "GoogleMap":
		return e.googleMap(node, s, key)
	}
	if custom := e.components[node.Name]; custom != nil && custom != e.def {
		return e.component(node, custom, s, key)
	}
	entry := registry.Constructors[node.Name]
	if entry == nil || entry.Group == "Actions" || entry.Group == "Values" || entry.Group == "Options" || entry.Group == "Structure" {
		e.fail(node, node.Name+" is not a widget the web can build.")
	}
	if len(node.Positional) > 0 {
		e.fail(node, node.Name+" requires named arguments.")
	}
	tag := "W." + node.Name
	props := []string{}
	if !nativeWidgets[node.Name] {
		// A storefront control the web runtime doesn't draw yet: a quiet
		// placeholder, said at compile time.
		e.warn(node, node.Name+" isn't drawn on the web yet.")
		tag = "W.Unavailable"
		props = append(props, "name="+"{"+q(node.Name)+"}")
	}
	for _, name := range a.Keys() {
		value := a.Get(name)
		t, ok := entry.Param(name)
		if !ok {
			e.fail(value, node.Name+"."+name+" is not a parameter of "+node.Name+".")
		}
		var code string
		switch {
		case strings.Contains(t, "List<Widget>") || strings.Contains(t, "List<Layer>") || strings.Contains(t, "List<Tab>"):
			code = e.children(value, s)
		case strings.Contains(t, "Widget"):
			code = e.widget(value, s, "")
		case t == "Action":
			code = e.callback(value, s)
		default:
			code = e.expr(value, s)
		}
		props = append(props, prop(name, code))
	}
	if formFields[node.Name] {
		// A field bound to the component's state: it shows the state, and
		// typing sets it.
		if state := cdsl.LiteralValue(a.Get("state")); state.Kind() == js.String && state.Str() != "" {
			props = append(props, "stateValue={st["+q(state.Str())+"]}",
				"setStateValue={(next: unknown) => setSt((p) => ({ ...p, "+q(state.Str())+": next }))}")
		}
	}
	return element(tag, key, props)
}

var formFields = map[string]bool{"TextField": true, "SearchField": true, "Checkbox": true, "SelectField": true}

// The widgets widgets.tsx draws.
var nativeWidgets = map[string]bool{
	"Scaffold": true, "ScrollView": true, "Column": true, "Row": true, "Flex": true, "Flexible": true, "Expanded": true,
	"Wrap": true, "Animate": true, "SizedBox": true, "Stack": true, "Positioned": true, "Grid": true, "Box": true,
	"Layers": true, "Layer": true, "Spacer": true, "Divider": true, "Text": true, "Image": true, "Icon": true,
	"Badge": true, "Button": true, "SubmitButton": true, "ResetButton": true, "TriggerButton": true, "Form": true,
	"TextField": true, "SearchField": true, "Checkbox": true, "SelectField": true, "SelectOption": true,
	"Drawer": true, "Carousel": true, "Tabs": true, "Tab": true,
	"Lottie": true, "GoogleMap": true,
}

// component places one of the project's own components.
func (e *emitter) component(node *cdsl.Expr, custom *definition, s scope, key string) string {
	e.addDependency(custom)
	actions := map[string]bool{}
	allowed := map[string]bool{"variant": true}
	for _, option := range allOptions(custom.analysis) {
		name := cdsl.LiteralValue(option.Arg("name")).String()
		allowed[name] = true
		if option.Name == "ActionOption" {
			actions[name] = true
		}
	}
	var values, handlers []string
	props := []string{}
	for _, name := range node.Args.Keys() {
		value := node.Args.Get(name)
		switch {
		case !allowed[name]:
			e.fail(value, node.Name+"."+name+" is not one of its options.")
		case name == "variant":
			props = append(props, "variant={rt.text("+e.expr(value, s)+")}")
		case actions[name]:
			handlers = append(handlers, q(name)+": "+e.callback(value, s))
		default:
			values = append(values, q(name)+": "+e.expr(value, s))
		}
	}
	if len(values) > 0 {
		props = append(props, "options={{ "+strings.Join(values, ", ")+" }}")
	}
	if len(handlers) > 0 {
		props = append(props, "actions={{ "+strings.Join(handlers, ", ")+" }}")
	}
	return element(custom.name, key, props)
}

func (e *emitter) addDependency(d *definition) {
	for _, existing := range e.deps {
		if existing == d {
			return
		}
	}
	e.deps = append(e.deps, d)
}

func allOptions(a *cdsl.Analysis) []*cdsl.Expr {
	out := append([]*cdsl.Expr{}, a.Options...)
	for _, v := range a.Variants {
		out = append(out, cdsl.CallItems(v.Arg("options"))...)
	}
	return out
}

func (e *emitter) defaults(options []*cdsl.Expr, s scope) []string {
	var out []string
	for _, option := range options {
		if option.Name == "ActionOption" {
			continue
		}
		out = append(out, q(cdsl.LiteralValue(option.Arg("name")).String())+": "+e.expr(option.Arg("default"), s))
	}
	return out
}

// tryEmit is emit, reporting an unsupported construct instead of panicking.
func (e *emitter) tryEmit() (source string, failure *unsupported) {
	defer func() {
		if r := recover(); r != nil {
			u, ok := r.(*unsupported)
			if !ok {
				panic(r)
			}
			failure = u
		}
	}()
	return e.emit(), nil
}

// emit writes the document's React component, with its imports.
func (e *emitter) emit() string {
	analysis := e.def.analysis
	root := scope{options: "o", aliases: map[string]string{}}
	type body struct{ id, code string }
	var bodies []body
	for _, variant := range analysis.Variants {
		local := cdsl.CallItems(variant.Arg("options"))
		s := root
		prelude := ""
		if len(local) > 0 {
			s = scope{options: "vo", aliases: root.aliases}
			prelude = "const vo: Record<string, unknown> = { ...o, " + strings.Join(e.defaults(local, root), ", ") + ", ...props.options };\n"
		}
		code := e.widget(variant.Arg("build"), s, "")
		bodies = append(bodies, body{cdsl.LiteralValue(variant.Arg("id")).String(), prelude + "return " + block(code) + ";"})
	}
	var render string
	switch len(bodies) {
	case 0:
		render = "return null;"
	case 1:
		render = bodies[0].code
	default:
		fallback := q(bodies[0].id)
		if dv := analysis.Root.Arg("defaultVariant"); dv != nil {
			fallback = "rt.text(" + e.expr(dv, root) + ")"
		}
		var cases []string
		for _, b := range bodies {
			cases = append(cases, "case "+q(b.id)+": {\n  "+indent(b.code)+"\n}")
		}
		render = "switch (props.variant || " + fallback + ") {\n  " + indent(strings.Join(cases, "\n")) + "\n  default:\n    return null;\n}"
	}
	var states []string
	for _, name := range analysis.States.Keys() {
		states = append(states, q(name)+": "+e.expr(analysis.States.Get(name), root))
	}
	// Only what the component reads: one without state has no useState, one
	// that reads no options no options, one that reads no data no bindings
	// (nor the hook they come from).
	options := "{ " + strings.Join(append(e.defaults(analysis.Options, root), "...props.options"), ", ") + " }"
	initial := "{ " + strings.Join(states, ", ") + " }"
	code := withoutStrings(render)
	needOptions := usesName(code, "o")
	needState := usesName(code, "st") || usesName(code, "setSt")
	read := code
	if needOptions {
		read += withoutStrings(options)
	}
	if needState {
		read += withoutStrings(initial)
	}
	needBindings := usesName(read, "b")
	needStudio := needBindings || usesMember(read, "s")
	fn := ""
	line := func(code string) { fn += "  " + code + "\n" }
	if needStudio {
		line("const s = rt.useStudio();")
	}
	if needBindings {
		line("const b = s.bindings;")
	}
	if needOptions {
		line("const o: Record<string, unknown> = " + options + ";")
	}
	if usesName(code, "act") {
		line("const act = props.actions ?? {};")
	}
	if needState {
		line("const [st, setSt] = useState<Record<string, unknown>>(() => (" + initial + "));")
	}
	fn += "  " + indent(render) + "\n"
	all := withoutStrings(fn)

	var head strings.Builder
	head.WriteString("// Generated by Upskale Studio. Edit the CDSL source instead.\n")
	head.WriteString("/* eslint-disable */\n")
	if needState {
		head.WriteString("import { useState } from \"react\";\n")
	}
	if usesMember(all, "rt") {
		head.WriteString("import * as rt from \"../studio/runtime\";\n")
	} else {
		// Its props are the runtime's type, and nothing else of it.
		head.WriteString("import type * as rt from \"../studio/runtime\";\n")
	}
	if usesMember(all, "W") {
		head.WriteString("import * as W from \"../studio/widgets\";\n")
	}
	modules := make([]string, 0, len(e.imports))
	for module := range e.imports {
		modules = append(modules, module)
	}
	sort.Strings(modules)
	for _, module := range modules {
		names := make([]string, 0, len(e.imports[module]))
		for name := range e.imports[module] {
			names = append(names, name)
		}
		sort.Strings(names)
		head.WriteString("import { " + strings.Join(names, ", ") + " } from " + q(module) + ";\n")
	}
	for _, dep := range e.deps {
		head.WriteString("import { " + dep.name + " } from " + q(relative(e.def.file, dep.file)) + ";\n")
	}
	head.WriteString("\n")
	component := "export function " + e.def.name + "(props: rt.ComponentProps) {\n" + fn + "}\n"
	return head.String() + component
}

// jsString is a string literal as the emitter writes one (q).
var jsString = regexp.MustCompile(`"(?:[^"\\\n]|\\.)*"`)

// withoutStrings is generated code with its string literals emptied, so a
// name inside one ("b", "options") isn't taken for a use of it.
func withoutStrings(code string) string { return jsString.ReplaceAllString(code, `""`) }

// usesName is whether code reads a variable: the name on its own, not a
// member (x.name) or part of a longer name.
func usesName(code, name string) bool {
	for from := 0; ; {
		i := strings.Index(code[from:], name)
		if i < 0 {
			return false
		}
		i += from
		end := i + len(name)
		before := i > 0 && (identByte(code[i-1]) || code[i-1] == '.')
		after := end < len(code) && identByte(code[end])
		if !before && !after {
			return true
		}
		from = i + 1
	}
}

// usesMember is whether code reads a member of a variable: name.x.
func usesMember(code, name string) bool {
	for from := 0; ; {
		i := strings.Index(code[from:], name+".")
		if i < 0 {
			return false
		}
		i += from
		if i == 0 || (!identByte(code[i-1]) && code[i-1] != '.') {
			return true
		}
		from = i + 1
	}
}

func identByte(c byte) bool {
	return c == '_' || c == '$' || c >= '0' && c <= '9' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
}

// relative is the import path of `to` from `from` (both src/…/x.tsx).
func relative(from, to string) string {
	fromDir := from[:strings.LastIndex(from, "/")]
	toDir := to[:strings.LastIndex(to, "/")]
	name := strings.TrimSuffix(to[strings.LastIndex(to, "/")+1:], ".tsx")
	if fromDir == toDir {
		return "./" + name
	}
	return "../" + toDir[strings.LastIndex(toDir, "/")+1:] + "/" + name
}

// tryRoute is pageRoute, reporting a problem with the page's data or SEO
// instead of panicking.
func (e *emitter) tryRoute(page dart.Page, padded bool) (source string, failure *unsupported) {
	defer func() {
		if r := recover(); r != nil {
			u, ok := r.(*unsupported)
			if !ok {
				panic(r)
			}
			failure = u
		}
	}()
	return e.pageRoute(page, padded), nil
}

// googleMap places the Library's GoogleMap: its markers as plain objects, its
// onMarkerTap a callback, and the project's display key (Config → Maps).
func (e *emitter) googleMap(node *cdsl.Expr, s scope, key string) string {
	a := node.Args
	props := []string{}
	for _, name := range []string{"latitude", "longitude", "zoom", "mapType", "height", "interactive"} {
		if a.Has(name) {
			props = append(props, prop(name, e.expr(a.Get(name), s)))
		}
	}
	if list := a.Get("markers"); list != nil {
		if list.Kind != cdsl.List {
			e.fail(list, "GoogleMap's markers are a list of MapMarker(...) items.")
		}
		var markers []string
		for _, marker := range list.Items {
			if marker.Kind != cdsl.Call || marker.Name != "MapMarker" {
				e.fail(marker, "GoogleMap's markers are MapMarker(...) items.")
			}
			var fields []string
			for _, name := range []string{"latitude", "longitude", "id", "title"} {
				if marker.Args.Has(name) {
					fields = append(fields, name+": "+e.expr(marker.Arg(name), s))
				}
			}
			markers = append(markers, "{ "+strings.Join(fields, ", ")+" }")
		}
		props = append(props, "markers={["+strings.Join(markers, ", ")+"]}")
	}
	if a.Has("onMarkerTap") {
		props = append(props, prop("onMarkerTap", e.callback(a.Get("onMarkerTap"), s)))
	}
	if k := e.in.Config.Field("googleMapsKey"); k != nil && k.String != "" {
		props = append(props, "apiKey={"+q(k.String)+"}")
	}
	return element("W.GoogleMap", key, props)
}
