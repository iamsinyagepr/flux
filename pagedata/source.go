package pagedata

import (
	"regexp"
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
	"github.com/iamsinyagepr/flux/js"
)

// A page's route, data and SEO are written in its own source, as fields of
// its Page header and its usingServer/usingClient blocks:
//
//	Page(name: "Dish", route: Route(path: "/dishes/$dish"), seo: Seo(title: "${dish.name}"))
//	usingServer(dish<Product>(src: Tenant.product(id: route.dish)))
//
// FromSource reads them back into the Import and SEO settings the compilers
// take beside the source: what a project on disk (the flux CLI) has instead
// of Studio's stored settings. A port of Studio's readPageFields
// (pageSource.ts), checked against every golden case's pages.

// SearchParam is one of a route's search params: Route(search: Search(city: String(default: ""))).
type SearchParam struct {
	Name    string   `json:"name"`
	Type    string   `json:"type"`
	Default js.Value `json:"-"`
}

// Problem is something wrong with a page's fields, where it is (UTF-16 offsets).
type Problem struct {
	Message string `json:"message"`
	From    int    `json:"from"`
	To      int    `json:"to"`
}

// Fields are what a page's source declares.
type Fields struct {
	// Page is whether the source is a Page at all (a component has none of these).
	Page     bool
	Name     string
	Path     string
	HasRoute bool
	Search   []SearchParam
	Data     []Import
	SEO      *SEO
	Problems []Problem
}

const maxProblems = 20

var (
	searchName = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_-]{0,39}$`)
	pageOf     = regexp.MustCompile(`^Page<(.+)>$`)
)

var schemaNames = map[string]string{"Schema.product": "Product", "Schema.restaurant": "Restaurant"}

type reader struct {
	source string
	fields *Fields
}

func (r *reader) problem(node *cdsl.Expr, message string) {
	if len(r.fields.Problems) < maxProblems {
		r.fields.Problems = append(r.fields.Problems, Problem{message, node.From, node.To})
	}
}

// FromSource reads a page's fields from its source. A source that doesn't
// parse, or isn't a Page, has none (the checker reports why).
func FromSource(source string) Fields {
	fields := Fields{}
	parsed := cdsl.ParseSource(source)
	root := parsed.Root
	if root == nil || !root.IsCall("Page") {
		return fields
	}
	fields.Page = true
	fields.Name = cdsl.Text(root.Arg("name"))
	r := &reader{source: source, fields: &fields}
	route, data, seo := root.Arg("route"), root.Arg("data"), root.Arg("seo")
	if route != nil {
		fields.HasRoute = true
		path := js.UndefinedValue()
		if route.IsCall("Route") {
			path = cdsl.LiteralValue(route.Arg("path"))
		}
		if path.Kind() == js.String {
			fields.Path = path.Str()
		} else {
			r.problem(route, `route is Route(path: "/…"), its path a plain string with $params: "/dishes/$dish".`)
		}
		if search := route.Arg("search"); search != nil {
			fields.Search = r.search(search)
		}
	}
	if data != nil {
		fields.Data = r.data(data)
	}
	if seo != nil {
		r.seo(seo)
	}
	if rule := Validate(fields.Data, fields.SEO, RouteParams(fields.Path)); rule != "" {
		at := data
		if strings.Contains(rule, "SEO") || strings.Contains(rule, "describes") || at == nil {
			at = seo
		}
		if at == nil {
			at = root
		}
		r.problem(at, "This page "+rule+".")
	}
	if len(fields.Data) > MaxImports && data != nil {
		r.problem(data, "A page reads at most 8 pieces of data.")
	}
	return fields
}

var searchTypes = []string{"String", "Number", "Bool"}

func (r *reader) search(expr *cdsl.Expr) []SearchParam {
	if !expr.IsCall("Search") {
		r.problem(expr, `search is Search(name: String(default: ""), …): the page's search params, as ?name= in its address.`)
		return nil
	}
	var params []SearchParam
	for _, name := range expr.Args.Keys() {
		value := expr.Args.Get(name)
		if !searchName.MatchString(name) {
			r.problem(value, name+" isn't a usable search param name.")
		}
		t := ""
		if value.Kind == cdsl.Call {
			for _, known := range searchTypes {
				if known == value.Name {
					t = known
				}
			}
		}
		other := false
		for _, key := range value.Args.Keys() {
			other = other || key != "default"
		}
		if t == "" || len(value.Positional) > 0 || other {
			r.problem(value, name+" is String(default: …), Number(default: …) or Bool(default: …); its default is optional.")
			continue
		}
		param := SearchParam{Name: name, Type: t}
		if given := value.Arg("default"); given != nil {
			v := cdsl.LiteralValue(given)
			want := map[string]js.Kind{"String": js.String, "Number": js.Number, "Bool": js.Boolean}[t]
			if v.Kind() != want {
				what := map[string]string{"String": "text", "Number": "number", "Bool": "true or false"}[t]
				r.problem(given, name+"'s default is a "+what+".")
			} else {
				param.Default = v
			}
		}
		params = append(params, param)
	}
	if len(params) > 20 {
		r.problem(expr, "A page has at most 20 search params.")
	}
	return params
}

// value is where a parameter's value comes from.
func (r *reader) value(expr *cdsl.Expr, earlier map[string]bool, label string) (Param, bool) {
	literal := cdsl.LiteralValue(expr)
	if literal.Kind() == js.String || literal.Kind() == js.Number {
		return Param{From: "value", Value: literal.String()}, true
	}
	if expr.Kind == cdsl.Ref {
		family, field, dotted := strings.Cut(expr.Name, ".")
		single := dotted && !strings.Contains(field, ".")
		switch {
		case family == "route" && single:
			return Param{From: "route", Value: field}, true
		case family == "query" && single:
			return Param{From: "query", Value: field}, true
		case expr.Name == "site.store":
			return Param{From: "store"}, true
		case earlier[family]:
			return Param{From: "import", Value: expr.Name}, true
		}
	}
	r.problem(expr, label+" needs a value it can be fetched with: route.x (the path), query.x (the address), site.store, an earlier Data's field (such as dish.store_id) or a plain value.")
	return Param{}, false
}

// withFallback gives a query param its search param's default, for an address without it.
func (r *reader) withFallback(p Param) Param {
	if p.From != "query" {
		return p
	}
	for _, s := range r.fields.Search {
		if s.Name == p.Value && !s.Default.IsUndefined() {
			fallback := s.Default.String()
			p.Fallback = &fallback
		}
	}
	return p
}

func optionalText(e *cdsl.Expr) (string, bool) {
	if e == nil {
		return "", false
	}
	return cdsl.Text(e), true
}

func (r *reader) data(list *cdsl.Expr) []Import {
	if list.Kind != cdsl.List {
		r.problem(list, "data is a list: data: [Data(...), ...].")
		return nil
	}
	imports := []Import{}
	earlier := map[string]bool{}
	for _, item := range list.Items {
		if !item.IsCall("Data") {
			r.problem(item, "Each entry of data is a Data(name: ..., from: ...).")
			continue
		}
		name := cdsl.Text(item.Arg("name"))
		from := item.Arg("from")
		if name == "" {
			r.problem(item, "Data needs a name: the name the page reads it by.")
		}
		if from == nil || from.Kind != cdsl.Call {
			at := from
			if at == nil {
				at = item
			}
			r.problem(at, `Data "`+name+`" needs from: Tenant.… (the business's API), Client.… (the customer's own) or Http(...) (another API).`)
			continue
		}
		label := name
		if label == "" {
			label = "Data"
		}
		fetch := cdsl.LiteralValue(item.Arg("fetch"))
		if item.Arg("fetch") != nil && !(fetch.Kind() == js.String && (fetch.Str() == "server" || fetch.Str() == "client")) {
			r.problem(item.Arg("fetch"), `fetch is "server" (rendered into the page) or "client" (fetched in the browser once it's showing).`)
		}
		var entry Import
		switch {
		case strings.HasPrefix(from.Name, "Client."):
			resource := strings.TrimPrefix(from.Name, "Client.")
			if cdsl.ClientResources[resource] == "" {
				r.problem(from, "There's no "+from.Name+".")
				continue
			}
			for _, key := range from.Args.Keys() {
				r.problem(from.Args.Get(key), from.Name+"() takes no parameters: it's the customer's own.")
			}
			entry = Import{Name: name, Source: "client", Resource: resource}
		case strings.HasPrefix(from.Name, "Tenant."):
			resource := strings.TrimPrefix(from.Name, "Tenant.")
			known, ok := Resources[resource]
			if !ok {
				r.problem(from, "There's no "+from.Name+".")
				continue
			}
			entry = Import{Name: name, Source: "tenant", Resource: resource}
			for _, key := range from.Args.Keys() {
				value := from.Args.Get(key)
				declared := false
				for _, p := range known.Params {
					declared = declared || p.Name == key
				}
				if !declared {
					r.problem(value, from.Name+" has no parameter "+key+".")
					continue
				}
				if p, ok := r.value(value, earlier, label+"."+key); ok {
					p.Name = key
					entry.Params = append(entry.Params, r.withFallback(p))
				}
			}
		case from.Name == "Http":
			entry = Import{Name: name, Source: "external", URL: cdsl.Text(from.Arg("url"))}
			if secret, ok := optionalText(from.Arg("secret")); ok {
				entry.Secret = secret
			}
			if header, ok := optionalText(from.Arg("header")); ok {
				entry.SecretHeader = header
			}
			given := from.Arg("params")
			if given != nil && given.Kind != cdsl.List {
				r.problem(given, "params is a list: params: [Param(name: ..., value: ...)].")
			}
			for _, param := range cdsl.ListItems(given) {
				if !param.IsCall("Param") || param.Arg("value") == nil {
					r.problem(param, "Each of params is a Param(name: ..., value: ...).")
					continue
				}
				key := cdsl.Text(param.Arg("name"))
				if p, ok := r.value(param.Arg("value"), earlier, label+"."+key); ok {
					p.Name = key
					entry.Params = append(entry.Params, r.withFallback(p))
				}
			}
		default:
			r.problem(from, "from is Tenant.… (the business's API), Client.… (the customer's own) or Http(...) (another API), not "+from.Name+".")
			continue
		}
		if sel, ok := optionalText(item.Arg("select")); ok && sel != "" {
			entry.Select = sel
		}
		if fetch.Kind() == js.String && fetch.Str() == "client" {
			entry.Fetch = "client"
		}
		if typeArg := item.Arg("type"); typeArg != nil {
			if typeArg.Kind != cdsl.Ref {
				r.problem(typeArg, "type is one of the API's types: Store, Product, Order…, or Json.")
			} else {
				declared := typeArg.Name
				if js.StrictEquals(cdsl.LiteralValue(item.Arg("list")), js.BoolValue(true)) {
					declared += "[]"
				}
				held := DeclaredType(entry, declared)
				if held.Problem != "" {
					r.problem(typeArg, held.Problem)
				}
				if held.Select != "" && entry.Select == "" {
					entry.Select = held.Select
				}
				if held.Type != "" {
					entry.Type = held.Type
				}
			}
		}
		imports = append(imports, entry)
		if name != "" {
			earlier[name] = true
		}
	}
	return imports
}

func (r *reader) seo(seo *cdsl.Expr) {
	if !seo.IsCall("Seo") {
		r.problem(seo, "seo is Seo(title: ..., description: ..., image: ..., schema: ...).")
		return
	}
	out := &SEO{}
	// The head's fields are expressions over the page's data: kept as written.
	text := func(key string) string {
		if e := seo.Arg(key); e != nil {
			return js.Slice(r.source, e.From, e.To)
		}
		return ""
	}
	out.Title, out.Description, out.Image = text("title"), text("description"), text("image")
	if schema := seo.Arg("schema"); schema != nil {
		kind := ""
		var subject *cdsl.Expr
		if schema.Kind == cdsl.Call {
			kind = schemaNames[schema.Name]
			subject = schema.Arg("of")
		}
		if kind == "" || subject == nil || subject.Kind != cdsl.Ref || strings.Contains(subject.Name, ".") {
			r.problem(schema, "schema is Schema.product(of: dish) or Schema.restaurant(of: store): what it describes, by its Data name.")
		} else {
			out.Schema, out.Subject = kind, subject.Name
		}
	}
	for _, key := range []string{"sitemap", "index"} {
		given := seo.Arg(key)
		if given == nil {
			continue
		}
		v := cdsl.LiteralValue(given)
		if v.Kind() != js.Boolean {
			r.problem(given, key+" is true or false.")
			continue
		}
		b := v.Bool()
		if key == "sitemap" {
			out.Sitemap = &b
		} else {
			out.Index = &b
		}
	}
	r.fields.SEO = out
}

// Held is a declared type held to its source: the select and type the
// import takes from it, or why it can't be.
type Held struct {
	Select, Type, Problem string
}

// declaredResourceType is a tenant read's type as a page declares it.
func declaredResourceType(resource string) string {
	if t := resourceTypes[resource]; t != "PreviewProduct" {
		return t
	}
	return "Product"
}

// DeclaredType holds dish<Product> or stores<Store[]> to the import's source
// (pageData.ts's declaredType).
func DeclaredType(imp Import, declared string) Held {
	if declared == "Json" {
		return Held{}
	}
	element := strings.TrimSuffix(declared, "[]")
	if m := pageOf.FindStringSubmatch(element); m != nil {
		element = m[1]
	}
	if len(cdsl.BindingFields(element)) == 0 {
		return Held{Problem: "There's no type " + declared + ": the API's are Store, Product, Category, Menu, Order, Address, Me… or Json for any shape."}
	}
	if imp.Source == "client" && cdsl.ClientResources[imp.Resource] != "" {
		own := cdsl.ClientResources[imp.Resource]
		if declared == own {
			return Held{}
		}
		return Held{Problem: "Client." + imp.Resource + "() is " + own + ": declare <" + own + ">."}
	}
	if imp.Source != "tenant" || imp.Resource == "" || imp.Select != "" {
		return Held{Type: declared}
	}
	own := resourceTypes[imp.Resource]
	said := declaredResourceType(imp.Resource)
	if declared == own || declared == said {
		return Held{}
	}
	if m := pageOf.FindStringSubmatch(own); m != nil {
		if declared == m[1]+"[]" {
			return Held{Select: "data", Type: declared}
		}
		return Held{Problem: "Tenant." + imp.Resource + "() is a list of " + m[1] + ": declare <" + m[1] + "[]> (or <" + said + ">, with next_cursor)."}
	}
	return Held{Problem: "Tenant." + imp.Resource + "() is " + said + ": declare <" + said + ">."}
}
