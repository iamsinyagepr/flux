package web

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/pagedata"
)

type goldenProject struct {
	Name             string             `json:"name"`
	Description      string             `json:"description"`
	Pages            []dart.Page        `json:"pages"`
	EntryPageID      string             `json:"entryPageId"`
	ComponentSources *js.Object[string] `json:"componentSources"`
	Config           *js.JSON           `json:"config"`
	APIURL           string             `json:"apiUrl"`
}

func readGolden(t *testing.T, name string) goldenProject {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "testdata", "golden", name, "input.json"))
	if err != nil {
		t.Fatal(err)
	}
	var p goldenProject
	if err := json.Unmarshal(raw, &p); err != nil {
		t.Fatal(err)
	}
	return p
}

func compileGolden(p goldenProject, api string) Result {
	return Compile(Input{Name: p.Name, Description: p.Description, Pages: p.Pages, EntryPageID: p.EntryPageID,
		ComponentSources: p.ComponentSources, Config: p.Config, APIURL: api})
}

// Every full-app template in the corpus (a project with pages) builds for
// the web, with nothing drawn as a placeholder.
func TestTemplatesCompile(t *testing.T) {
	cases, err := os.ReadDir(filepath.Join("..", "testdata", "golden"))
	if err != nil {
		t.Fatal(err)
	}
	apps := 0
	for _, c := range cases {
		p := readGolden(t, c.Name())
		if len(p.Pages) == 0 {
			continue
		}
		apps++
		t.Run(c.Name(), func(t *testing.T) {
			result := compileGolden(p, "https://tenant.example")
			for _, d := range result.Diagnostics {
				t.Logf("%s %s %s: %s", d.Severity, d.Code, d.DocumentID, d.Message)
			}
			// Broken on purpose (a cycle, an unknown scope).
			if c.Name() == "project-components" || c.Name() == "pagedata-names" {
				if result.Success {
					t.Fatal("compiled, but should not")
				}
				return
			}
			if !result.Success {
				t.Fatalf("did not compile")
			}
			// The marketplace's templates are drawn whole: no placeholders.
			if strings.HasPrefix(c.Name(), "corpus-market-") && result.Integrations() {
				t.Errorf("draws a placeholder on the web")
			}
			names := map[string]bool{}
			for _, f := range result.Files {
				names[f.Path] = true
			}
			// The pages' data, fetched on the server, only when there's some.
			hasData, _ := siteData(p.Pages)
			if names["src/data.ts"] != hasData {
				t.Errorf("src/data.ts: %v, for a site with data: %v", names["src/data.ts"], hasData)
			}
			for _, want := range []string{"package.json", "vite.config.ts", "server.mjs", "src/router.tsx", "src/routes/__root.tsx",
				"src/site.json", "src/theme.css", "src/studio/runtime.tsx"} {
				if !names[want] {
					t.Errorf("missing %s", want)
				}
			}
		})
	}
	if apps == 0 {
		t.Fatal("no full-app templates in the corpus")
	}
}

// WEB_OUT=dir writes one template's website there, to build it with npm:
// WEB_OUT=/tmp/site WEB_TEMPLATE=corpus-market-green-basket go test ./internal/studio/web -run Write
func TestWriteTemplate(t *testing.T) {
	out := os.Getenv("WEB_OUT")
	if out == "" {
		t.Skip("WEB_OUT not set")
	}
	name := os.Getenv("WEB_TEMPLATE")
	if name == "" {
		name = "corpus-market-green-basket"
	}
	var p goldenProject
	switch name {
	case "dish":
		// A page with server data and client data reading it (modules_test.go).
		p = goldenProject{Name: "Dishes", Pages: []dart.Page{dishPage("client", &pagedata.SEO{Title: "dish.name"})}, EntryPageID: "dish"}
	case "library":
		// The Library's Lottie and GoogleMap (library_test.go), with a key.
		p = goldenProject{Name: "Library", Pages: []dart.Page{{ID: "home", Name: "Home", Path: "/", Source: libraryPage}},
			EntryPageID: "home", Config: libraryConfig(t, "AIzaSyTestKey_0123456789-abcdefgh")}
	case "hello":
		// One page of text: the smallest site there is.
		p = goldenProject{Name: "Hello", Pages: []dart.Page{{ID: "home", Name: "Home", Path: "/",
			Source: `Page(name: "Home", build: Text(child: "Hello"))`}}, EntryPageID: "home"}
	default:
		p = readGolden(t, name)
	}
	if os.Getenv("WEB_DATA") == "menu" {
		// The menu page imports its store's menu: the site's store, which a
		// site serving several stores only knows once the visitor chose one.
		for i := range p.Pages {
			if p.Pages[i].ID == "menu" {
				p.Pages[i].Data = []pagedata.Import{{Name: "menu", Source: "tenant", Resource: "menu",
					Params: []pagedata.Param{{Name: "store", From: "store"}}}}
			}
		}
	} else if os.Getenv("WEB_DATA") != "" {
		// The product page imports its product and describes it for search.
		for i := range p.Pages {
			if p.Pages[i].ID == "product" {
				p.Pages[i].Data = []pagedata.Import{{Name: "product", Source: "tenant", Resource: "product",
					Params: []pagedata.Param{{Name: "id", From: "route", Value: "productId"}}},
					// An external API with a key, which echoes what it was sent.
					{Name: "echo", Source: "external", URL: "https://httpbin.org/anything/{id}", Select: "headers",
						Secret: "DEMO_KEY", Params: []pagedata.Param{{Name: "id", From: "import", Value: "product.id"}}}}
				p.Pages[i].SEO = &pagedata.SEO{Title: `"${product.name} | Green Basket"`, Description: "product.description",
					Image: "product.image_url", Schema: "Product", Subject: "product"}
			}
		}
	}
	result := Compile(Input{Site: []byte(`{"site_url":"https://shop.example.com","site_name":"Green Basket"}`), Name: p.Name, Description: p.Description, Pages: p.Pages, EntryPageID: p.EntryPageID,
		ComponentSources: p.ComponentSources, Config: p.Config, APIURL: os.Getenv("WEB_API"), StoreID: os.Getenv("WEB_STORE")})
	if !result.Success {
		t.Fatalf("did not compile: %+v", result.Diagnostics)
	}
	for _, f := range result.Files {
		path := filepath.Join(out, filepath.FromSlash(f.Path))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(f.Content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	t.Logf("wrote %d files to %s (%s)", len(result.Files), out, strings.Join([]string{name}, ""))
}
