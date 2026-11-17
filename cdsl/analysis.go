package cdsl

import (
	"regexp"
	"strings"

	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/registry"
)

// NamedExprs is an insertion-ordered name → expression map with JS Map
// semantics: setting an existing name replaces its value in place.
type NamedExprs struct {
	keys  []string
	items map[string]*Expr
}

func (m *NamedExprs) Set(name string, e *Expr) {
	if m.items == nil {
		m.items = map[string]*Expr{}
	}
	if _, ok := m.items[name]; !ok {
		m.keys = append(m.keys, name)
	}
	m.items[name] = e
}
func (m *NamedExprs) Get(name string) *Expr { return m.items[name] }
func (m *NamedExprs) Has(name string) bool  { _, ok := m.items[name]; return ok }
func (m *NamedExprs) Keys() []string        { return m.keys }
func (m *NamedExprs) Len() int              { return len(m.keys) }

// Analysis is analyzeSource's result.
type Analysis struct {
	Source      string
	Root        *Expr
	Diagnostics []Diagnostic
	Variants    []*Expr
	Options     []*Expr
	Parts       NamedExprs
	States      NamedExprs
	Name        string
}

var (
	inputName    = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]{0,59}$`)
	identifier   = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
	componentID  = regexp.MustCompile(`^[a-z0-9-]+/[a-z0-9-]+$`)
	widgetGroups = []string{"Layout", "Content", "Behavior", "Composition", "Storefront", "Storefront controls", "Components", "Forms", "Library"}
	protoNames   = map[string]bool{"__proto__": true, "prototype": true, "constructor": true}
	stateTypes   = map[string]string{"BoolState": "boolean", "StringState": "string", "NumberState": "number"}
	formFields   = map[string]bool{"TextField": true, "SearchField": true, "Checkbox": true, "SelectField": true}
)

// ValidInputName is formRuntime's validInputName.
func ValidInputName(name string) bool {
	return inputName.MatchString(name) && !protoNames[name]
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// Context is what analysis checks a source against.
type Context struct {
	// Components are the project's own components, by name.
	Components map[string]*registry.Entry
	// Current is the component being analysed (it may shadow a built-in).
	Current string
	// CustomTokens returns the project's own token names for a family.
	CustomTokens func(family string) []string
	// Data are a page's imports (its Data settings) by name, with their
	// types: names its CDSL may read (pagedata.ImportScope).
	Data map[string]string
}

func (c Context) customTokens(family string) []string {
	if c.CustomTokens == nil {
		return nil
	}
	return c.CustomTokens(family)
}

// AnalyzeSource parses a source and checks it, as the editor does.
func AnalyzeSource(source string, ctx Context) *Analysis {
	parsed := ParseSource(source)
	result := &Analysis{Source: source, Root: parsed.Root, Diagnostics: parsed.Diagnostics}
	root := parsed.Root
	if root == nil {
		return result
	}
	issue := func(node *Expr, message string) {
		if len(result.Diagnostics) < 60 {
			result.Diagnostics = append(result.Diagnostics, Diagnostic{
				Code: "local-check", Severity: "error", Message: message, From: node.From, To: node.To,
			})
		}
	}
	// A Page (page.go): its one build is presented as a variant, so the
	// compilers read a page as they read a component; it has no options.
	isPage := root.Name == "Page"
	if isPage {
		if variant := pageVariant(root); variant != nil {
			result.Variants = append(result.Variants, variant)
		}
	} else {
		for _, node := range ListItems(root.Arg("variants")) {
			if node.IsCall("Variant") {
				result.Variants = append(result.Variants, node)
			}
		}
		for _, node := range ListItems(root.Arg("options")) {
			if node.Kind == Call && strings.HasSuffix(node.Name, "Option") {
				result.Options = append(result.Options, node)
			}
		}
	}
	result.Name = Text(root.Arg("name"))
	for _, part := range ListItems(root.Arg("parts")) {
		if part.IsCall("Part") && part.Arg("build") != nil {
			name := Text(part.Arg("name"))
			if result.Parts.Has(name) {
				issue(part, "Duplicate part: "+name)
			}
			result.Parts.Set(name, part.Arg("build"))
		}
	}
	for _, state := range ListItems(root.Arg("states")) {
		expected, isState := stateTypes[state.Name]
		if state.Kind != Call || !isState || state.Arg("default") == nil {
			continue
		}
		name := Text(state.Arg("name"))
		if !ValidInputName(name) {
			issue(state, "State names must be valid identifiers.")
		}
		if result.States.Has(name) {
			issue(state, "Duplicate state: "+name)
		}
		got := "undefined"
		if state.Name == "NumberState" {
			if _, ok := NumericLiteral(state.Arg("default")); ok {
				got = "number"
			}
		} else {
			got = LiteralValue(state.Arg("default")).TypeOf()
		}
		if got != expected {
			issue(state, "State defaults must match their declared primitive type.")
		}
		result.States.Set(name, state.Arg("default"))
	}

	// --- forms ------------------------------------------------------------------
	formIDs := map[string]bool{}
	type form struct{ names map[string]bool }
	var checkForms func(node *Expr, active *form, sel bool)
	checkForms = func(node *Expr, active *form, sel bool) {
		if node.Kind != Call {
			for _, child := range Children(node) {
				checkForms(child, active, sel)
			}
			return
		}
		if node.Name == "Variant" {
			formIDs = map[string]bool{}
		}
		if node.Name == "Form" {
			id := Text(node.Arg("id"))
			if !ValidInputName(id) {
				issue(node, "Form IDs must be valid identifiers.")
			}
			if formIDs[id] {
				issue(node, "Duplicate form ID: "+id)
			}
			formIDs[id] = true
			if active != nil {
				issue(node, "Forms cannot be nested.")
			}
			active = &form{names: map[string]bool{}}
		}
		if formFields[node.Name] {
			name := Text(node.Arg("name"))
			if name == "" {
				name = Text(node.Arg("state"))
			}
			bound := Text(node.Arg("state"))
			if (active != nil || node.Arg("name") != nil || node.Arg("state") != nil) && !ValidInputName(name) {
				issue(node, "Fields need a valid name or state binding.")
			}
			if active != nil && active.names[name] {
				issue(node, "Duplicate form field: "+name)
			}
			if active != nil {
				active.names[name] = true
			}
			if node.Arg("label") == nil && node.Arg("ariaLabel") == nil {
				issue(node, "Fields need label or ariaLabel.")
			}
			if node.Arg("state") != nil && !result.States.Has(bound) {
				issue(node, "Unknown state binding: "+bound)
			}
			if def := result.States.Get(bound); bound != "" && def != nil {
				expected := "string"
				if node.Name == "Checkbox" {
					expected = "boolean"
				} else if t := node.Arg("type"); t != nil && t.Kind == Ref && t.Name == "InputType.number" {
					expected = "number"
				}
				got := LiteralValue(def).TypeOf()
				if expected == "number" {
					got = "undefined"
					if _, ok := NumericLiteral(def); ok {
						got = "number"
					}
				}
				if got != expected {
					issue(node, "Input type does not match the bound state.")
				}
			}
			for _, key := range []string{"minLength", "maxLength", "rows"} {
				value, ok := NumericLiteral(node.Arg(key))
				low, high := 1.0, 8000.0
				if key == "minLength" {
					low = 0
				}
				if key == "rows" {
					high = 12
				}
				if ok && (!js.IsInteger(value) || value < low || value > high) {
					issue(node, key+" is outside the supported range.")
				}
			}
			for _, pair := range [][2]string{{"minLength", "maxLength"}, {"min", "max"}} {
				a, okA := NumericLiteral(node.Arg(pair[0]))
				b, okB := NumericLiteral(node.Arg(pair[1]))
				if okA && okB && a > b {
					issue(node, pair[0]+" must not exceed "+pair[1]+".")
				}
			}
		}
		if (node.Name == "SubmitButton" || node.Name == "ResetButton") && active == nil {
			issue(node, node.Name+" must be inside Form.")
		}
		if node.Name == "SelectOption" && !sel {
			issue(node, "SelectOption must be inside SelectField.options.")
		}
		if node.Name == "SetState" || node.Name == "Toggle" {
			name := Text(node.Arg("state"))
			switch {
			case !result.States.Has(name):
				issue(node, "Unknown state binding: "+name)
			case node.Name == "Toggle" && LiteralValue(result.States.Get(name)).TypeOf() != "boolean":
				issue(node, "Toggle needs a BoolState.")
			case node.Name == "SetState":
				assigned := LiteralValue(node.Arg("value"))
				initial := LiteralValue(result.States.Get(name))
				initialType := initial.TypeOf()
				if initial.IsNullish() {
					initialType = "undefined"
					if _, ok := NumericLiteral(result.States.Get(name)); ok {
						initialType = "number"
					}
				}
				if !assigned.IsNullish() && assigned.TypeOf() != initialType {
					issue(node, "SetState value does not match the declared state.")
				}
			}
		}
		if actions := node.Arg("actions"); node.Name == "Actions" && actions != nil && actions.Kind == List && len(actions.Items) > 20 {
			issue(node, "Actions supports up to 20 steps.")
		}
		for _, key := range node.Args.Keys() {
			checkForms(node.Args.Get(key), active, sel || (node.Name == "SelectField" && key == "options"))
		}
		for _, child := range node.Positional {
			checkForms(child, active, sel)
		}
	}
	checkForms(root, nil, false)

	// --- references, parameters and placement ---------------------------------
	actionOptions := map[string]bool{}
	collectActions := func(options []*Expr) {
		for _, option := range options {
			if option.IsCall("ActionOption") {
				actionOptions[Text(option.Arg("name"))] = true
			}
		}
	}
	collectActions(result.Options)
	for _, variant := range result.Variants {
		collectActions(ListItems(variant.Arg("options")))
	}
	var isAction func(node *Expr) bool
	isAction = func(node *Expr) bool {
		switch node.Kind {
		case Literal:
			return node.Value.IsNull()
		case Ref:
			return strings.HasPrefix(node.Name, "options.") && actionOptions[node.Name[8:]]
		case Conditional:
			return isAction(node.Yes) && isAction(node.No)
		case Call:
			entry := registry.Constructors[node.Name]
			return entry != nil && entry.Group == "Actions"
		}
		return false
	}
	base := rootScope()
	for name, t := range ctx.Data {
		base[name] = registry.ScopeEntry{Type: t}
	}
	// A component's usingClient: the customer's own data, nothing fetched.
	if !isPage && root.Arg("data") != nil {
		for _, item := range ListItems(root.Arg("data")) {
			from := item.Arg("from")
			if item.Kind != Call || from == nil || from.Kind != Call || !strings.HasPrefix(from.Name, "Client.") {
				result.Diagnostics = append(result.Diagnostics, Diagnostic{Code: "page-data", Severity: "error",
					Message: "A component imports only the customer's own data (Client.cart(), Client.store(), …): pass anything else in as an option.", From: item.From, To: item.To})
			}
		}
		for name, resource := range ClientImports(root) {
			base[name] = registry.ScopeEntry{Type: ClientResources[resource]}
		}
	}
	base["viewport"] = registry.ScopeEntry{IsList: true, Fields: []string{"width", "height"}}
	base["route"] = registry.ScopeEntry{IsList: true, Fields: []string{"path", "pattern", "pageId"}}
	// Options in scope by their type: a DataOption's is its data type.
	typedOptions := map[string]string{}
	for _, option := range result.Options {
		t := dataOptionType(option)
		if t == "" {
			t = "unknown"
		}
		typedOptions[Text(option.Arg("name"))] = t
	}
	base["options"] = registry.ScopeEntry{Typed: typedOptions}
	base["state"] = registry.ScopeEntry{IsList: true, Fields: result.States.Keys()}

	var visit func(node *Expr, scope Scope, parent *Expr, param string)
	visit = func(node *Expr, scope Scope, parent *Expr, param string) {
		if node.Kind == Ref {
			parts := strings.Split(node.Name, ".")
			family, field := parts[0], ""
			if len(parts) > 1 {
				field = parts[1]
			}
			proto := false
			for _, p := range parts {
				if protoNames[p] {
					proto = true
				}
			}
			_, inScope := scope[family]
			switch {
			case proto:
				issue(node, "This reference is not available.")
			case family != "" && family[0] >= 'A' && family[0] <= 'Z':
				if !(registry.InFamily(family, field) || contains(ctx.customTokens(family), field)) || len(parts) > 2 {
					issue(node, "Unknown token: "+node.Name)
				}
			case !inScope:
				if said, ok := registry.NotImported[family]; ok {
					if isPage {
						issue(node, said[0])
					} else {
						issue(node, said[1])
					}
				} else {
					issue(node, "Unknown data scope: "+family)
				}
			case len(parts) > 1 && field != "" && ReferenceType(node.Name, scope) == "":
				issue(node, "Unknown field: "+node.Name)
			}
			return
		}
		if node.Kind != Call {
			for _, child := range Children(node) {
				visit(child, scope, parent, param)
			}
			return
		}
		if node.Name == "Variant" {
			options := map[string]string{}
			for name, t := range scope["options"].Typed {
				options[name] = t
			}
			for _, option := range CallItems(node.Arg("options")) {
				t := dataOptionType(option)
				if t == "" {
					t = "unknown"
				}
				options[Text(option.Arg("name"))] = t
			}
			scope = scope.clone()
			scope["options"] = registry.ScopeEntry{Typed: options}
		}
		var definition *registry.Entry
		if node.Name == ctx.Current && registry.Constructors[node.Name] != nil {
			definition = registry.Constructors[node.Name]
		} else if c := ctx.Components[node.Name]; c != nil {
			definition = c
		}
		if definition == nil {
			definition = registry.Constructors[node.Name]
		}
		if definition == nil {
			definition = registry.Functions[node.Name]
		}
		if definition == nil {
			issue(node, "Unsupported constructor or function: "+node.Name)
			for _, child := range Children(node) {
				visit(child, scope, node, "")
			}
			return
		}
		var choices []registry.Choice
		hasChoices := false
		if node.Name == "Component" {
			hasChoices = true
			for _, variant := range result.Variants {
				choices = append(choices, registry.Choice{ID: Text(variant.Arg("id"))})
			}
		} else if definition.Variants != nil {
			hasChoices = true
			choices = definition.Variants
		}
		var variantRule *Expr
		if node.Name == "Component" {
			variantRule = node.Arg("defaultVariant")
		} else if hasChoices {
			variantRule = node.Arg("variant")
		}
		owner := node.Name
		var checkVariantRule func(rule *Expr)
		checkVariantRule = func(rule *Expr) {
			literal := LiteralValue(rule)
			if literal.Kind() == js.String {
				known := false
				for _, c := range choices {
					if c.ID == literal.Str() {
						known = true
					}
				}
				if !known {
					issue(rule, "Unknown variant "+js.Stringify(literal.Str())+" on "+owner+".")
				}
			} else if rule.Kind == Conditional {
				checkVariantRule(rule.Yes)
				checkVariantRule(rule.No)
			} else if rule.IsCall("Responsive") {
				for _, key := range rule.Args.Keys() {
					checkVariantRule(rule.Args.Get(key))
				}
			}
		}
		if variantRule != nil {
			checkVariantRule(variantRule)
		}
		if registry.Functions[node.Name] != nil {
			if len(node.Positional) != len(definition.Required) {
				issue(node, node.Name+" expects "+js.NumberString(float64(len(definition.Required)))+" positional arguments.")
			}
		} else {
			for _, name := range definition.Required {
				if !node.Args.Has(name) {
					issue(node, node.Name+" requires "+name+".")
				}
			}
			for _, name := range node.Args.Keys() {
				value := node.Args.Get(name)
				expected, ok := definition.Param(name)
				if !ok || expected == "" {
					// A Search's are the page's own search params: any name.
					if node.Name != "Search" {
						issue(value, "Unknown parameter "+name+" on "+node.Name+".")
					}
					continue
				}
				literal := LiteralValue(value)
				if expected == "Action" && !isAction(value) {
					issue(value, name+" must be an action or an ActionOption reference.")
				}
				if expected == "List<Action>" && value.Kind == List {
					for _, step := range value.Items {
						if !isAction(step) {
							issue(step, "Each step must be an action or an ActionOption reference.")
						}
					}
				}
				if !literal.IsNullish() {
					if expected == "Bool" && literal.Kind() != js.Boolean {
						issue(value, name+" must be a boolean.")
					}
					if expected == "Number" && literal.Kind() != js.Number {
						issue(value, name+" must be a number.")
					}
					if expected == "String" && literal.Kind() != js.String {
						issue(value, name+" must be text.")
					}
				}
				if strings.HasPrefix(expected, "List") && value.Kind != List && value.Kind != Ref && value.Kind != Call {
					issue(value, name+" must be a list.")
				}
				if expected == "Widget" {
					bad := value.Kind != Conditional
					if value.Kind == Call {
						group := ""
						if c := ctx.Components[value.Name]; c != nil {
							group = c.Group
						} else if c := registry.Constructors[value.Name]; c != nil {
							group = c.Group
						}
						bad = !contains(widgetGroups, group)
					}
					if bad {
						issue(value, name+" must build a widget.")
					}
				}
			}
		}
		parentName := ""
		if parent != nil {
			parentName = parent.Name
		}
		if node.Name == "TriggerButton" && (parentName != "Drawer" || param != "trigger") {
			issue(node, "TriggerButton is only valid as Drawer.trigger.")
		}
		if node.Name == "Drawer" && node.Arg("trigger") == nil && node.Arg("open") == nil {
			issue(node, "A Drawer needs a trigger, or open to show it on a condition.")
		}
		if (node.Name == "Expanded" || node.Name == "Flexible") && !(parentName == "Row" || parentName == "Column" || parentName == "Flex") {
			issue(node, node.Name+" must be a direct Row, Column or Flex child.")
		}
		if (node.Name == "Expanded" || node.Name == "Flexible" || node.Name == "Spacer") && node.Arg("flex") != nil {
			if flex, ok := NumericLiteral(node.Arg("flex")); ok && (!js.IsInteger(flex) || flex <= 0 || flex > 100) {
				issue(node.Arg("flex"), "flex must be an integer from 1 to 100.")
			}
		}
		if node.Name == "Positioned" {
			if parentName != "Stack" {
				issue(node, "Positioned must be a direct Stack child.")
			}
			for _, axis := range [][]string{{"left", "right", "width"}, {"top", "bottom", "height"}} {
				all := true
				for _, key := range axis {
					if node.Arg(key) == nil || LiteralValue(node.Arg(key)).IsNull() {
						all = false
					}
				}
				if all {
					issue(node, "Positioned accepts at most two of "+strings.Join(axis, "/")+".")
				}
			}
		}
		if node.Name == "Layer" && parentName != "Layers" {
			issue(node, "Layer must be a direct Layers overlay.")
		}
		if node.Name == "Stack" || node.Name == "Positioned" || node.Name == "SizedBox" {
			for _, key := range []string{"width", "height"} {
				if value, ok := NumericLiteral(node.Arg(key)); ok && value < 0 {
					issue(node.Arg(key), key+" must be non-negative.")
				}
			}
		}
		if node.Name == "Use" && !result.Parts.Has(Text(node.Arg("part"))) {
			issue(node, "Unknown part: "+Text(node.Arg("part")))
		}
		if node.Name == "Toggle" && !result.States.Has(Text(node.Arg("state"))) {
			issue(node, "Unknown state: "+Text(node.Arg("state")))
		}
		if node.Name == "Grid" && (node.Arg("cols") != nil) == (node.Arg("minItemWidth") != nil) {
			issue(node, "Grid requires either cols or minItemWidth.")
		}
		if node.Name == "Box" && node.Arg("onTap") != nil && node.Arg("ariaLabel") == nil {
			issue(node, "A clickable Box requires ariaLabel.")
		}
		if (node.Name == "Button" || node.Name == "TriggerButton") && node.Arg("label") == nil &&
			!(node.Arg("icon") != nil && node.Arg("ariaLabel") != nil) {
			issue(node, "Provide label, or icon and ariaLabel.")
		}
		if node.Name == "Image" && js.StrictEquals(LiteralValue(node.Arg("alt")), js.StringValue("")) &&
			!js.StrictEquals(LiteralValue(node.Arg("decorative")), js.BoolValue(true)) {
			issue(node, "Empty alt text requires decorative: true.")
		}
		if node.Name == "ForEach" {
			alias, index := Text(node.Arg("as")), Text(node.Arg("indexAs"))
			_, aliasTaken := scope[alias]
			if !identifier.MatchString(alias) || aliasTaken || protoNames[alias] {
				issue(node, "ForEach alias must be a new valid identifier.")
			}
			_, indexTaken := scope[index]
			if index != "" && (!identifier.MatchString(index) || indexTaken || index == alias || protoNames[index]) {
				issue(node, "indexAs must be a new valid identifier.")
			}
			for _, key := range node.Args.Keys() {
				next := scope
				if key == "child" {
					next = scope.clone()
					element := ElementType(ExpressionType(node.Arg("items"), scope))
					if element == "" {
						element = "PreviewProduct"
					}
					next[alias] = registry.ScopeEntry{Type: element}
					if index != "" {
						next[index] = registry.ScopeEntry{IsList: true}
					}
				}
				visit(node.Args.Get(key), next, node, key)
			}
			return
		}
		if def := node.Arg("default"); strings.HasSuffix(node.Name, "Option") && def != nil &&
			!((def.Kind == Literal && def.Segments == nil) || (def.Kind == Ref && def.Name[0] >= 'A' && def.Name[0] <= 'Z')) {
			issue(def, "Option defaults must be literal values or theme tokens.")
		}
		if node.Name == "MapMarker" && (parentName != "GoogleMap" || param != "markers") {
			issue(node, "MapMarker is only valid in GoogleMap.markers.")
		}
		if node.Name == "GoogleMap" {
			if markers := node.Arg("markers"); markers != nil && markers.Kind == List {
				for _, marker := range markers.Items {
					if marker.Kind != Call || marker.Name != "MapMarker" {
						issue(marker, "GoogleMap's markers are MapMarker(...) items.")
					}
				}
			}
		}
		if node.Name == "Lottie" {
			if src := node.Arg("src"); LiteralValue(src).TypeOf() == "string" && !strings.HasPrefix(LiteralValue(src).String(), "https://") {
				issue(src, "A Lottie's src is a web address starting https://.")
			}
		}
		if node.Name == "Embed" {
			ref := Text(node.Arg("component"))
			if ref == "" {
				ref = Text(node.Arg("ref"))
			}
			if ref != "" && ref != "core/product-card" && ref != "acme/product-card-pro" {
				issue(node, "Local preview cannot resolve component: "+ref)
			}
			if node.Arg("ref") == nil && node.Arg("component") == nil {
				issue(node, "Embed requires ref or component.")
			}
		}
		if node.Name == "NumberOption" {
			lo, hi, value := LiteralValue(node.Arg("min")), LiteralValue(node.Arg("max")), LiteralValue(node.Arg("default"))
			if lo.Kind() == js.Number && hi.Kind() == js.Number &&
				(lo.Num() > hi.Num() || (value.Kind() == js.Number && (value.Num() < lo.Num() || value.Num() > hi.Num()))) {
				issue(node, "NumberOption default must be within min/max.")
			}
		}
		if node.Name == "StringOption" {
			limit, value := LiteralValue(node.Arg("maxLength")), LiteralValue(node.Arg("default"))
			if limit.Kind() == js.Number &&
				(limit.Num() < 1 || limit.Num() > 200 || (value.Kind() == js.String && float64(js.Len(value.Str())) > limit.Num())) {
				issue(node, "StringOption maxLength is 1-200 and must fit its default.")
			}
		}
		if node.Name == "EnumOption" {
			key := func(e *Expr) js.Value {
				if e != nil && e.Kind == Ref {
					return js.StringValue(e.Name)
				}
				return LiteralValue(e)
			}
			found := false
			for _, choice := range ListItems(node.Arg("values")) {
				if sameKey(choice, node.Arg("default"), key) {
					found = true
				}
			}
			if !found {
				issue(node, "EnumOption default must be one of its values.")
			}
		}
		for _, key := range node.Args.Keys() {
			value := node.Args.Get(key)
			if node == root && !isPage && key == "data" {
				continue
			}
			if node == root && !isPage && (key == "route" || key == "seo") {
				issue(value, key+` is a Page's, not a component's: a component gets data through options, DataOption(name: "product", type: Product).`)
				continue
			}
			// A DataOption's type is a data type (Store, Product…), not a token.
			if node.Name == "DataOption" && key == "type" {
				if dataOptionType(node) == "" {
					issue(value, "type is one of the API's data types: Store, Product, Category, Menu, Order, Address….")
				}
				continue
			}
			if node == root && (key == "route" || key == "data") {
				continue
			}
			if node == root && key == "seo" {
				// Only the head's expressions read data; the rest is checked in Studio.
				if value.Kind == Call {
					for _, field := range []string{"title", "description", "image"} {
						if v := value.Arg(field); v != nil {
							visit(v, scope, value, field)
						}
					}
				}
				continue
			}
			if value.Kind == List {
				for _, item := range value.Items {
					visit(item, scope, node, key)
				}
			} else {
				visit(value, scope, node, key)
			}
		}
		for _, value := range node.Positional {
			visit(value, scope, node, "")
		}
	}
	visit(root, base, nil, "")

	orRoot := func(e *Expr) *Expr {
		if e == nil {
			return root
		}
		return e
	}
	if isPage {
		// A page: a name and what it builds; no dsl, id, kind, variants or options.
		if js.Trim(result.Name) == "" || js.Len(result.Name) > 60 {
			issue(orRoot(root.Arg("name")), "Page name must be 1-60 characters.")
		}
		if root.Arg("build") == nil {
			issue(root, "A Page needs build: what it shows.")
		}
	} else {
		if !js.StrictEquals(LiteralValue(root.Arg("dsl")), js.NumberValue(1)) {
			issue(root, "Use dsl: 1.")
		}
		if !componentID.MatchString(Text(root.Arg("id"))) {
			issue(orRoot(root.Arg("id")), `Component id must use "publisher/name".`)
		}
		if js.Trim(result.Name) == "" || js.Len(result.Name) > 60 {
			issue(orRoot(root.Arg("name")), "Component name must be 1-60 characters.")
		}
		if js.Len(Text(root.Arg("description"))) > 200 {
			issue(orRoot(root.Arg("description")), "Description is limited to 200 characters.")
		}
		if len(result.Variants) == 0 || len(result.Variants) > 8 {
			issue(root, "Declare 1-8 variants.")
		}
	}
	ids := map[string]bool{}
	for _, variant := range result.Variants {
		id := Text(variant.Arg("id"))
		if id == "" || ids[id] {
			issue(variant, "Variant ids must be non-empty and unique.")
		}
		ids[id] = true
	}
	if len(result.Options) > 24 {
		issue(root, "Declare at most 24 options.")
	}
	named := map[string]bool{}
	for _, option := range result.Options {
		name := Text(option.Arg("name"))
		if name == "variant" {
			issue(option, `The option name "variant" is reserved for selecting a component variant.`)
		}
		if !ValidInputName(name) || named[name] {
			issue(option, "Option names must be valid and unique.")
		}
		named[name] = true
	}
	completed := map[string]bool{}
	var checkPart func(name string, path []string)
	checkPart = func(name string, path []string) {
		if completed[name] {
			return
		}
		if contains(path, name) {
			node := result.Parts.Get(name)
			if node == nil {
				node = root
			}
			issue(node, "Cyclic part reference: "+strings.Join(append(append([]string{}, path...), name), " -> "))
			return
		}
		node := result.Parts.Get(name)
		if node == nil {
			return
		}
		next := append(append([]string{}, path...), name)
		var walk func(e *Expr)
		walk = func(e *Expr) {
			if e.IsCall("Use") {
				checkPart(Text(e.Arg("part")), next)
			}
			for _, child := range Children(e) {
				walk(child)
			}
		}
		walk(node)
		completed[name] = true
	}
	for _, name := range result.Parts.Keys() {
		checkPart(name, nil)
	}
	return result
}

func sameKey(a, b *Expr, key func(*Expr) js.Value) bool {
	return js.StrictEquals(key(a), key(b))
}
