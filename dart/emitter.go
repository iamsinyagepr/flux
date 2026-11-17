package dart

import (
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/config"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/registry"
)

type emitter struct {
	project      Project
	definition   *definition
	components   map[string]*definition
	index        int
	diagnostics  *[]Diagnostic
	shapes       map[*definition]shape
	dependencies []*definition // insertion-ordered set
	serial       int
	steps        int
	parts        map[string]bool
	shape        shape
	failure      *unsupported

	// ownSkeleton: the document draws its own loading state (worked out once).
	ownSkeleton *bool
}

func newEmitter(project Project, d *definition, components map[string]*definition, index int,
	diagnostics *[]Diagnostic, shapes map[*definition]shape) *emitter {
	return &emitter{project: project, definition: d, components: components, index: index,
		diagnostics: diagnostics, shapes: shapes, parts: map[string]bool{}, shape: fullShape()}
}

func (e *emitter) fail(node *cdsl.Expr, message string) {
	panic(&unsupported{node, message})
}

// tryEmit runs emit, reporting an Unsupported failure instead of panicking.
func (e *emitter) tryEmit() (source string, ok bool) {
	defer func() {
		if r := recover(); r != nil {
			u, isUnsupported := r.(*unsupported)
			if !isUnsupported {
				panic(r)
			}
			e.failure = u
			ok = false
		}
	}()
	return e.emit(), true
}

func (e *emitter) addDependency(d *definition) {
	for _, existing := range e.dependencies {
		if existing == d {
			return
		}
	}
	e.dependencies = append(e.dependencies, d)
}

func (e *emitter) integration(node *cdsl.Expr, name string) {
	for _, item := range *e.diagnostics {
		if item.DocumentID == e.definition.documentID && item.Code == "DART_INTEGRATION" && item.From == node.From {
			return
		}
	}
	*e.diagnostics = append(*e.diagnostics, Diagnostic{
		DocumentID: e.definition.documentID, Code: "DART_INTEGRATION", Severity: "warning",
		From: node.From, To: node.To,
		Message: name + " uses the StudioPlatform runtime integration. Supply its Flutter implementation in bindings['_studio'].",
	})
}

func (e *emitter) platformWidget(node *cdsl.Expr, s scope) string {
	entry := registry.Constructors[node.Name]
	e.integration(node, node.Name)
	var args []string
	for _, key := range node.Args.Keys() {
		value := node.Args.Get(key)
		t, ok := entry.Param(key)
		if !ok {
			t = "Any"
		}
		var code string
		switch {
		case strings.Contains(t, "List<Widget>") || strings.Contains(t, "List<Layer>") || strings.Contains(t, "List<Tab>"):
			code = "(BuildContext context) => " + e.children(value, s)
		case strings.Contains(t, "Widget"):
			code = "(BuildContext context) => " + e.widget(value, s)
		case t == "Action":
			code = e.callback(value, s)
		default:
			code = e.expr(value, s)
		}
		args = append(args, q(key)+": "+code)
	}
	return "StudioPlatformWidget(name: " + q(node.Name) + ", bindings: " + field("bindings") + ", arguments: {" + strings.Join(args, ", ") + "})"
}

func (e *emitter) args(node *cdsl.Expr, allowed string) {
	names := strings.Split(allowed, " ")
	for _, name := range node.Args.Keys() {
		if !contains(names, name) {
			e.fail(node.Args.Get(name), node.Name+"."+name+" is not supported by the Dart compiler yet.")
		}
	}
	if len(node.Positional) > 0 {
		e.fail(node, node.Name+" requires named arguments in generated widgets.")
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func (e *emitter) expr(node *cdsl.Expr, s scope) string {
	if node == nil {
		return "null"
	}
	e.steps++
	if e.steps > 30000 {
		e.fail(node, "Dart generation expansion limit exceeded.")
	}
	ex := func(x *cdsl.Expr) string { return e.expr(x, s) }
	switch node.Kind {
	case cdsl.Literal:
		if node.Segments != nil {
			parts := make([]string, len(node.Segments))
			for i, part := range node.Segments {
				if part.Expr == nil {
					parts[i] = q(part.Text)
				} else {
					parts[i] = "studioText(" + ex(part.Expr) + ")"
				}
			}
			return "[" + strings.Join(parts, ", ") + "].join()"
		}
		if node.Value.Kind() == js.String {
			return q(node.Value.Str())
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
		switch head {
		case "options":
			return "studioRead(" + s.options + ", " + js.StringifyList(path) + ")"
		case "state":
			return "studioRead(localState, " + js.StringifyList(path) + ")"
		case "event":
			return "studioRead(event, " + js.StringifyList(path) + ")"
		case "input":
			return "studioRead(event, " + js.StringifyList(append([]string{"input"}, path...)) + ")"
		}
		if alias := s.aliases[head]; alias != "" {
			if len(path) > 0 {
				return "studioRead(" + alias + ", " + js.StringifyList(path) + ")"
			}
			return alias
		}
		if head != "" && head[0] >= 'A' && head[0] <= 'Z' {
			return e.token(node)
		}
		// The customer's own (usingClient's Client.x()): read live.
		if client := cdsl.ClientImports(e.definition.analysis.Root)[head]; client != "" {
			read := "studioClient(context, " + field("bindings") + ", " + q(client) + ")"
			if len(path) > 0 {
				return "studioRead(" + read + ", " + js.StringifyList(path) + ")"
			}
			return read
		}
		return "studioRead(studioAmbient(context, " + field("bindings") + "), " + js.StringifyList(parts) + ")"
	case cdsl.Index:
		return "studioRead(" + ex(node.Target) + ", [" + ex(node.IndexExpr) + "])"
	case cdsl.Conditional:
		return "(studioTruthy(" + ex(node.Condition) + ") ? " + ex(node.Yes) + " : " + ex(node.No) + ")"
	case cdsl.Unary:
		if node.Op == "!" {
			return "!studioTruthy(" + ex(node.Child) + ")"
		}
		return "(-(" + ex(node.Child) + " as num))"
	case cdsl.Binary:
		left := ex(node.Left)
		return "studioBinary(" + q(node.Op) + ", " + left + ", () => " + ex(node.Right) + ")"
	case cdsl.Call:
		a := node.Args
		switch node.Name {
		case "Responsive":
			e.args(node, "base md lg")
			wide := a.Get("lg")
			if wide == nil {
				wide = a.Get("md")
			}
			if wide == nil {
				wide = a.Get("base")
			}
			middle := a.Get("md")
			if middle == nil {
				middle = a.Get("base")
			}
			w, m := ex(wide), ex(middle)
			return "(MediaQuery.sizeOf(context).width >= 1024 ? " + w + " : MediaQuery.sizeOf(context).width >= 768 ? " + m + " : " + ex(a.Get("base")) + ")"
		case "Insets":
			e.args(node, "top right bottom left x y")
			either := func(first, second string) *cdsl.Expr {
				if v := a.Get(first); v != nil {
					return v
				}
				return a.Get(second)
			}
			values := []*cdsl.Expr{either("left", "x"), either("top", "y"), either("right", "x"), either("bottom", "y")}
			out := make([]string, 4)
			for i, v := range values {
				if v != nil {
					out[i] = "studioNumber(" + ex(v) + ")"
				} else {
					out[i] = "0"
				}
			}
			return "EdgeInsets.fromLTRB(" + strings.Join(out, ", ") + ")"
		case "Gradient":
			e.args(node, "from to via style begin end")
			stops := []*cdsl.Expr{a.Get("from")}
			if via := a.Get("via"); via != nil && via.Kind == cdsl.List {
				stops = append(stops, via.Items...)
			}
			stops = append(stops, a.Get("to"))
			colors := make([]string, len(stops))
			for i, stop := range stops {
				colors[i] = "studioPaint(" + ex(stop) + ")"
			}
			list := "[" + strings.Join(colors, ", ") + "]"
			style := "GradientStyle.linear"
			if s := a.Get("style"); s != nil && s.Kind == cdsl.Ref {
				style = s.Name
			}
			switch style {
			case "GradientStyle.radial":
				return "RadialGradient(colors: " + list + ")"
			case "GradientStyle.sweep":
				return "SweepGradient(colors: " + list + ")"
			}
			begin, end := "Alignment.topCenter", "Alignment.bottomCenter"
			if a.Has("begin") {
				begin = ex(a.Get("begin"))
			}
			if a.Has("end") {
				end = ex(a.Get("end"))
			}
			return "LinearGradient(colors: " + list + ", begin: " + begin + ", end: " + end + ")"
		case "Border":
			e.args(node, "width color")
			width := ex(a.Get("width"))
			color := "studioColor(context, 'border')"
			if a.Has("color") {
				color = ex(a.Get("color"))
			}
			return "Border.all(width: studioNumber(" + width + "), color: studioPaint(" + color + "))"
		case "isMobile", "isTablet", "isDesktop":
			e.args(node, "")
			return map[string]string{
				"isMobile":  "(MediaQuery.sizeOf(context).width < 768)",
				"isTablet":  "(MediaQuery.sizeOf(context).width >= 768 && MediaQuery.sizeOf(context).width < 1024)",
				"isDesktop": "(MediaQuery.sizeOf(context).width >= 1024)",
			}[node.Name]
		}
		if registry.Functions[node.Name] != nil {
			args := make([]string, len(node.Positional))
			for i, p := range node.Positional {
				args[i] = ex(p)
			}
			return "studioFunction(context, studioAmbient(context, " + field("bindings") + "), " + q(node.Name) + ", [" + strings.Join(args, ", ") + "])"
		}
		if c := registry.Constructors[node.Name]; (c != nil && c.Group == "Actions") || node.Name == "Asset" {
			var entries []string
			for _, key := range a.Keys() {
				entries = append(entries, q(key)+": "+ex(a.Get(key)))
			}
			return "StudioValue(" + q(node.Name) + ", {" + strings.Join(entries, ", ") + "})"
		}
		e.fail(node, node.Name+"() is not supported in Dart expressions yet.")
	}
	return ""
}

var (
	sizeGroups = map[string]string{"Space": "spacing", "Radius": "radii", "FontSize": "fontSizes", "Size": "iconSizes"}
	enums      = map[string]string{
		"Axis.horizontal": "Axis.horizontal", "Axis.vertical": "Axis.vertical",
		"FontWeight.regular": "FontWeight.w400", "FontWeight.medium": "FontWeight.w500",
		"FontWeight.semibold": "FontWeight.w600", "FontWeight.bold": "FontWeight.w700",
		"Fit.cover": "BoxFit.cover", "Fit.contain": "BoxFit.contain", "Fit.fill": "BoxFit.fill",
	}
	families = map[string]string{
		"MainAxisAlignment": "MainAxisAlignment", "CrossAxisAlignment": "CrossAxisAlignment",
		"MainAxisSize": "MainAxisSize", "FlexFit": "FlexFit", "StackFit": "StackFit",
		"WrapAlignment": "WrapAlignment", "WrapCrossAlignment": "WrapCrossAlignment", "Anchor": "Alignment",
		"FontStyle": "FontStyle", "TextAlign": "TextAlign", "TextDecoration": "TextDecoration",
		"TextDecorationStyle": "TextDecorationStyle", "TextOverflow": "TextOverflow",
		"TextDirection": "TextDirection", "BoxShape": "BoxShape", "Curve": "Curves",
	}
	anchors = map[string]string{"top": "topCenter", "bottom": "bottomCenter", "left": "centerLeft", "right": "centerRight"}
	aligns  = map[string]string{"start": "CrossAxisAlignment.start", "center": "CrossAxisAlignment.center",
		"end": "CrossAxisAlignment.end", "stretch": "CrossAxisAlignment.stretch"}
	justifies = map[string]string{"start": "MainAxisAlignment.start", "center": "MainAxisAlignment.center",
		"end": "MainAxisAlignment.end", "between": "MainAxisAlignment.spaceBetween",
		"around": "MainAxisAlignment.spaceAround", "evenly": "MainAxisAlignment.spaceEvenly"}
	libraries = map[string]string{"material": "MaterialIcons", "feather": "FeatherIcons", "bootstrap": "BootstrapIcons"}
	// The exact glyphs the preview draws for each library (StudioIcon.tsx),
	// from upskaleapp's lib/studio/iconCatalog.ts by way of registry.json.
	glyphs = registry.IconGlyphs
)

func (e *emitter) token(node *cdsl.Expr) string {
	parts := strings.SplitN(node.Name, ".", 3)
	family, key := parts[0], ""
	if len(parts) > 1 {
		key = parts[1]
	}
	if family == "Route" {
		return "studioRoute(" + q(key) + ")"
	}
	if group, ok := sizeGroups[family]; ok {
		if value, found := e.configNumber(group, key); found {
			if js.IsInteger(value) {
				return js.NumberString(value) + ".0"
			}
			return js.NumberString(value)
		}
	}
	if family == "Color" {
		colors := e.project.Config.Field("colors")
		if registry.IsColorVariable(key) || (colors.IsObject() && colors.Object.Has(key)) {
			// Baked in only when the app has a single (light) theme; with a
			// dark one too, read from the active theme so switching repaints it.
			override := colors.Field(key)
			if config.UsesDarkTheme(e.project.Config) {
				override = nil
			}
			if override != nil && override.Value().Truthy() {
				return "const Color(0xff" + js.Slice(override.Value().String(), 1, js.Len(override.Value().String())) + ")"
			}
			return "studioColor(context, " + q(key) + ")"
		}
	}
	// A shadow is its token's name; studioBoxShadow/studioTextShadows draw it.
	// So is an Animate effect (StudioAnimate reads it).
	if family == "Shadow" || family == "Effect" {
		return q(key)
	}
	if code, ok := enums[node.Name]; ok {
		return code
	}
	if family == "Anchor" {
		if mapped, ok := anchors[key]; ok {
			return "Alignment." + mapped
		}
		return "Alignment." + key
	}
	if code, ok := families[family]; ok {
		return code + "." + key
	}
	if family == "Align" {
		if code, ok := aligns[key]; ok {
			return code
		}
		e.fail(node, "Unsupported alignment: "+key)
	}
	if family == "Justify" {
		if code, ok := justifies[key]; ok {
			return code
		}
		e.fail(node, "Unsupported justification: "+key)
	}
	library := family
	if family == "Icons" {
		chosen := "material"
		if lib := e.project.Config.Field("iconLibrary"); lib != nil && !lib.Value().IsNullish() {
			chosen = lib.Value().String()
		}
		library = libraries[chosen]
	}
	if library != "" {
		if glyph := glyphs[library][key]; glyph != "" {
			return glyph
		}
	}
	if registry.InFamily(family, key) {
		return q(key)
	}
	e.fail(node, "Token "+node.Name+" is not supported by the Dart compiler yet.")
	return ""
}

// configNumber is config[group][key] ?? sizeDefaults[group][key].
func (e *emitter) configNumber(group, key string) (float64, bool) {
	if value := e.project.Config.Field(group).Field(key); value != nil && !value.Value().IsNullish() {
		return value.Number, true
	}
	return registry.SizeDefault(group, key)
}

func (e *emitter) action(node *cdsl.Expr, s scope) string {
	if node == nil {
		return ""
	}
	ex := func(x *cdsl.Expr) string { return e.expr(x, s) }
	if node.Kind == cdsl.Ref && strings.HasPrefix(node.Name, "options.") {
		return field("actions") + "[" + q(node.Name[8:]) + "]?.call(event);"
	}
	// One action or another, as the checker allows: signedIn ? PlaceOrder(…) : SetState(…).
	if node.Kind == cdsl.Conditional {
		return "if (studioTruthy(" + e.expr(node.Condition, s) + ")) { " + e.action(node.Yes, s) + " } else { " + e.action(node.No, s) + " }"
	}
	// null: nothing, the other side of a conditional action.
	if node.Kind == cdsl.Literal && node.Value.IsNull() {
		return ""
	}
	if node.Kind != cdsl.Call {
		e.fail(node, "This Dart action must be a callback or action constructor.")
	}
	a := node.Args
	switch node.Name {
	case "Actions":
		e.args(node, "actions")
		actions := a.Get("actions")
		if actions == nil || actions.Kind != cdsl.List {
			e.fail(node, "Actions requires a literal list.")
		}
		steps := make([]string, len(actions.Items))
		for i, step := range actions.Items {
			steps[i] = e.action(step, s)
		}
		return strings.Join(steps, "\n")
	case "SetState":
		e.args(node, "state value")
		name := cdsl.LiteralValue(a.Get("state")).String()
		return "setState(() { localState[" + q(name) + "] = " + ex(a.Get("value")) + "; });"
	case "Toggle":
		e.args(node, "state")
		first := ex(a.Get("state"))
		second := ex(a.Get("state"))
		return "setState(() { localState[" + first + "] = !studioTruthy(localState[" + second + "]); });"
	case "RunAction":
		e.args(node, "action value")
		target := a.Get("action")
		if target == nil || target.Kind != cdsl.Ref || !strings.HasPrefix(target.Name, "options.") {
			e.fail(node, "RunAction requires an ActionOption reference.")
		}
		value := "event"
		if a.Has("value") {
			value = "{...event, 'value': " + ex(a.Get("value")) + "}"
		}
		return field("actions") + "[" + q(target.Name[8:]) + "]?.call(" + value + ");"
	case "ShowMessage":
		e.args(node, "message")
		return "ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(studioText(" + ex(a.Get("message")) + "))));"
	case "SubmitForm", "ResetForm":
		// The form it names (Form id), or else the one around it.
		e.args(node, "form")
		form := "''"
		if a.Has("form") {
			form = "studioText(" + ex(a.Get("form")) + ")"
		}
		method := "submit"
		if node.Name == "ResetForm" {
			method = "reset"
		}
		return "studioForm(context, " + form + ")?." + method + "();"
	case "ScrollTo":
		// Brings the Box with this id into view (StudioAnchor).
		e.args(node, "id")
		return "studioScrollTo(studioText(" + ex(a.Get("id")) + "));"
	case "Navigate":
		e.args(node, "to search")
		if search := a.Get("search"); search.IsCall("Search") {
			// Its search params, handed to the page it opens (StudioPageData's query).
			var entries []string
			for _, key := range search.Args.Keys() {
				entries = append(entries, q(key)+": "+ex(search.Args.Get(key)))
			}
			return "studioNavigate(context, " + ex(a.Get("to")) + ", <String, dynamic>{" + strings.Join(entries, ", ") + "});"
		}
		return "studioNavigate(context, " + ex(a.Get("to")) + ");"
	}
	if c := registry.Constructors[node.Name]; c != nil && c.Group == "Actions" {
		e.integration(node, node.Name)
		var entries []string
		for _, key := range a.Keys() {
			entries = append(entries, q(key)+": "+ex(a.Get(key)))
		}
		return "studioPlatform(" + field("bindings") + ").runAction(context, " + q(node.Name) + ", {" +
			strings.Join(entries, ", ") + "}, event, studioAmbient(context, " + field("bindings") + "));"
	}
	e.fail(node, node.Name+" is not supported by the Dart action compiler yet.")
	return ""
}

func (e *emitter) callback(node *cdsl.Expr, s scope) string {
	return "(event) { " + e.action(node, s) + " }"
}

var eventWord = regexp.MustCompile(`\bevent\b`)

// handler is a tap handler: the action's statements, declaring an empty
// event only when the action reads one.
func (e *emitter) handler(node *cdsl.Expr, s scope) string {
	body := e.action(node, s)
	if eventWord.MatchString(body) {
		return "() { final event = <String, dynamic>{}; " + body + " }"
	}
	return "() { " + body + " }"
}

// children is a widget's children. lazy where the parent lays its children
// out without looking at their type (a grid, a wrap, a vertical column):
// there a storefront list's items are built as they scroll near.
func (e *emitter) children(node *cdsl.Expr, s scope, lazy ...bool) string {
	builtLazily := len(lazy) > 0 && lazy[0]
	if node == nil || node.Kind != cdsl.List {
		target := node
		if target == nil {
			target = e.definition.analysis.Root
		}
		e.fail(target, "Dart widget children must be a literal list.")
	}
	items := make([]string, 0, len(node.Items))
	for _, item := range node.Items {
		if item.IsCall("ForEach") {
			e.args(item, "items as indexAs limit child empty")
			seq := "items" + strconv.Itoa(e.serial)
			e.serial++
			idx := "index" + strconv.Itoa(e.serial)
			e.serial++
			aliases := make(map[string]string, len(s.aliases)+2)
			for k, v := range s.aliases {
				aliases[k] = v
			}
			aliases[cdsl.LiteralValue(item.Arg("as")).String()] = seq + "[" + idx + "]"
			if item.Arg("indexAs") != nil {
				aliases[cdsl.LiteralValue(item.Arg("indexAs")).String()] = idx
			}
			list := e.expr(item.Arg("items"), s)
			limit := "50"
			if item.Arg("limit") != nil {
				limit = e.expr(item.Arg("limit"), s)
			}
			loading := e.loading(item, s, seq)
			empty := ""
			if item.Arg("empty") != nil {
				empty = "if (" + seq + ".isEmpty) " + e.widget(item.Arg("empty"), s) + ","
			}
			child := e.widget(item.Arg("child"), scope{options: s.options, aliases: aliases})
			if builtLazily {
				child = e.lazyItem(item, s, idx, child)
			}
			items = append(items, "...(() { final "+seq+" = studioItems("+list+", "+limit+");\n          "+loading+"return <Widget>["+empty+"\n            for (var "+idx+" = 0; "+idx+" < "+seq+".length; "+idx+"++) "+child+"]; })()")
			continue
		}
		if item.IsCall("If") {
			e.args(item, "condition then else")
			condition := e.expr(item.Arg("condition"), s)
			then := e.widget(item.Arg("then"), s)
			otherwise := ""
			if item.Arg("else") != nil {
				otherwise = " else " + e.widget(item.Arg("else"), s)
			}
			items = append(items, "if (studioTruthy("+condition+")) "+then+otherwise)
			continue
		}
		items = append(items, e.widget(item, s))
	}
	return "<Widget>[" + strings.Join(items, ",\n") + "]"
}

// lazyItem is a ForEach item built when it scrolls near, when its list is
// the storefront's (long: stores, a menu, orders) and wrapping it keeps its
// layout: not something its column sizes by type.
func (e *emitter) lazyItem(item *cdsl.Expr, s scope, index, code string) string {
	if loadingSource(item.Arg("items"), s.aliases) == "" {
		return code
	}
	child := item.Arg("child")
	if child == nil || child.Kind != cdsl.Call {
		return code
	}
	switch child.Name {
	case "Expanded", "Flexible", "Spacer", "Positioned", "If":
		return code
	case "Box":
		if child.Arg("width") != nil || child.Arg("height") != nil {
			return code
		}
	}
	return "StudioLazyItem(index: " + index + ", builder: (context) => " + code + ")"
}

// loading is, while the storefront fetches a ForEach's remote items, the
// item in outline (skeletons.go), unless the page draws a skeleton of its own.
func (e *emitter) loading(item *cdsl.Expr, s scope, seq string) string {
	source := loadingSource(item.Arg("items"), s.aliases)
	if source == "" {
		return ""
	}
	if e.ownSkeleton == nil {
		own := hasOwnSkeleton(e.definition.analysis)
		e.ownSkeleton = &own
	}
	if *e.ownSkeleton {
		return ""
	}
	skeleton := skeletonOf(item.Arg("child"), e.definition.analysis, func(name string) *cdsl.Analysis {
		if d := e.components[name]; d != nil {
			return d.analysis
		}
		return nil
	})
	if skeleton == nil {
		return ""
	}
	count := float64(skeletonCount)
	if limit := cdsl.LiteralValue(item.Arg("limit")); limit.Kind() == js.Number {
		count = limit.Num()
	}
	count = math.Max(1, math.Min(skeletonCount, count))
	i := "skeleton" + strconv.Itoa(e.serial)
	e.serial++
	return "if (" + seq + ".isEmpty && studioLoading(context, " + field("bindings") + ", " + q(source) + ")) {\n" +
		"      return <Widget>[for (var " + i + " = 0; " + i + " < " + js.NumberString(count) + "; " + i + "++) StudioSkeletonGroup(child: " + e.widget(skeleton, s) + ")];\n" +
		"    }\n    "
}

func (e *emitter) widget(node *cdsl.Expr, s scope) (code string) {
	if node == nil {
		return "const SizedBox.shrink()"
	}
	e.steps++
	if e.steps > 30000 {
		e.fail(node, "Dart generation expansion limit exceeded.")
	}
	if node.Kind != cdsl.Call {
		e.fail(node, "Expected a widget constructor.")
	}
	result := e.widgetOrPlatform(node, s)
	return "\n// @cdsl " + strconv.Itoa(e.index) + " " + strconv.Itoa(node.From) + " " + strconv.Itoa(node.To) + "\n" + result + "\n// @cdsl-end\n"
}

// widgetOrPlatform falls back to the StudioPlatform integration when a
// built-in widget can't be compiled natively.
func (e *emitter) widgetOrPlatform(node *cdsl.Expr, s scope) (result string) {
	failed := false
	func() {
		defer func() {
			if r := recover(); r != nil {
				_, isUnsupported := r.(*unsupported)
				custom, isComponent := e.components[node.Name]
				if !isUnsupported || registry.Constructors[node.Name] == nil || (isComponent && custom != e.definition) {
					panic(r)
				}
				failed = true
			}
		}()
		result = e.widgetCall(node, s)
	}()
	if failed {
		result = e.platformWidget(node, s)
	}
	return result
}

func (e *emitter) defaults(options []*cdsl.Expr, s scope) string {
	var out []string
	for _, option := range options {
		if option.Name == "ActionOption" {
			continue
		}
		out = append(out, q(optionName(option))+": "+e.expr(option.Arg("default"), s))
	}
	return strings.Join(out, ", ")
}

// emit writes the widget class with only what its body uses.
func (e *emitter) emit() string {
	analysis, className := e.definition.analysis, e.definition.className
	root := scope{options: optionsMark, aliases: map[string]string{}}
	rootDefaults := e.defaults(analysis.Options, root)
	type body struct{ id, code string }
	var bodies []body
	for _, variant := range analysis.Variants {
		local := cdsl.CallItems(variant.Arg("options"))
		options := optionsMark
		if len(local) > 0 {
			options = "variantOptions"
		}
		code := e.widget(variant.Arg("build"), scope{options: options, aliases: root.aliases})
		localDefaults := ""
		if len(local) > 0 {
			localDefaults = e.defaults(local, root)
		}
		prelude := ""
		if strings.Contains(code, "variantOptions") {
			var spread []string
			if rootDefaults != "" {
				spread = append(spread, "..."+optionsMark)
			}
			if localDefaults != "" {
				spread = append(spread, localDefaults)
			}
			spread = append(spread, "..."+field("options"))
			prelude = "final variantOptions = <String, dynamic>{" + strings.Join(spread, ", ") + "};\n"
		}
		bodies = append(bodies, body{cdsl.LiteralValue(variant.Arg("id")).String(), prelude + "return " + code + ";"})
	}
	multiple := len(bodies) > 1
	var code string
	switch {
	case multiple:
		fallback := ""
		if dv := analysis.Root.Arg("defaultVariant"); dv != nil {
			fallback = e.expr(dv, root)
		} else {
			fallback = q(bodies[0].id)
		}
		cases := make([]string, len(bodies))
		for i, b := range bodies {
			cases[i] = "case " + q(b.id) + ": {\n" + b.code + "\n}"
		}
		code = "switch (" + field("variant") + " ?? " + fallback + ") {\n" + strings.Join(cases, "\n") +
			"\ndefault: throw StateError('Unknown variant: ${" + field("variant") + "}');\n}"
	case len(bodies) == 1:
		code = bodies[0].code
	default:
		code = "return const SizedBox.shrink();"
	}
	if strings.Contains(code, optionsMark) {
		if rootDefaults != "" {
			code = "final optionValues = <String, dynamic>{" + rootDefaults + ", ..." + field("options") + "};\n" + code
			code = strings.ReplaceAll(code, optionsMark, "optionValues")
		} else {
			code = strings.ReplaceAll(code, optionsMark, field("options"))
		}
	}
	stateful := analysis.States.Len() > 0
	uses := func(name string) bool { return strings.Contains(code, field(name)) }
	e.shape = shape{variants: multiple, stateful: stateful, options: uses("options"), actions: uses("actions"), bindings: uses("bindings")}
	widgetField := ""
	if stateful {
		widgetField = "widget."
	}
	code = strings.ReplaceAll(code, fieldMark, widgetField)
	parameters := []string{"super.key"}
	var fields []string
	if multiple {
		parameters = append(parameters, "this.variant")
		fields = append(fields, "final String? variant;")
	}
	if e.shape.options {
		parameters = append(parameters, "this.options = const {}")
		fields = append(fields, "final Map<String, dynamic> options;")
	}
	if e.shape.actions {
		parameters = append(parameters, "this.actions = const {}")
		fields = append(fields, "final Map<String, StudioAction> actions;")
	}
	if e.shape.bindings {
		parameters = append(parameters, "this.bindings = const {}")
		fields = append(fields, "final Map<String, dynamic> bindings;")
	}
	constructor := "const " + className + "({" + strings.Join(parameters, ", ") + "});"
	build := "@override\n  Widget build(BuildContext context) {\n" + code + "\n  }"
	fills := len(analysis.Variants) > 0
	for _, variant := range analysis.Variants {
		b := variant.Arg("build")
		if !(b != nil && b.Kind == cdsl.Call && b.Name == "Box" && b.Arg("onTap") != nil && b.Arg("width") == nil) {
			fills = false
		}
	}
	fill, fillGetter := "", ""
	if fills {
		fill, fillGetter = " implements StudioFill", "@override bool get fill => true;"
	}
	fieldLines := strings.Join(fields, "\n")
	if !stateful {
		return "class " + className + " extends StatelessWidget" + fill + " {\n  " + constructor + "\n  " +
			fieldLines + "\n  " + fillGetter + "\n  " + build + "\n}"
	}
	var states []string
	for _, name := range analysis.States.Keys() {
		states = append(states, q(name)+": "+e.expr(analysis.States.Get(name), root))
	}
	return "class " + className + " extends StatefulWidget" + fill + " {\n  " + constructor + "\n  " +
		fieldLines + "\n  " + fillGetter + "\n  @override\n  State<" + className + "> createState() => _" +
		className + "State();\n}\nclass _" + className + "State extends State<" + className + "> {\n" +
		"  final Map<String, dynamic> localState = {" + strings.Join(states, ", ") + "};\n  " + build + "\n}"
}
