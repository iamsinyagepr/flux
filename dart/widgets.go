package dart

import (
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/js"
)

// join is `[…].filter(Boolean).join(sep)` over already-evaluated parts.
func join(sep string, parts ...string) string {
	var kept []string
	for _, p := range parts {
		if p != "" {
			kept = append(kept, p)
		}
	}
	return strings.Join(kept, sep)
}

func when(condition bool, code func() string) string {
	if condition {
		return code()
	}
	return ""
}

func (e *emitter) widgetCall(node *cdsl.Expr, s scope) string {
	a := node.Args
	has := a.Has
	ex := func(name string) string { return e.expr(a.Get(name), s) }
	child := func() string { return e.widget(a.Get("child"), s) }
	number := func(name string) string { return "studioNumber(" + ex(name) + ")" }
	fields := func(names string, numeric bool) string {
		var out []string
		for _, name := range strings.Split(names, " ") {
			if !has(name) {
				continue
			}
			if numeric {
				out = append(out, name+": "+number(name))
			} else {
				out = append(out, name+": "+ex(name))
			}
		}
		return strings.Join(out, ", ")
	}
	pad := func(code string) string {
		if has("padding") {
			return "Padding(padding: studioInsets(" + ex("padding") + "), child: " + code + ")"
		}
		return code
	}

	if custom := e.components[node.Name]; custom != nil && custom != e.definition {
		e.addDependency(custom)
		options := allOptions(custom.analysis)
		actions := map[string]bool{}
		allowed := []string{"variant"}
		for _, option := range options {
			if option.Name == "ActionOption" {
				actions[optionName(option)] = true
			}
			allowed = append(allowed, optionName(option))
		}
		e.args(node, strings.Join(allowed, " "))
		sh, ok := e.shapes[custom]
		if !ok {
			sh = fullShape()
		}
		var values, handlers []string
		for _, name := range a.Keys() {
			if name != "variant" && !actions[name] {
				values = append(values, q(name)+": "+ex(name))
			}
		}
		for _, name := range a.Keys() {
			if actions[name] {
				handlers = append(handlers, q(name)+": "+e.callback(a.Get(name), s))
			}
		}
		named := join(", ",
			when(sh.bindings, func() string { return "bindings: " + field("bindings") }),
			when(sh.variants && has("variant"), func() string { return "variant: " + ex("variant") }),
			when(sh.options && len(values) > 0, func() string { return "options: {" + strings.Join(values, ", ") + "}" }),
			when(sh.actions && len(handlers) > 0, func() string { return "actions: {" + strings.Join(handlers, ", ") + "}" }),
		)
		if named != "" {
			return custom.className + "(" + named + ")"
		}
		return "const " + custom.className + "()"
	}

	switch node.Name {
	case "Empty":
		e.args(node, "")
		return "const SizedBox.shrink()"

	case skeletonText:
		align := ""
		if al := a.Get("align"); al != nil && al.Kind == cdsl.Ref {
			if strings.HasPrefix(al.Name, "Align.") {
				align = "align: TextAlign." + strings.Split(al.Name, ".")[1]
			} else {
				align = "align: " + ex("align")
			}
		}
		return "StudioSkeletonText(" + join(", ",
			when(has("size"), func() string { return "size: " + number("size") }),
			"widthFactor: "+ex("factor"),
			"lines: "+ex("lines"),
			align,
		) + ")"

	case skeletonBlock:
		var named []string
		for _, name := range []string{"width", "height", "aspectRatio", "radius"} {
			if has(name) {
				named = append(named, name+": "+number(name))
			}
		}
		return "StudioSkeletonBlock(" + strings.Join(named, ", ") + ")"

	case "Text":
		e.args(node, "child size weight color maxLines align strike role level fontStyle letterSpacing wordSpacing lineHeight background decoration decorationColor decorationStyle decorationThickness fontFamily shadow overflow softWrap textDirection semanticsLabel")
		if role := a.Get("role"); role != nil && role.Kind != cdsl.Ref {
			e.fail(role, "Text role must be a literal TextRole token.")
		}
		// Align.start/center/end, or any TextAlign (left, right, justify…).
		alignFamily, align := "", ""
		if al := a.Get("align"); al != nil && al.Kind == cdsl.Ref {
			parts := strings.Split(al.Name, ".")
			alignFamily = parts[0]
			if len(parts) > 1 {
				align = parts[1]
			}
		}
		if has("align") && !((alignFamily == "Align" && (align == "start" || align == "end" || align == "center")) || alignFamily == "TextAlign") {
			e.fail(a.Get("align"), "Text alignment must be a literal TextAlign or Align token.")
		}
		var text string
		if c := a.Get("child"); c != nil && c.Kind == cdsl.Literal && c.Segments == nil && c.Value.Kind() == js.String {
			text = ex("child")
		} else {
			text = "studioText(" + ex("child") + ")"
		}
		style := join(", ",
			when(has("size"), func() string { return "fontSize: " + number("size") }),
			when(has("weight"), func() string { return "fontWeight: " + ex("weight") }),
			when(has("color"), func() string { return "color: studioPaint(" + ex("color") + ")" }),
			when(has("decoration") || has("strike"), func() string {
				if has("decoration") {
					return "decoration: " + ex("decoration")
				}
				return "decoration: studioTruthy(" + ex("strike") + ") ? TextDecoration.lineThrough : TextDecoration.none"
			}),
			when(has("fontStyle"), func() string { return "fontStyle: " + ex("fontStyle") }),
			when(has("letterSpacing"), func() string { return "letterSpacing: " + number("letterSpacing") }),
			when(has("wordSpacing"), func() string { return "wordSpacing: " + number("wordSpacing") }),
			when(has("lineHeight"), func() string { return "height: " + number("lineHeight") }),
			when(has("background"), func() string { return "backgroundColor: studioPaint(" + ex("background") + ")" }),
			when(has("decorationColor"), func() string { return "decorationColor: studioPaint(" + ex("decorationColor") + ")" }),
			when(has("decorationStyle"), func() string { return "decorationStyle: " + ex("decorationStyle") }),
			when(has("decorationThickness"), func() string { return "decorationThickness: " + number("decorationThickness") }),
			when(has("fontFamily"), func() string { return "fontFamily: studioText(" + ex("fontFamily") + ")" }),
			when(has("shadow"), func() string { return "shadows: studioTextShadows(" + ex("shadow") + ")" }),
		)
		code := "Text(" + join(", ",
			text,
			when(has("maxLines"), func() string { return "maxLines: studioInt(" + ex("maxLines") + ")" }),
			when(align != "", func() string { return "textAlign: TextAlign." + align }),
			when(style != "", func() string { return "style: TextStyle(" + style + ")" }),
			when(has("overflow"), func() string { return "overflow: " + ex("overflow") }),
			when(has("softWrap"), func() string { return "softWrap: studioTruthy(" + ex("softWrap") + ")" }),
			when(has("textDirection"), func() string { return "textDirection: " + ex("textDirection") }),
			when(has("semanticsLabel"), func() string { return "semanticsLabel: studioText(" + ex("semanticsLabel") + ")" }),
		) + ")"
		if has("role") || has("level") {
			semantic := ""
			if has("level") {
				semantic = "headingLevel: studioInt(" + ex("level") + ")"
			} else if role := a.Get("role"); role != nil && role.Kind == cdsl.Ref && role.Name == "TextRole.heading" {
				semantic = "header: true"
			} else {
				semantic = "header: false"
			}
			code = "Semantics(" + semantic + ", child: " + code + ")"
		}
		return code

	case "Column", "Row", "Flex":
		allowed := "children gap align justify padding direction mainAxisAlignment crossAxisAlignment mainAxisSize"
		if node.Name == "Row" {
			allowed += " wrap"
		}
		e.args(node, allowed)
		var axis string
		if node.Name == "Flex" {
			axis = ex("direction")
		} else if node.Name == "Row" {
			axis = "Axis.horizontal"
		} else {
			axis = "Axis.vertical"
		}
		direction := a.Get("direction")
		vertical := node.Name == "Column" ||
			(node.Name == "Flex" && direction != nil && direction.Kind == cdsl.Ref && direction.Name == "Axis.vertical")
		list := e.children(a.Get("children"), s, vertical)
		var cross string
		switch {
		case has("crossAxisAlignment"):
			cross = ex("crossAxisAlignment")
		case has("align"):
			cross = ex("align")
		case node.Name == "Flex":
			cross = "CrossAxisAlignment.center"
		default:
			cross = "CrossAxisAlignment.stretch"
		}
		var size string
		switch {
		case has("mainAxisSize"):
			size = ex("mainAxisSize")
		case node.Name == "Column":
			size = "MainAxisSize.min"
		default:
			size = "MainAxisSize.max"
		}
		main := ""
		if has("mainAxisAlignment") {
			main = "mainAxisAlignment: " + ex("mainAxisAlignment")
		} else if has("justify") {
			main = "mainAxisAlignment: " + ex("justify")
		}
		children := list
		if has("gap") {
			children = "studioGaps(" + list + ", " + number("gap") + ", " + axis + ")"
		}
		flex := "StudioFlex(" + join(", ",
			"direction: "+axis,
			main,
			when(cross != "CrossAxisAlignment.start", func() string { return "crossAxisAlignment: " + cross }),
			when(size != "MainAxisSize.min", func() string { return "mainAxisSize: " + size }),
			when((node.Name == "Flex" || has("mainAxisSize")) && size == "MainAxisSize.max" && axis == "Axis.horizontal",
				func() string { return "fillWidth: true" }),
			"children: "+children,
		) + ")"
		// A wrapping Row: its children flow onto new lines, the gap between
		// them both ways, as the preview's flex-wrap does.
		if node.Name == "Row" && has("wrap") {
			gap := "0.0"
			if has("gap") {
				gap = number("gap")
			}
			wrap := "Wrap(spacing: " + gap + ", runSpacing: " + gap + ", children: " + e.children(a.Get("children"), s, true) + ")"
			return pad("(studioTruthy(" + ex("wrap") + ") ? " + wrap + " : " + flex + ")")
		}
		return pad(flex)

	case "Wrap":
		e.args(node, "children direction spacing runSpacing alignment runAlignment crossAxisAlignment padding")
		named := fields("direction alignment runAlignment crossAxisAlignment", false)
		separator := when(has("direction") || has("alignment") || has("runAlignment") || has("crossAxisAlignment"),
			func() string { return "," })
		spacing := when(has("spacing"), func() string { return "spacing: " + number("spacing") + "," })
		runSpacing := when(has("runSpacing"), func() string { return "runSpacing: " + number("runSpacing") + "," })
		return pad("Wrap(" + named + separator + "\n          " + spacing + runSpacing + " children: " + e.children(a.Get("children"), s, true) + ")")

	case "Grid":
		e.args(node, "children cols minItemWidth gap padding")
		gap := "0.0"
		if has("gap") {
			gap = number("gap")
		}
		var columns string
		if has("cols") {
			columns = "studioInt(" + ex("cols") + ").clamp(1, 100)"
		} else {
			columns = "((width + gap) / (" + number("minItemWidth") + " + gap)).floor().clamp(1, 100)"
		}
		return pad("LayoutBuilder(builder: (context, constraints) {\n" +
			"          final width = constraints.hasBoundedWidth ? constraints.maxWidth : MediaQuery.sizeOf(context).width;\n" +
			"          final gap = " + gap + ";\n" +
			"          final columns = " + columns + ";\n" +
			"          return Wrap(spacing: gap, runSpacing: gap, children: [for (final child in " + e.children(a.Get("children"), s, true) + ")\n" +
			"            SizedBox(width: (width - gap * (columns - 1)).clamp(0, double.infinity) / columns, child: child)]);\n" +
			"        })")

	case "Animate":
		e.args(node, "child effect duration delay curve distance")
		return "StudioAnimate(" + join(", ",
			when(has("effect"), func() string { return "effect: " + ex("effect") }),
			when(has("duration"), func() string { return "duration: " + number("duration") }),
			when(has("delay"), func() string { return "delay: " + number("delay") }),
			when(has("curve"), func() string { return "curve: " + ex("curve") }),
			when(has("distance"), func() string { return "distance: " + number("distance") }),
			"child: "+child(),
		) + ")"

	case "SizedBox":
		e.args(node, "child width height")
		named := fields("width height", true)
		return "SizedBox(" + named + when(has("width") || has("height"), func() string { return "," }) + " child: " + child() + ")"

	case "Expanded", "Flexible":
		allowed := "child flex"
		if node.Name == "Flexible" {
			allowed += " fit"
		}
		e.args(node, allowed)
		flex := when(has("flex"), func() string { return "flex: studioInt(" + ex("flex") + ")," })
		fit := when(has("fit"), func() string { return "fit: " + ex("fit") + "," })
		return node.Name + "(" + flex + fit + " child: " + child() + ")"

	case "Spacer":
		e.args(node, "flex size")
		// A size without a flex is a fixed gap, as in the preview.
		if has("size") && !has("flex") {
			return "SizedBox.square(dimension: " + number("size") + ")"
		}
		return "Spacer(" + when(has("flex"), func() string { return "flex: studioInt(" + ex("flex") + ")" }) + ")"

	case "Divider":
		e.args(node, "color thickness")
		color := when(has("color"), func() string { return "color: studioPaint(" + ex("color") + ")," })
		thickness := when(has("thickness"), func() string { return "thickness: " + number("thickness") + "," })
		return "Divider(" + color + thickness + ")"

	case "Stack":
		e.args(node, "children alignment fit clip width height")
		alignment := when(has("alignment"), func() string { return "alignment: " + ex("alignment") + "," })
		fit := when(has("fit"), func() string { return "fit: " + ex("fit") + "," })
		clip := "Clip.none"
		if has("clip") {
			clip = "studioTruthy(" + ex("clip") + ") ? Clip.hardEdge : Clip.none"
		}
		code := "Stack(" + alignment + fit + "\n          clipBehavior: " + clip + ", children: " + e.children(a.Get("children"), s) + ")"
		if has("width") || has("height") {
			return "SizedBox(" + fields("width height", true) + ", child: " + code + ")"
		}
		return code

	case "Positioned":
		e.args(node, "child top right bottom left width height")
		named := fields("top right bottom left width height", true)
		separator := ""
		for _, key := range a.Keys() {
			if key != "child" {
				separator = ","
				break
			}
		}
		return "Positioned(" + named + separator + " child: " + child() + ")"

	case "Box":
		e.args(node, "child padding margin alignment background gradient radius border shadow shape width height minWidth minHeight maxWidth maxHeight aspectRatio rotate scale opacity clip onTap ariaLabel id")
		code := child()
		// Its id marks it for ScrollTo. Inside the box, so the box keeps the
		// type its Row or Column lays out by (StudioFill).
		if has("id") {
			code = "StudioAnchor(id: studioText(" + ex("id") + "), child: " + code + ")"
		}
		if has("aspectRatio") {
			code = "StudioAspectRatio(aspectRatio: " + number("aspectRatio") + ", child: " + code + ")"
		}
		size := fields("width height", true)
		sizeSep := when(has("width") || has("height"), func() string { return "," })
		constraints := when(has("minHeight") || has("maxWidth") || has("minWidth") || has("maxHeight"), func() string {
			return "constraints: BoxConstraints(" + fields("minWidth minHeight maxWidth maxHeight", true) + "),"
		})
		padding := when(has("padding"), func() string { return "padding: studioInsets(" + ex("padding") + ")," })
		margin := when(has("margin"), func() string { return "margin: studioInsets(" + ex("margin") + ")," })
		alignment := when(has("alignment"), func() string { return "alignment: " + ex("alignment") + "," })
		// Rotation in degrees and a uniform scale, about the centre.
		transform := when(has("rotate") || has("scale"), func() string {
			return "transform: Matrix4.identity()" +
				when(has("rotate"), func() string { return "..rotateZ(" + number("rotate") + " * 0.017453292519943295)" }) +
				when(has("scale"), func() string { return "..scaleByDouble(" + number("scale") + ", " + number("scale") + ", 1.0, 1.0)" }) +
				", transformAlignment: Alignment.center,"
		})
		clip := "Clip.none"
		if has("clip") {
			clip = "studioTruthy(" + ex("clip") + ") ? Clip.hardEdge : Clip.none"
		}
		background := when(has("background"), func() string { return "color: studioPaint(" + ex("background") + ")," })
		gradient := when(has("gradient"), func() string { return "gradient: " + ex("gradient") + "," })
		shape := when(has("shape"), func() string { return "shape: " + ex("shape") + "," })
		// A circle has no corner radius (Flutter asserts on both).
		radius := when(has("radius"), func() string {
			if has("shape") {
				return "borderRadius: " + ex("shape") + " == BoxShape.circle ? null : BorderRadius.circular(" + number("radius") + "),"
			}
			return "borderRadius: BorderRadius.circular(" + number("radius") + "),"
		})
		border := when(has("border"), func() string { return "border: " + ex("border") + "," })
		shadow := when(has("shadow"), func() string { return "boxShadow: studioBoxShadow(" + ex("shadow") + ")," })
		code = "Container(" + size + sizeSep + "\n          " + constraints + "\n          " + padding +
			"\n          " + margin + "\n          " + alignment + "\n          " + transform +
			"\n          clipBehavior: " + clip + ",\n          decoration: BoxDecoration(" + background +
			"\n            " + gradient + shape + radius + border + shadow + "), child: " + code + ")"
		if has("opacity") {
			code = "Opacity(opacity: " + number("opacity") + ".clamp(0.0, 1.0), child: " + code + ")"
		}
		if has("onTap") {
			code = "StudioTap(" + join(", ",
				when(!has("width"), func() string { return "fill: true" }),
				when(!has("width") && has("maxWidth"), func() string { return "maxWidth: " + number("maxWidth") }),
				when(has("ariaLabel"), func() string { return "label: studioText(" + ex("ariaLabel") + ")" }),
				"onTap: "+e.handler(a.Get("onTap"), s),
				"child: "+code,
			) + ")"
		} else if has("ariaLabel") {
			code = "Semantics(label: studioText(" + ex("ariaLabel") + "), child: " + code + ")"
		}
		if has("width") || has("height") {
			return "StudioSized(" + join(", ",
				when(has("width"), func() string { return "width: true" }),
				when(has("height"), func() string { return "height: true" }),
				"child: "+code,
			) + ")"
		}
		return code

	case "Scaffold":
		e.args(node, "body appBar bottomNavigationBar background")
		background := when(has("background"), func() string { return "backgroundColor: studioPaint(" + ex("background") + ")," })
		bottom := when(has("bottomNavigationBar"), func() string {
			// Its own height: a bottom bar may be offered the whole screen.
			return "bottomNavigationBar: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [SafeArea(top: false, child: " + e.widget(a.Get("bottomNavigationBar"), s) + ")]),"
		})
		appBar := when(has("appBar"), func() string { return e.widget(a.Get("appBar"), s) + "," })
		return "Scaffold(" + background + "\n          " + bottom +
			"\n          body: SafeArea(bottom: false, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [\n            " +
			appBar + "Expanded(child: " + e.widget(a.Get("body"), s) + ")])))"

	case "ForEach":
		// On its own, a ForEach lays its items out like the preview: a
		// full-width vertical stack.
		synthetic := &cdsl.Expr{Kind: cdsl.List, Items: []*cdsl.Expr{node}, From: node.From, To: node.To}
		return "StudioFlex(direction: Axis.vertical, crossAxisAlignment: CrossAxisAlignment.stretch, children: " + e.children(synthetic, s, true) + ")"

	// The Library (library.go): its own widgets, in their own files.
	case "Lottie":
		e.args(node, "src loop autoplay fit width height alt")
		named := []string{"src: studioText(" + ex("src") + ")"}
		if has("loop") {
			named = append(named, "loop: studioTruthy("+ex("loop")+")")
		}
		if has("autoplay") {
			named = append(named, "autoplay: studioTruthy("+ex("autoplay")+")")
		}
		if has("fit") {
			named = append(named, "fit: "+ex("fit"))
		}
		if has("width") {
			named = append(named, "width: "+number("width"))
		}
		if has("height") {
			named = append(named, "height: "+number("height"))
		}
		if has("alt") {
			named = append(named, "label: studioText("+ex("alt")+")")
		}
		return "StudioLottie(" + strings.Join(named, ", ") + ")"

	case "GoogleMap":
		e.args(node, "latitude longitude zoom mapType height interactive markers onMarkerTap")
		list := a.Get("markers")
		if list != nil && list.Kind != cdsl.List {
			e.fail(list, "GoogleMap's markers are a list of MapMarker(...) items.")
		}
		var markers []string
		if list != nil {
			for _, marker := range list.Items {
				if marker.Kind != cdsl.Call || marker.Name != "MapMarker" {
					e.fail(marker, "GoogleMap's markers are MapMarker(...) items.")
				}
				e.args(marker, "latitude longitude title id")
				m := func(name string) string { return e.expr(marker.Arg(name), s) }
				fields := []string{"latitude: studioNumber(" + m("latitude") + ")", "longitude: studioNumber(" + m("longitude") + ")"}
				if marker.Args.Has("id") {
					fields = append(fields, "id: studioText("+m("id")+")")
				}
				if marker.Args.Has("title") {
					fields = append(fields, "title: studioText("+m("title")+")")
				}
				markers = append(markers, "StudioMapMarker("+strings.Join(fields, ", ")+")")
			}
		}
		configured := "false"
		if key := e.project.Config.Field("googleMapsKey"); key != nil && key.String != "" {
			configured = "true"
		}
		named := []string{"configured: " + configured, "latitude: " + number("latitude"), "longitude: " + number("longitude")}
		if has("zoom") {
			named = append(named, "zoom: "+number("zoom"))
		}
		if has("mapType") {
			named = append(named, "mapType: studioText("+ex("mapType")+")")
		}
		if has("height") {
			named = append(named, "height: "+number("height"))
		}
		if has("interactive") {
			named = append(named, "interactive: studioTruthy("+ex("interactive")+")")
		}
		if len(markers) > 0 {
			named = append(named, "markers: ["+strings.Join(markers, ", ")+"]")
		}
		if has("onMarkerTap") {
			named = append(named, "onMarkerTap: "+e.callback(a.Get("onMarkerTap"), s))
		}
		return "StudioGoogleMap(" + strings.Join(named, ", ") + ")"

	case "ScrollView":
		e.args(node, "child direction padding label")
		direction := when(has("direction"), func() string { return "scrollDirection: " + ex("direction") + "," })
		padding := when(has("padding"), func() string { return "padding: studioInsets(" + ex("padding") + ")," })
		code := "SingleChildScrollView(" + direction + padding + " child: " + child() + ")"
		if has("label") {
			return "Semantics(label: studioText(" + ex("label") + "), child: " + code + ")"
		}
		return code

	case "If":
		e.args(node, "condition then else")
		condition := ex("condition")
		then := e.widget(a.Get("then"), s)
		return "(studioTruthy(" + condition + ") ? " + then + " : " + e.widget(a.Get("else"), s) + ")"

	case "Use":
		e.args(node, "part")
		name := cdsl.LiteralValue(a.Get("part")).String()
		part := e.definition.analysis.Parts.Get(name)
		if part == nil || e.parts[name] {
			e.fail(node, "Missing or cyclic part: "+name)
		}
		e.parts[name] = true
		code := e.widget(part, s)
		delete(e.parts, name)
		return code

	case "Icon":
		e.args(node, "name size color")
		name := ex("name")
		size := when(has("size"), func() string { return "size: " + number("size") + "," })
		color := when(has("color"), func() string { return "color: studioPaint(" + ex("color") + ")," })
		return "Icon(" + name + ", " + size + color + ")"

	case "Button":
		e.args(node, "label icon onTap style fullWidth disabled ariaLabel")
		style := "ButtonStyle.primary"
		if st := a.Get("style"); st != nil && st.Kind == cdsl.Ref {
			style = st.Name
		}
		kind := map[string]string{
			"ButtonStyle.primary": "FilledButton", "ButtonStyle.secondary": "OutlinedButton", "ButtonStyle.ghost": "TextButton",
		}[style]
		if kind == "" {
			target := a.Get("style")
			if target == nil {
				target = node
			}
			e.fail(target, "Button style must be a supported literal ButtonStyle token.")
		}
		var content string
		if has("icon") {
			icon := ex("icon")
			content = "Row(mainAxisSize: MainAxisSize.min, children: [Icon(" + icon + "), const SizedBox(width: 8), Text(studioText(" + ex("label") + "))])"
		} else {
			content = "Text(studioText(" + ex("label") + "))"
		}
		disabled := when(has("disabled"), func() string { return "studioTruthy(" + ex("disabled") + ") ? null :" })
		code := kind + "(onPressed: " + disabled + " " + e.handler(a.Get("onTap"), s) + ", child: " + content + ")"
		if has("fullWidth") {
			code = "SizedBox(width: studioTruthy(" + ex("fullWidth") + ") ? double.infinity : null, child: " + code + ")"
		}
		if has("ariaLabel") {
			return "Semantics(label: studioText(" + ex("ariaLabel") + "), child: " + code + ")"
		}
		return code

	case "TextField", "SearchField":
		e.args(node, "state name label ariaLabel placeholder helperText type value rows required disabled minLength maxLength min max clearable onChanged onSubmitted "+
			"background color border radius padding fontSize labelColor helperColor placeholderColor focusColor")
		state := cdsl.LiteralValue(a.Get("state"))
		set := ""
		if state.Truthy() {
			set = "setState(() { localState[" + q(state.String()) + "] = studioRead(event, ['input', 'value']); });"
		}
		action := e.action(a.Get("onChanged"), s)
		paint := func(name string) string {
			return when(has(name), func() string { return name + ": studioPaint(" + ex(name) + ")" })
		}
		controlled := "controlled: false"
		if state.Truthy() {
			controlled = "controlled: true"
		}
		named := join(", ",
			controlled,
			when(state.Truthy() || has("value"), func() string {
				if state.Truthy() {
					return "value: localState[" + q(state.String()) + "]"
				}
				return "value: " + ex("value")
			}),
			when(has("name") || has("state"), func() string {
				if has("name") {
					return "name: studioText(" + ex("name") + ")"
				}
				return "name: studioText(" + ex("state") + ")"
			}),
			when(node.Name == "SearchField", func() string { return "search: true" }),
			when(has("type"), func() string { return "type: studioText(" + ex("type") + ")" }),
			when(has("label"), func() string { return "label: studioText(" + ex("label") + ")" }),
			when(has("ariaLabel"), func() string { return "semanticLabel: studioText(" + ex("ariaLabel") + ")" }),
			when(has("placeholder"), func() string { return "hint: studioText(" + ex("placeholder") + ")" }),
			when(has("helperText"), func() string { return "helper: studioText(" + ex("helperText") + ")" }),
			when(has("disabled"), func() string { return "enabled: !studioTruthy(" + ex("disabled") + ")" }),
			when(has("clearable"), func() string { return "clearable: studioTruthy(" + ex("clearable") + ")" }),
			when(has("rows"), func() string { return "rows: studioInt(" + ex("rows") + ")" }),
			when(has("maxLength"), func() string { return "maxLength: studioInt(" + ex("maxLength") + ")" }),
			// Checked when its form is submitted, with the preview's rules.
			when(has("required"), func() string { return "required: studioTruthy(" + ex("required") + ")" }),
			when(has("minLength"), func() string { return "minLength: studioInt(" + ex("minLength") + ")" }),
			when(has("min"), func() string { return "min: studioNumber(" + ex("min") + ")" }),
			when(has("max"), func() string { return "max: studioNumber(" + ex("max") + ")" }),
			paint("background"),
			paint("color"),
			paint("labelColor"),
			paint("helperColor"),
			paint("placeholderColor"),
			paint("focusColor"),
			when(has("border"), func() string { return "border: " + ex("border") }),
			when(has("radius"), func() string { return "radius: " + number("radius") }),
			when(has("padding"), func() string { return "padding: studioInsets(" + ex("padding") + ")" }),
			when(has("fontSize"), func() string { return "fontSize: " + number("fontSize") }),
			when(set != "" || action != "", func() string { return "onChanged: (event) { " + set + " " + action + " }" }),
			when(has("onSubmitted"), func() string { return "onSubmitted: " + e.callback(a.Get("onSubmitted"), s) }),
		)
		return "StudioTextInput(" + named + ")"

	case "Checkbox":
		e.args(node, "state name label value required disabled helperText onChanged")
		state := cdsl.LiteralValue(a.Get("state"))
		set := ""
		if state.Truthy() {
			set = "setState(() { localState[" + q(state.String()) + "] = studioRead(event, ['input', 'value']); });"
		}
		action := e.action(a.Get("onChanged"), s)
		controlled := "controlled: false"
		if state.Truthy() {
			controlled = "controlled: true"
		}
		return "StudioCheckbox(" + join(", ",
			controlled,
			when(state.Truthy() || has("value"), func() string {
				if state.Truthy() {
					return "value: localState[" + q(state.String()) + "]"
				}
				return "value: " + ex("value")
			}),
			when(has("name") || has("state"), func() string {
				if has("name") {
					return "name: studioText(" + ex("name") + ")"
				}
				return "name: studioText(" + ex("state") + ")"
			}),
			when(has("label"), func() string { return "label: studioText(" + ex("label") + ")" }),
			when(has("helperText"), func() string { return "helper: studioText(" + ex("helperText") + ")" }),
			when(has("disabled"), func() string { return "enabled: !studioTruthy(" + ex("disabled") + ")" }),
			when(has("required"), func() string { return "required: studioTruthy(" + ex("required") + ")" }),
			when(set != "" || action != "", func() string { return "onChanged: (event) { " + set + " " + action + " }" }),
		) + ")"

	case "Embed":
		// The catalog's card, compiled into the project (Compile), with the
		// product it's given: as the preview draws it.
		e.args(node, "ref component variant product products items title")
		refArg := a.Get("component")
		if refArg == nil {
			refArg = a.Get("ref")
		}
		ref := ""
		if v := cdsl.LiteralValue(refArg); !v.IsNullish() {
			ref = v.String()
		}
		card := e.components[embeddedCard]
		if !embedCatalog[ref] || card == nil {
			if ref == "" {
				ref = "this"
			}
			e.fail(node, "Embed can only show Studio's product card (core/product-card), not "+ref+".")
		}
		e.addDependency(card)
		sh, ok := e.shapes[card]
		if !ok {
			sh = fullShape()
		}
		product := "null"
		if has("product") {
			product = ex("product")
		}
		// The card's product is its option, as a page passes it.
		named := join(", ",
			when(sh.bindings, func() string { return "bindings: " + field("bindings") }),
			when(sh.variants && has("variant"), func() string { return "variant: " + ex("variant") }),
			when(sh.options, func() string { return "options: {" + q("product") + ": " + product + "}" }),
		)
		if named != "" {
			return card.className + "(" + named + ")"
		}
		return "const " + card.className + "()"
	}
	e.fail(node, node.Name+" is not supported by the Dart widget compiler yet.")
	return ""
}
