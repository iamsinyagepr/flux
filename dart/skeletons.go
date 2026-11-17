package dart

import (
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/registry"
)

// Loading skeletons for lists of remote data — a port of upskaleapp's
// skeletons.ts.
//
// A ForEach over the storefront's stores, menu or orders is empty while the
// request is in flight. When the page has no skeleton of its own, the list's
// item is drawn in outline instead: the same boxes, rows and gaps, a
// shimmering bar for each text and a block for each image or button, built
// from the item's own source with anything that reads the item dropped.

// Placeholders the outline uses, compiled by widgetCall.
const (
	skeletonText  = "__SkeletonText"
	skeletonBlock = "__SkeletonBlock"
	// skeletonCount is how many outlined items a loading list shows.
	skeletonCount = 4
)

// loadedBy is which storefront request fills a binding (studioLoading).
var loadedBy = map[string]string{
	"stores": "stores", "menu": "menu", "products": "menu", "categories": "menu",
	"category": "menu", "cuisines": "menu", "cuisinesPage": "menu", "orders": "orders",
}

// loadingSource is the request a ForEach's items come from, or "" for local
// data (the cart, a form's options, an item's own lists).
func loadingSource(items *cdsl.Expr, aliases map[string]string) string {
	found := ""
	var visit func(node *cdsl.Expr)
	visit = func(node *cdsl.Expr) {
		if node == nil || found != "" {
			return
		}
		switch node.Kind {
		case cdsl.Ref:
			head := strings.Split(node.Name, ".")[0]
			if _, alias := aliases[head]; !alias {
				found = loadedBy[head]
			}
		case cdsl.List:
			for _, item := range node.Items {
				visit(item)
			}
		case cdsl.Call:
			for _, key := range node.Args.Keys() {
				visit(node.Args.Get(key))
			}
			for _, p := range node.Positional {
				visit(p)
			}
		case cdsl.Conditional:
			visit(node.Condition)
			visit(node.Yes)
			visit(node.No)
		case cdsl.Binary:
			visit(node.Left)
			visit(node.Right)
		case cdsl.Unary:
			visit(node.Child)
		case cdsl.Index:
			visit(node.Target)
		case cdsl.Literal:
			for _, part := range node.Segments {
				if part.Expr != nil {
					visit(part.Expr)
				}
			}
		}
	}
	visit(items)
	return found
}

var skeletonName = regexp.MustCompile(`(?i)skeleton|shimmer`)

// hasOwnSkeleton reports whether a document draws its own loading state: a
// widget or component named like a skeleton or shimmer anywhere in it.
func hasOwnSkeleton(analysis *cdsl.Analysis) bool {
	found := false
	var visit func(node *cdsl.Expr)
	visit = func(node *cdsl.Expr) {
		if node == nil || found {
			return
		}
		switch node.Kind {
		case cdsl.Call:
			if skeletonName.MatchString(node.Name) {
				found = true
			}
			for _, key := range node.Args.Keys() {
				visit(node.Args.Get(key))
			}
			for _, p := range node.Positional {
				visit(p)
			}
		case cdsl.List:
			for _, item := range node.Items {
				visit(item)
			}
		case cdsl.Conditional:
			visit(node.Yes)
			visit(node.No)
		}
	}
	visit(analysis.Root)
	for _, name := range analysis.Parts.Keys() {
		visit(analysis.Parts.Get(name))
	}
	return found
}

var (
	// Widgets kept as they are in the outline, with their children outlined.
	skeletonLayout = map[string]bool{
		"Box": true, "Column": true, "Row": true, "Flex": true, "Wrap": true, "Grid": true, "Stack": true,
		"Positioned": true, "Expanded": true, "Flexible": true, "SizedBox": true, "ScrollView": true,
		"Spacer": true, "Divider": true, "Empty": true,
	}
	skeletonButtons = map[string]bool{"Button": true, "SubmitButton": true, "ResetButton": true, "TriggerButton": true}
	skeletonFields  = map[string]bool{"TextField": true, "SearchField": true, "SelectField": true, "Checkbox": true}
	// Expressions an outline may keep: they don't read the missing item.
	constantCalls = map[string]bool{"Insets": true, "Border": true, "Gradient": true, "Responsive": true}
	heavyWeight   = regexp.MustCompile(`bold|semibold|w[6-9]00`)
)

type outlineContext struct {
	component func(name string) *cdsl.Analysis
	parts     *cdsl.NamedExprs
	// foreign: inside another component, whose options aren't this widget's.
	foreign bool
	depth   int
}

// skeletonOf is a ForEach item's outline, or nil when there is nothing to
// draw (an item that is only a nested list, say).
func skeletonOf(child *cdsl.Expr, analysis *cdsl.Analysis, component func(string) *cdsl.Analysis) *cdsl.Expr {
	return outline(child, outlineContext{component: component, parts: &analysis.Parts})
}

type namedArg struct {
	key   string
	value *cdsl.Expr
}

func outlineCall(source *cdsl.Expr, name string, args []namedArg) *cdsl.Expr {
	kept := &cdsl.Args{}
	for _, arg := range args {
		if arg.value != nil {
			kept.Set(arg.key, arg.value)
		}
	}
	return &cdsl.Expr{Kind: cdsl.Call, Name: name, Args: kept, From: source.From, To: source.To}
}

func outlineNumber(source *cdsl.Expr, value float64) *cdsl.Expr {
	return &cdsl.Expr{Kind: cdsl.Literal, Value: js.NumberValue(value), From: source.From, To: source.To}
}

// constant is an expression without the item in it, or nil.
func constant(node *cdsl.Expr, context outlineContext) *cdsl.Expr {
	if node == nil {
		return nil
	}
	switch node.Kind {
	case cdsl.Literal:
		if node.Segments != nil {
			return nil
		}
		return node
	case cdsl.Ref:
		head := strings.Split(node.Name, ".")[0]
		if head != "" && head[0] >= 'A' && head[0] <= 'Z' {
			return node
		}
		if head == "options" && !context.foreign {
			return node
		}
		return nil
	case cdsl.List:
		for _, item := range node.Items {
			if constant(item, context) == nil {
				return nil
			}
		}
		return node
	case cdsl.Conditional:
		// A selected / unselected look: the outline takes the resting one.
		if no := constant(node.No, context); no != nil {
			return no
		}
		return constant(node.Yes, context)
	case cdsl.Call:
		if !constantCalls[node.Name] {
			return nil
		}
		for _, key := range node.Args.Keys() {
			if constant(node.Args.Get(key), context) == nil {
				return nil
			}
		}
		for _, p := range node.Positional {
			if constant(p, context) == nil {
				return nil
			}
		}
		return node
	}
	return nil
}

func outline(node *cdsl.Expr, context outlineContext) *cdsl.Expr {
	if node == nil || node.Kind != cdsl.Call || context.depth > 40 {
		return nil
	}
	a := node.Args
	keep := func(name string) *cdsl.Expr { return constant(a.Get(name), context) }
	deeper := context
	deeper.depth++

	if skeletonLayout[node.Name] {
		entry := registry.Constructors[node.Name]
		var args []namedArg
		set := func(key string, value *cdsl.Expr) {
			for i := range args {
				if args[i].key == key {
					args[i].value = value
					return
				}
			}
			args = append(args, namedArg{key, value})
		}
		get := func(key string) *cdsl.Expr {
			for _, arg := range args {
				if arg.key == key {
					return arg.value
				}
			}
			return nil
		}
		for _, key := range a.Keys() {
			value := a.Get(key)
			switch {
			case key == "child":
				set("child", outline(value, deeper))
			case key == "children":
				if value.Kind != cdsl.List {
					continue
				}
				var items []*cdsl.Expr
				for _, item := range value.Items {
					if outlined := outline(item, deeper); outlined != nil {
						items = append(items, outlined)
					}
				}
				set("children", &cdsl.Expr{Kind: cdsl.List, Items: items, From: value.From, To: value.To})
			default:
				t := ""
				if entry != nil {
					t, _ = entry.Param(key)
				}
				if !strings.Contains(t, "Action") && key != "id" {
					set(key, constant(value, context))
				}
			}
		}
		// Expanded and friends need their child; a grid needs its columns.
		if (node.Name == "Expanded" || node.Name == "Flexible" || node.Name == "Positioned") && get("child") == nil {
			set("child", outlineCall(node, "Empty", nil))
		}
		if node.Name == "Grid" && get("cols") == nil && get("minItemWidth") == nil {
			set("cols", outlineNumber(node, 2))
		}
		if node.Name == "Box" && get("child") == nil && get("height") == nil && get("aspectRatio") == nil {
			set("height", outlineNumber(node, 48))
		}
		return outlineCall(node, node.Name, args)
	}
	switch node.Name {
	case "Text":
		literal := cdsl.LiteralValue(a.Get("child"))
		weight := a.Get("weight")
		heavy := weight != nil && weight.Kind == cdsl.Ref && heavyWeight.MatchString(weight.Name)
		// Literal text keeps roughly its length; bound text a title's or a
		// detail line's.
		factor := 0.45
		switch {
		case literal.Kind() == js.String:
			factor = math.Min(0.95, math.Max(0.2, float64(js.Len(literal.Str()))/36))
		case heavy:
			factor = 0.7
		}
		lines := 1.0
		if maxLines := cdsl.LiteralValue(a.Get("maxLines")); !maxLines.IsNullish() && jsNumber(maxLines) > 1 {
			lines = 2
		}
		var align *cdsl.Expr
		if al := a.Get("align"); al != nil && al.Kind == cdsl.Ref {
			align = al
		}
		return outlineCall(node, skeletonText, []namedArg{
			{"size", keep("size")},
			{"factor", outlineNumber(node, math.Round(factor*100)/100)},
			{"lines", outlineNumber(node, lines)},
			{"align", align},
		})
	case "Image":
		ratio := keep("aspectRatio")
		if ratio == nil && a.Get("height") == nil {
			ratio = outlineNumber(node, 1.5)
		}
		return outlineCall(node, skeletonBlock, []namedArg{
			{"width", keep("width")}, {"height", keep("height")}, {"aspectRatio", ratio}, {"radius", keep("radius")},
		})
	case "Icon":
		size := keep("size")
		if size == nil {
			size = outlineNumber(node, 24)
		}
		return outlineCall(node, skeletonBlock, []namedArg{{"width", size}, {"height", size}, {"radius", outlineNumber(node, 6)}})
	case "Badge":
		return outlineCall(node, skeletonBlock, []namedArg{
			{"width", outlineNumber(node, 64)}, {"height", outlineNumber(node, 22)}, {"radius", outlineNumber(node, 999)},
		})
	case "Animate":
		return outline(a.Get("child"), deeper)
	case "If":
		then := a.Get("then")
		if then == nil {
			then = a.Get("else")
		}
		return outline(then, deeper)
	case "ForEach":
		// A list inside the item (tags, choices) has no length yet.
		return nil
	case "Use":
		return outline(context.parts.Get(cdsl.LiteralValue(a.Get("part")).String()), deeper)
	}
	if skeletonButtons[node.Name] {
		full := cdsl.LiteralValue(a.Get("fullWidth"))
		var width *cdsl.Expr
		if !(full.Kind() == js.Boolean && full.Bool()) {
			width = outlineNumber(node, 96)
		}
		return outlineCall(node, skeletonBlock, []namedArg{
			{"width", width}, {"height", outlineNumber(node, 40)}, {"radius", outlineNumber(node, 10)},
		})
	}
	if skeletonFields[node.Name] {
		return outlineCall(node, skeletonBlock, []namedArg{{"height", outlineNumber(node, 48)}, {"radius", outlineNumber(node, 10)}})
	}
	// A project component: outline what it draws, its first look.
	if component := context.component(node.Name); component != nil && len(component.Variants) > 0 && context.depth < 30 {
		if build := component.Variants[0].Arg("build"); build != nil {
			inner := deeper
			inner.parts = &component.Parts
			inner.foreign = true
			return outline(build, inner)
		}
	}
	// Anything else (a platform widget): a block of its rough height.
	return outlineCall(node, skeletonBlock, []namedArg{{"height", outlineNumber(node, 56)}, {"radius", outlineNumber(node, 10)}})
}

// jsNumber is Number(value) for a literal.
func jsNumber(v js.Value) float64 {
	switch v.Kind() {
	case js.Number:
		return v.Num()
	case js.Boolean:
		if v.Bool() {
			return 1
		}
		return 0
	case js.String:
		text := strings.TrimSpace(v.Str())
		if text == "" {
			return 0
		}
		n, err := strconv.ParseFloat(text, 64)
		if err != nil {
			return math.NaN()
		}
		return n
	}
	return math.NaN()
}
