package web

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/pagedata"
)

// modules.json is made from the runtime's sources as they are: after any
// change to them, run upskaleapp's `node scripts/export-web-runtime.mjs`.
func TestRuntimeModulesAreFresh(t *testing.T) {
	idx := runtimeModules()
	if len(idx.Sources) == 0 {
		t.Fatal("modules.json lists no sources")
	}
	for path, want := range idx.Sources {
		raw, err := os.ReadFile(filepath.Join("runtime", filepath.FromSlash(path)))
		if err != nil {
			t.Fatal(err)
		}
		sum := sha256.Sum256([]byte(strings.ReplaceAll(string(raw), "\r\n", "\n")))
		if hex.EncodeToString(sum[:]) != want {
			t.Errorf("%s changed since modules.json was made: run upskaleapp's node scripts/export-web-runtime.mjs", path)
		}
	}
}

func files(r Result) map[string]string {
	out := map[string]string{}
	for _, f := range r.Files {
		out[f.Path] = f.Content
	}
	return out
}

// A one-page site with only text gets the text: not the runtime's carousels,
// fields and drawers, nor their styles, nor a page component reading state,
// options and bindings it doesn't have.
func TestASiteGetsOnlyWhatItUses(t *testing.T) {
	r := Compile(Input{Name: "Hello", Pages: []dart.Page{{ID: "home", Name: "Home", Path: "/",
		Source: `Page(name: "Home", build: Text(child: "Hello"))`}}, EntryPageID: "home"})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	f := files(r)
	widgets := f["src/studio/widgets.tsx"]
	if !strings.Contains(widgets, "export function Text(") {
		t.Fatal("widgets.tsx has no Text")
	}
	for _, unused := range []string{"function Carousel", "SearchField", "function TextInput", "function Drawer", "function Tabs", "LocationChooser"} {
		if strings.Contains(widgets, unused) {
			t.Errorf("widgets.tsx has %s, which nothing uses", unused)
		}
	}
	if strings.Contains(widgets, "react-icons/md") {
		t.Error("widgets.tsx imports icons nothing draws")
	}
	css := f["src/studio/studio.css"]
	for _, unused := range []string{".studio-carousel", ".studio-drawer", ".studio-input", ".studio-location"} {
		if strings.Contains(css, unused) {
			t.Errorf("studio.css has %s rules, which nothing draws", unused)
		}
	}
	if !strings.Contains(css, ".studio-text") {
		t.Error("studio.css has no .studio-text")
	}
	page := f["src/pages/home.tsx"]
	for _, unused := range []string{"useState", "useStudio", "const o", "const act", "void "} {
		if strings.Contains(page, unused) {
			t.Errorf("the page has %q, which it doesn't use:\n%s", unused, page)
		}
	}
	for _, path := range []string{"src/data.ts", "src/data.server.ts", "src/routes/studio-data.ts", "src/studio/fetch.server.ts"} {
		if _, ok := f[path]; ok {
			t.Errorf("a site without data has %s", path)
		}
	}
	if strings.Contains(f["vite.config.ts"], "studio-data") {
		t.Error("a site without secret data routes /studio-data")
	}
}

// A component reading state and options gets them, and only them.
func TestAComponentReadsWhatItDeclares(t *testing.T) {
	r := Compile(Input{Name: "Counter", Pages: []dart.Page{{ID: "home", Name: "Home", Path: "/",
		Source: `Page(name: "Home", states: [NumberState(name: "count", default: 0)],
  build: Button(label: "Count ${state.count}", onTap: SetState(state: "count", value: state.count + 1)))`}}, EntryPageID: "home"})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	page := files(r)["src/pages/home.tsx"]
	for _, want := range []string{"import { useState }", "const [st, setSt]"} {
		if !strings.Contains(page, want) {
			t.Errorf("the page has no %q:\n%s", want, page)
		}
	}
	if strings.Contains(page, "const o:") || strings.Contains(page, "const act") {
		t.Errorf("the page declares options or actions it doesn't read:\n%s", page)
	}
}

func dishPage(fetchStore string, seo *pagedata.SEO) dart.Page {
	return dart.Page{ID: "dish", Name: "Dish", Path: "/dishes/$dish",
		Source: `Page(name: "Dish", build: Column(children: [Text(child: dish.name), Text(child: store.name)]))`,
		Data: []pagedata.Import{
			{Name: "dish", Source: "tenant", Resource: "product", Params: []pagedata.Param{{Name: "id", From: "route", Value: "dish"}}},
			{Name: "store", Source: "tenant", Resource: "store", Fetch: fetchStore,
				Params: []pagedata.Param{{Name: "store", From: "import", Value: "dish.store_id"}}},
		},
		SEO: seo,
	}
}

// Server Data is awaited in the route's loader (rendered into the page);
// client Data is a useQuery in the page, enabled once it has what it needs.
// Both are the page's own queryOptions.
func TestPageDataIsTanStackQueries(t *testing.T) {
	r := Compile(Input{Name: "Dishes", Pages: []dart.Page{dishPage("client", &pagedata.SEO{Title: "dish.name"})}, EntryPageID: "dish",
		APIURL: "https://tenant.example"})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	f := files(r)
	queries := f["src/queries/dish.ts"]
	for _, want := range []string{"export const dishQuery", "export const storeQuery", "queryOptions(", "fetchImport("} {
		if !strings.Contains(queries, want) {
			t.Errorf("queries have no %q:\n%s", want, queries)
		}
	}
	route := f["src/routes/page-dish.tsx"]
	for _, want := range []string{
		"loader: async", `const d_dishParams = rt.params({ "id": params["dish"] });`,
		"queryClient.ensureQueryData(dishQuery(d_dishParams))",
		`rt.params({ "store": rt.read(server["dish"], ["store_id"]) })`,
		`useQuery({ ...storeQuery(d_storeParams), enabled: Boolean(d_storeParams["store"]) })`,
		"head: ({ loaderData, match })",
	} {
		if !strings.Contains(route, want) {
			t.Errorf("the route has no %q:\n%s", want, route)
		}
	}
	if strings.Contains(route, "ensureQueryData(storeQuery") {
		t.Errorf("client data is fetched in the loader:\n%s", route)
	}
	if _, ok := f["src/studio/fetch.server.ts"]; !ok {
		t.Error("a site with data has no fetch.server.ts")
	}
}

// The head is made on the server: it can't read client Data, and server
// Data can't wait on it either.
func TestClientDataStaysOnTheClient(t *testing.T) {
	r := Compile(Input{Name: "Dishes", Pages: []dart.Page{dishPage("client", &pagedata.SEO{Title: "store.name"})}, EntryPageID: "dish"})
	if r.Success || !strings.Contains(r.Diagnostics[len(r.Diagnostics)-1].Message, "fetched in the browser") {
		t.Fatalf("SEO read client data: %+v", r.Diagnostics)
	}
	page := dishPage("", nil)
	page.Data[0].Fetch = "client"
	r = Compile(Input{Name: "Dishes", Pages: []dart.Page{page}, EntryPageID: "dish"})
	if r.Success || !strings.Contains(r.Diagnostics[len(r.Diagnostics)-1].Message, "on the server too") {
		t.Fatalf("server data read client data: %+v", r.Diagnostics)
	}
}

// The signed-in customer's Data is the browser's to ask for, with their
// session: a query keyed by it, never the site's server, and never on the
// server's render.
func TestSignedInDataIsTheBrowsers(t *testing.T) {
	orders := dart.Page{ID: "orders", Name: "Orders", Path: "/orders",
		Source: `Page(name: "Orders", build: Text(child: "${orders.length} orders"))`,
		Data:   []pagedata.Import{{Name: "orders", Source: "tenant", Resource: "history", Fetch: "client", Select: "data", Type: "Order[]"}}}
	r := Compile(Input{Name: "Orders", Pages: []dart.Page{orders}, EntryPageID: "orders"})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	f := files(r)
	queries := f["src/queries/orders.ts"]
	for _, want := range []string{`rt.signedInRead("/orders", ["limit"], params, "data")`, `queryKey: ["orders", "orders", session, params]`} {
		if !strings.Contains(queries, want) {
			t.Errorf("queries have no %q:\n%s", want, queries)
		}
	}
	if strings.Contains(queries, "fetchImport") {
		t.Errorf("signed-in data goes through the server:\n%s", queries)
	}
	route := f["src/routes/page-orders.tsx"]
	if !strings.Contains(route, "const session = rt.useSession();") || strings.Contains(route, "loader:") {
		t.Errorf("the route doesn't ask in the browser by session:\n%s", route)
	}
	if _, ok := f["src/data.server.ts"]; ok {
		t.Error("a site with only signed-in data has the server's data table")
	}
	orders.Data[0].Fetch = ""
	if r := Compile(Input{Name: "Orders", Pages: []dart.Page{orders}, EntryPageID: "orders"}); r.Success {
		t.Error("signed-in data compiled to be fetched on the server")
	}
}

// Search params: a Navigate's go in the address it opens, a page's data
// reads them with their defaults; SEO keeps a page out of the sitemap, or
// out of search engines altogether.
func TestSearchParamsAndTheSitemap(t *testing.T) {
	p := readGolden(t, "corpus-blocks-search")
	r := Compile(Input{Name: "Search", Pages: p.Pages, EntryPageID: p.EntryPageID, ComponentSources: p.ComponentSources,
		Site: []byte(`{"site_url":"https://shop.example.com"}`)})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	f := files(r)
	if home := f["src/pages/home.tsx"]; !strings.Contains(home, `s.navigate("/stores", { "city": rt.read(st, ["city"]), "page": 2 })`) {
		t.Errorf("the Navigate doesn't pass its search params:\n%s", home)
	}
	if route := f["src/routes/page-stores.tsx"]; !strings.Contains(route, `"city": (search["city"] ?? "")`) || !strings.Contains(route, `"limit": (search["page"] ?? "1")`) {
		t.Errorf("the data doesn't read its search params with their defaults:\n%s", route)
	}
	sitemap := f["public/sitemap.xml"]
	if !strings.Contains(sitemap, "https://shop.example.com/</loc>") || strings.Contains(sitemap, "/stores") || strings.Contains(sitemap, "/hidden") {
		t.Errorf("the sitemap lists the wrong pages:\n%s", sitemap)
	}
	if hidden := f["src/routes/page-hidden.tsx"]; !strings.Contains(hidden, "noindex: true") {
		t.Errorf("a page not to be indexed doesn't say so:\n%s", hidden)
	}
	if runtime := f["src/studio/runtime.tsx"]; !strings.Contains(runtime, `{ name: "robots", content: "noindex" }`) {
		t.Error("the runtime doesn't write noindex")
	}
}
