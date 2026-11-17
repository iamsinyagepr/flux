package web

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/pagedata"
)

// importsTable is data.server.ts's IMPORTS, as data.
func importsTable(t *testing.T, r Result) map[string]map[string]map[string]any {
	t.Helper()
	source := files(r)["src/data.server.ts"]
	start := strings.Index(source, "const IMPORTS: Record<string, Record<string, FetchSpec>> = ")
	end := strings.Index(source, "};\n")
	if start < 0 || end < 0 {
		t.Fatalf("no IMPORTS in data.server.ts:\n%s", source)
	}
	raw := source[start+len("const IMPORTS: Record<string, Record<string, FetchSpec>> = ") : end+1]
	var table map[string]map[string]map[string]any
	if err := json.Unmarshal([]byte(raw), &table); err != nil {
		t.Fatalf("%v:\n%s", err, raw)
	}
	return table
}

func fieldsJSON(spec map[string]any) string {
	raw, _ := json.Marshal(spec["fields"])
	return string(raw)
}

var storesImport = []pagedata.Import{{Name: "stores", Source: "tenant", Resource: "stores", Select: "data", Type: "Store[]"}}

func storesPage(build string) dart.Page {
	source := "Page(name: \"Stores\", route: Route(path: \"/stores\"))\n\nusingServer(\n  stores<Store[]>(src: Tenant.stores()),\n)\n\n" + build
	return dart.Page{ID: "stores", Name: "Stores", Path: "/stores", Source: source, Data: storesImport}
}

func compilePages(t *testing.T, components map[string]string, pages ...dart.Page) Result {
	t.Helper()
	sources := js.NewObject[string]()
	for name, source := range components {
		sources.Set(name, source)
	}
	r := Compile(Input{Name: "Shop", Pages: pages, EntryPageID: pages[0].ID, ComponentSources: sources, APIURL: "https://tenant.example"})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	return r
}

// A store list read for its names and images is fetched as names and
// images (and each one's id, its key in the list).
func TestPageImportKeepsOnlyTheFieldsRead(t *testing.T) {
	r := compilePages(t, nil, storesPage(`Build(
  Column(children: [
    Text(child: "${length(stores)} stores"),
    ForEach(items: stores, as: "s", child: Column(children: [
      Text(child: s.name),
      If(condition: s.logo_url, then: Image(src: s.logo_url, alt: s.name)),
    ])),
  ])
)`))
	got := fieldsJSON(importsTable(t, r)["stores"]["stores"])
	if want := `{"id":true,"logo_url":true,"name":true}`; got != want {
		t.Errorf("fields %s, want %s", got, want)
	}
	// The page's server function trims; the apps' /studio-data doesn't.
	server := files(r)["src/data.ts"]
	if !strings.Contains(server, "fetchPageImport(data.page, data.name, data.params, true)") {
		t.Errorf("the page's server function doesn't trim:\n%s", server)
	}
}

// A component given a store reads what it reads of its option, on the
// store; what it reads of the bindings is the page's too.
func TestPageImportFollowsComponentOptions(t *testing.T) {
	card := `Component(id: "shop/store-card", name: "StoreCard", kind: Kind.section, description: "A store.")

Options(
  store<Store>(required: true),
)

Build(
  Column(children: [Text(child: options.store.name), Text(child: formatMoney(options.store.delivery_fee_cents))])
)`
	r := compilePages(t, map[string]string{"StoreCard": card}, storesPage(`Build(
  Column(children: [ForEach(items: stores, as: "s", child: StoreCard(store: s))])
)`))
	got := fieldsJSON(importsTable(t, r)["stores"]["stores"])
	if want := `{"delivery_fee_cents":true,"id":true,"name":true}`; got != want {
		t.Errorf("fields %s, want %s", got, want)
	}
}

// A record handed to an action, or read whole, is sent whole: the action
// reads it as it likes.
func TestPageImportWholeWhereNotFollowed(t *testing.T) {
	r := compilePages(t, nil, storesPage(`Build(
  Column(children: [ForEach(items: stores, as: "s", child: Button(label: s.name, onTap: ChooseStore(store: s)))])
)`))
	if spec := importsTable(t, r)["stores"]["stores"]; spec["fields"] != nil {
		t.Errorf("a store handed to ChooseStore is trimmed: %s", fieldsJSON(spec))
	}
}

// filter and search read their fields on each item, and are still the list.
func TestPageImportFieldsThroughListFunctions(t *testing.T) {
	r := compilePages(t, nil, storesPage(`State(
  query: String(default: ""),
)

Build(
  Column(children: [ForEach(items: search(filter(stores, "is_open", true), state.query, ["name", "city.name"]), as: "s", child: Text(child: s.slug))])
)`))
	got := fieldsJSON(importsTable(t, r)["stores"]["stores"])
	if want := `{"city":{"name":true},"id":true,"is_open":true,"name":true,"slug":true}`; got != want {
		t.Errorf("fields %s, want %s", got, want)
	}
}
