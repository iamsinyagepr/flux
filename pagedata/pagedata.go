// Package pagedata is what a Studio page fetches before it's drawn, and the
// SEO it builds from it: the page's Data and SEO settings.
//
// A developer chooses each import by hand: from the tenant API (one of
// Resources) or an external API (a URL), named as the page's CDSL reads it,
// with each parameter taken from the route, the query string, a fixed value,
// another import or the site's store. The website fetches them on the server
// (rendered there, its SEO in the HTML); the Flutter app when the page opens.
// upskaleapp's lib/studio/pageData.ts holds the same rules for the editor.
package pagedata

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/iamsinyagepr/flux/cdsl"
)

// Import is one piece of data a page fetches.
type Import struct {
	// Name is how the page's CDSL reads it: an import named like a built-in
	// binding (product, store) replaces it on this page.
	Name string `json:"name"`
	// Source is "tenant" (Resource), "external" (URL) or "client" (Resource:
	// one of cdsl.ClientResources, the customer's own, never fetched).
	Source   string `json:"source"`
	Resource string `json:"resource,omitempty"`
	// URL is an external API's address, https, with {param} placeholders.
	URL string `json:"url,omitempty"`
	// Select is a dotted path into the answer ("data", "results.0"): the part
	// the page reads. Empty is all of it.
	Select string `json:"select,omitempty"`
	// Secret names a website secret sent with an external request, in
	// SecretHeader ("Authorization" when empty, as "Bearer <secret>"). Only
	// the server ever reads it.
	Secret       string  `json:"secret,omitempty"`
	SecretHeader string  `json:"secretHeader,omitempty"`
	Params       []Param `json:"params,omitempty"`
	// Fetch is where a website fetches it: "server" (the default, also
	// empty: rendered into the page, and its SEO can read it) or "client"
	// (by the browser once the page is showing, with TanStack Query). The
	// apps fetch every import when the page opens.
	Fetch string `json:"fetch,omitempty"`
	// Type is what the page reads it as when that isn't the source's own:
	// a list from a page of them ("Store[]", with Select "data"), or another
	// API's answer as one of the API's types. Written dish<Product>(...) in
	// the block form (upskaleapp's CDSL.md, pageData.ts's declaredType).
	Type string `json:"type,omitempty"`
}

// OnClient is whether a website fetches the import in the browser.
func (imp Import) OnClient() bool { return imp.Fetch == "client" }

// Param is where one parameter's value comes from.
type Param struct {
	Name string `json:"name"`
	// From is "route" (a path param, Value its name), "query" (a query
	// string key), "value" (Value itself), "import" (Value a dotted path into
	// an earlier import: "dish.store_id") or "store" (the site's store).
	From  string `json:"from"`
	Value string `json:"value,omitempty"`
	// Fallback is a query param's value when the address has none: its
	// search param's default (Route(search: Search(page: Number(default: 1)))).
	Fallback *string `json:"fallback,omitempty"`
}

// SEO is a page's head, each field a CDSL expression over its data
// ("${dish.name} | ${store.name}"). Empty fields fall back to the site's.
type SEO struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	Image       string `json:"image,omitempty"`
	// Schema is the schema.org type described: Product (from Subject's
	// name, description, image and display_price_cents), Restaurant (a
	// store), or empty.
	Schema string `json:"schema,omitempty"`
	// Subject is the import the schema describes.
	Subject string `json:"subject,omitempty"`
	// Sitemap is whether the website's sitemap.xml lists the page: absent
	// is yes, for a page at one address (no $params).
	Sitemap *bool `json:"sitemap,omitempty"`
	// Index is whether search engines may index it: false says noindex, and
	// leaves it out of the sitemap.
	Index *bool `json:"index,omitempty"`
}

// ResourceParam is a tenant resource's parameter.
type ResourceParam struct {
	Name     string `json:"name"`
	Required bool   `json:"required"`
	// InPath: a {name} in the path; otherwise a query string parameter.
	InPath bool `json:"inPath"`
}

// Resource is one of the tenant API's public reads.
type Resource struct {
	Path   string          `json:"path"`
	Params []ResourceParam `json:"params"`
	// Binding is the built-in binding with the same data, when there is one.
	Label string `json:"label"`
	// Auth is the signed-in customer's: fetched by the browser or the app
	// with their session, never by the website's server.
	Auth bool `json:"auth,omitempty"`
}

// Resources are the tenant reads a page can import: public routes, which the
// website's server renders with, and the signed-in customer's (Auth), which
// only the browser and the apps can ask for.
var Resources = map[string]Resource{
	"store":           {Label: "A store", Path: "/stores/{store}", Params: []ResourceParam{{Name: "store", Required: true, InPath: true}}},
	"menu":            {Label: "A store's menu", Path: "/stores/{store}/menu", Params: []ResourceParam{{Name: "store", Required: true, InPath: true}}},
	"stores":          {Label: "Stores", Path: "/stores", Params: []ResourceParam{{Name: "q"}, {Name: "city"}, {Name: "cuisine"}, {Name: "limit"}}},
	"product":         {Label: "A product, with its options", Path: "/products/{id}", Params: []ResourceParam{{Name: "id", Required: true, InPath: true}}},
	"products":        {Label: "A store's products", Path: "/stores/{store}/products", Params: []ResourceParam{{Name: "store", Required: true, InPath: true}, {Name: "category_id"}, {Name: "limit"}}},
	"categories":      {Label: "A store's categories", Path: "/stores/{store}/categories", Params: []ResourceParam{{Name: "store", Required: true, InPath: true}}},
	"category":        {Label: "A category", Path: "/categories/{id}", Params: []ResourceParam{{Name: "id", Required: true, InPath: true}}},
	"cuisines":        {Label: "Cuisines", Path: "/cuisines"},
	"cities":          {Label: "Cities with stores", Path: "/cities"},
	"deliveryOptions": {Label: "A store's delivery options", Path: "/stores/{store}/delivery-options", Params: []ResourceParam{{Name: "store", Required: true, InPath: true}}},
	"reviews":         {Label: "A store's reviews", Path: "/stores/{store}/reviews", Params: []ResourceParam{{Name: "store", Required: true, InPath: true}, {Name: "limit"}}},
	"me":              {Label: "The signed-in customer", Path: "/me", Params: []ResourceParam{}, Auth: true},
	"history":         {Label: "The signed-in customer's orders", Path: "/orders", Params: []ResourceParam{{Name: "limit"}}, Auth: true},
	"order":           {Label: "One of the signed-in customer's orders", Path: "/orders/{id}", Params: []ResourceParam{{Name: "id", Required: true, InPath: true}}, Auth: true},
	"addresses":       {Label: "The signed-in customer's addresses", Path: "/addresses", Params: []ResourceParam{}, Auth: true},
}

// Limits on a page's data.
const (
	MaxImports       = 8
	MaxParams        = 8
	MaxURLLength     = 500
	MaxValueLength   = 200
	MaxSEOExprLength = 300
)

var (
	identifier  = regexp.MustCompile(`^[a-z][A-Za-z0-9_]{0,39}$`)
	paramName   = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_-]{0,39}$`)
	secretName  = regexp.MustCompile(`^[A-Z][A-Z0-9_]{0,39}$`)
	headerName  = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9-]{0,63}$`)
	selectPath  = regexp.MustCompile(`^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$`)
	placeholder = regexp.MustCompile(`\{([A-Za-z_][A-Za-z0-9_-]*)\}`)
	// Names a page can't import under: what CDSL reads as something else.
	reserved = map[string]bool{"state": true, "options": true, "event": true, "input": true, "route": true, "viewport": true}
	froms    = map[string]bool{"route": true, "query": true, "value": true, "import": true, "store": true}
	schemas  = map[string]bool{"": true, "Product": true, "Restaurant": true}
)

// Placeholders are the {params} an external URL names, in order.
func Placeholders(raw string) []string {
	var out []string
	for _, m := range placeholder.FindAllStringSubmatch(raw, -1) {
		out = append(out, m[1])
	}
	return out
}

// Validate reports the first problem with a page's data, or "". routeParams
// are the $names its path declares.
func Validate(imports []Import, seo *SEO, routeParams []string) string {
	if len(imports) > MaxImports {
		return "has more than 8 data imports"
	}
	seen := map[string]bool{}
	for _, imp := range imports {
		if !identifier.MatchString(imp.Name) || reserved[imp.Name] {
			return "has an invalid import name: " + imp.Name
		}
		if seen[imp.Name] {
			return "imports " + imp.Name + " twice"
		}
		var needed []string
		switch imp.Source {
		case "client":
			if cdsl.ClientResources[imp.Resource] == "" {
				return imp.Name + " imports an unknown client resource: " + imp.Resource
			}
			if !imp.OnClient() {
				return imp.Name + " is the browser's own (Client." + imp.Resource + "()): it goes in usingClient"
			}
			if len(imp.Params) > 0 || imp.Select != "" {
				return imp.Name + " takes no parameters or select: Client." + imp.Resource + "() is the customer's own"
			}
		case "tenant":
			resource, ok := Resources[imp.Resource]
			if !ok {
				return imp.Name + " imports an unknown tenant resource: " + imp.Resource
			}
			if resource.Auth && !imp.OnClient() {
				return imp.Name + " is the signed-in customer's (Tenant." + imp.Resource + "): only the browser has their session, so it goes in usingClient"
			}
			for _, p := range resource.Params {
				if p.Required {
					needed = append(needed, p.Name)
				}
			}
			for _, p := range imp.Params {
				known := false
				for _, rp := range resource.Params {
					known = known || rp.Name == p.Name
				}
				if !known {
					return imp.Name + " has no parameter " + p.Name
				}
			}
		case "external":
			u, err := url.Parse(imp.URL)
			if len(imp.URL) > MaxURLLength || err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
				return imp.Name + " needs an https address"
			}
			needed = Placeholders(imp.URL)
			if imp.Secret != "" && !secretName.MatchString(imp.Secret) {
				return imp.Name + "'s secret must be named in CAPITALS (API_KEY)"
			}
			if imp.SecretHeader != "" && (!headerName.MatchString(imp.SecretHeader) || imp.Secret == "") {
				return imp.Name + " has an invalid secret header"
			}
		default:
			return imp.Name + " must come from the tenant, the client or an external API"
		}
		if imp.Select != "" && !selectPath.MatchString(imp.Select) {
			return imp.Name + " has an invalid selection: " + imp.Select
		}
		if len(imp.Params) > MaxParams {
			return imp.Name + " has more than 8 parameters"
		}
		given := map[string]bool{}
		for _, p := range imp.Params {
			if !paramName.MatchString(p.Name) || given[p.Name] {
				return imp.Name + " has an invalid or repeated parameter: " + p.Name
			}
			given[p.Name] = true
			if !froms[p.From] || len(p.Value) > MaxValueLength {
				return imp.Name + "." + p.Name + " needs a source: route, query, value, import or store"
			}
			switch p.From {
			case "route":
				found := false
				for _, r := range routeParams {
					found = found || r == p.Value
				}
				if !found {
					return imp.Name + "." + p.Name + " reads $" + p.Value + ", which the page's path doesn't have"
				}
			case "query":
				if !paramName.MatchString(p.Value) {
					return imp.Name + "." + p.Name + " needs a query string key"
				}
			case "import":
				head, _, _ := strings.Cut(p.Value, ".")
				if !seen[head] {
					return imp.Name + "." + p.Name + " reads " + head + ", which isn't imported before it"
				}
			}
		}
		for _, name := range needed {
			if !given[name] {
				return imp.Name + " needs a value for " + name
			}
		}
		seen[imp.Name] = true
	}
	if seo != nil {
		for _, field := range []string{seo.Title, seo.Description, seo.Image} {
			if len(field) > MaxSEOExprLength {
				return "has an SEO field longer than 300 characters"
			}
		}
		if !schemas[seo.Schema] {
			return "has an unknown SEO schema: " + seo.Schema
		}
		if seo.Schema != "" && !seen[seo.Subject] && seo.Subject != "store" && seo.Subject != "product" {
			return "describes " + seo.Subject + ", which isn't imported"
		}
	}
	return ""
}

var routeParam = regexp.MustCompile(`\$([A-Za-z_][A-Za-z0-9_]*)`)

// RouteParams are a page path's $params.
func RouteParams(path string) []string {
	var out []string
	for _, m := range routeParam.FindAllStringSubmatch(path, -1) {
		out = append(out, m[1])
	}
	return out
}

// resourceTypes are what each tenant read answers with, as Studio's binding
// schemas name it (pageData.ts's RESOURCE_TYPES).
var resourceTypes = map[string]string{
	"me": "Me", "history": "Page<Order>", "order": "Order", "addresses": "Page<Address>",
	"store": "Store", "menu": "Menu", "stores": "Page<Store>", "product": "PreviewProduct",
	"products": "Page<Product>", "categories": "Page<Category>", "category": "Category",
	"cuisines": "Page<Cuisine>", "cities": "Page<StoreCity>", "deliveryOptions": "DeliveryOptions",
	"reviews": "Page<OrderReview>",
}

// ImportScope is a page's imports as names its CDSL may read, each with its
// type: a tenant read's own, or "json" (any field) for an external API or a
// selection (pageData.ts's importScope).
func ImportScope(imports []Import) map[string]string {
	if len(imports) == 0 {
		return nil
	}
	out := make(map[string]string, len(imports))
	for _, imp := range imports {
		t := "json"
		switch {
		case imp.Type != "":
			t = imp.Type
		case imp.Source == "client" && cdsl.ClientResources[imp.Resource] != "":
			t = cdsl.ClientResources[imp.Resource]
		case imp.Source == "tenant" && imp.Select == "" && resourceTypes[imp.Resource] != "":
			t = resourceTypes[imp.Resource]
		}
		out[imp.Name] = t
	}
	return out
}

// RequiredParams are the parameters an import can't be fetched without: a
// tenant read's required ones, or an external address's {placeholders}.
func RequiredParams(imp Import) []string {
	if imp.Source == "client" {
		return []string{}
	}
	if imp.Source == "external" {
		if names := Placeholders(imp.URL); names != nil {
			return names
		}
		return []string{}
	}
	out := []string{}
	for _, p := range Resources[imp.Resource].Params {
		if p.Required {
			out = append(out, p.Name)
		}
	}
	return out
}

// ImportsResource is whether any page imports the tenant's resource (menu,
// cities…): then the runtime leaves fetching it to those pages instead of
// loading it for the whole app (flutterProject.ts's pagesImportMenu, the web
// runtime's pageResources).
func ImportsResource(pages [][]Import, resource string) bool {
	for _, imports := range pages {
		for _, imp := range imports {
			if imp.Source == "tenant" && imp.Resource == resource {
				return true
			}
		}
	}
	return false
}
