package flux

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"github.com/iamsinyagepr/flux/dart"
)

// Compilation must be deterministic — the response cache depends on it, and
// Go randomises map iteration, which is exactly how it would stop being.
func TestCompileIsDeterministic(t *testing.T) {
	var input goldenInput
	data, err := os.ReadFile(filepath.Join("testdata", "golden", "storefront-custom-config", "input.json"))
	if err != nil {
		t.Skip("golden cases not exported")
	}
	if err := json.Unmarshal(data, &input); err != nil {
		t.Fatal(err)
	}
	first, _ := json.Marshal(Compile(input.Project, input.APIURL))
	for i := 0; i < 30; i++ {
		again, _ := json.Marshal(Compile(input.Project, input.APIURL))
		if string(again) != string(first) {
			t.Fatalf("compile %d differs from the first", i+2)
		}
	}
}

func TestValidateMatchesTheEditorsLimits(t *testing.T) {
	page := map[string]string{"id": "home", "name": "Home", "path": "/", "source": "x"}
	cases := map[string]struct {
		project string
		ok      bool
	}{
		"single source":       {`{"name":"a","source":"x"}`, true},
		"app":                 {`{"name":"a","source":"x","pages":[` + must(page) + `],"entryPageId":"home","shellSource":""}`, true},
		"no pages":            {`{"name":"a","source":"x","pages":[],"entryPageId":"home"}`, false},
		"missing entry":       {`{"name":"a","source":"x","pages":[` + must(page) + `],"entryPageId":"nope"}`, false},
		"bad component":       {`{"name":"a","source":"x","componentSources":{"lower":"x"}}`, false},
		"invalid config":      {`{"name":"a","source":"x","config":{"colors":{}}}`, false},
		"valid config":        {`{"name":"a","source":"x","config":{"colors":{"brand":"#123456"},"spacing":{},"radii":{},"fontSizes":{},"iconSizes":{},"iconLibrary":"feather"}}`, true},
		"transition":          {`{"name":"a","source":"x","config":{"colors":{},"spacing":{},"radii":{},"fontSizes":{},"iconSizes":{},"iconLibrary":"material","pageTransition":"fade"}}`, true},
		"bad transition":      {`{"name":"a","source":"x","config":{"colors":{},"spacing":{},"radii":{},"fontSizes":{},"iconSizes":{},"iconLibrary":"material","pageTransition":"spin"}}`, false},
		"page transition":     {`{"name":"a","source":"x","pages":[{"id":"home","name":"Home","path":"/","source":"x","transition":"slideUp"}],"entryPageId":"home","shellSource":""}`, true},
		"bad page transition": {`{"name":"a","source":"x","pages":[{"id":"home","name":"Home","path":"/","source":"x","transition":"spin"}],"entryPageId":"home","shellSource":""}`, false},
	}
	for name, c := range cases {
		var p Project
		if err := json.Unmarshal([]byte(c.project), &p); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if _, message, ok := Validate(p); ok != c.ok {
			t.Errorf("%s: ok=%v (%s), want %v", name, ok, message, c.ok)
		}
	}
}

func must(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func TestCompileAPinnedStore(t *testing.T) {
	project := Project{Name: "Sunday Kitchen", Source: `Component(dsl: 1, id: "p", name: "P", kind: ComponentKind.section, variants: [Variant(id: "default", label: "Default", build: Text(child: "Hi"))])`, StoreID: "sunday-kitchen"}
	result := Compile(project, "https://shop.example.com")
	var main string
	for _, f := range result.Files {
		if f.Name == "lib/main.dart" {
			main = f.Content
		}
	}
	if !strings.Contains(main, `Storefront.configure(apiBaseUrl: "https://shop.example.com", storeId: "sunday-kitchen", tokens: const StudioTokenStore());`) {
		t.Errorf("main.dart configure:\n%s", main)
	}
	project.StoreID = ""
	for _, f := range Compile(project, "https://shop.example.com").Files {
		if f.Name == "lib/main.dart" && strings.Contains(f.Content, "storeId") {
			t.Error("a store picker app was pinned")
		}
	}
}

func TestCompileABusinessStoreList(t *testing.T) {
	page := func(id, path, build string) dart.Page {
		return dart.Page{ID: id, Name: id, Path: path, Source: `Component(dsl: 1, id: "` + id + `", name: "` + id + `", kind: Kind.section, variants: [Variant(id: "default", label: "Default", build: ` + build + `)])`}
	}
	bars := `Scaffold(appBar: Text(child: "Bar"), body: Text(child: "Hi"))`
	tabbed := `Scaffold(appBar: Text(child: "Bar"), body: Text(child: "Hi"), bottomNavigationBar: Text(child: "Tabs"))`
	project := Project{
		Name: "Sunday Kitchen",
		Pages: []dart.Page{
			page("location", "/select-location", bars),
			page("stores", "/select-store", bars),
			page("menu", "/", tabbed),
		},
		EntryPageID: "stores",
	}
	var main string
	for _, f := range Compile(project, "https://shop.example.com").Files {
		if f.Name == "lib/main.dart" {
			main = f.Content
		}
	}
	for _, want := range []string{
		`initialRoute: "/select-store",`,
		`final storefront = Storefront.configure(apiBaseUrl: "https://shop.example.com", tokens: const StudioTokenStore());`,
		`storefront.searchStores().ignore();`,
		`"menu": ["Text", "Text"],`,
		`"stores": ["Text", ""],`,
	} {
		if !strings.Contains(main, want) {
			t.Errorf("main.dart lacks %s:\n%s", want, main)
		}
	}
	project.EntryPageID = "menu"
	for _, f := range Compile(project, "https://shop.example.com").Files {
		if f.Name == "lib/main.dart" && (!strings.Contains(f.Content, `initialRoute: "/select-location",`) || strings.Contains(f.Content, "searchStores")) {
			t.Errorf("a storefront without a store list entry should open on its location page:\n%s", f.Content)
		}
	}
}
