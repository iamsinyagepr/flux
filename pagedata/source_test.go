package pagedata

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Every golden case's pages carry the data and SEO Studio read from their
// sources (readPageFields): FromSource must read the same from each.
func TestFromSourceMatchesStudio(t *testing.T) {
	cases, err := filepath.Glob(filepath.Join("..", "testdata", "golden", "*", "input.json"))
	if err != nil || len(cases) == 0 {
		t.Fatalf("no golden cases: %v", err)
	}
	pages := 0
	for _, file := range cases {
		// pagedata-<project> cases give pages settings their sources don't
		// have, to test the compilers' reading of the settings.
		if strings.HasPrefix(filepath.Base(filepath.Dir(file)), "pagedata-market-") {
			continue
		}
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		var input struct {
			Pages []struct {
				ID     string   `json:"id"`
				Path   string   `json:"path"`
				Source string   `json:"source"`
				Data   []Import `json:"data"`
				SEO    *SEO     `json:"seo"`
			} `json:"pages"`
		}
		if err := json.Unmarshal(raw, &input); err != nil {
			t.Fatal(file, err)
		}
		for _, page := range input.Pages {
			got := FromSource(page.Source)
			if !got.Page {
				continue // written as a Component, from before Page
			}
			pages++
			name := filepath.Base(filepath.Dir(file)) + "/" + page.ID
			if got.HasRoute && got.Path != page.Path {
				t.Errorf("%s: path %q, want %q", name, got.Path, page.Path)
			}
			same(t, name+" data", nonEmpty(got.Data), nonEmpty(page.Data))
			same(t, name+" seo", got.SEO, page.SEO)
		}
	}
	if pages == 0 {
		t.Fatal("no golden case has a Page")
	}
	t.Logf("%d pages read as Studio reads them", pages)
}

func nonEmpty(imports []Import) []Import {
	if len(imports) == 0 {
		return nil
	}
	return imports
}

func same(t *testing.T, what string, got, want any) {
	t.Helper()
	g, _ := json.Marshal(got)
	w, _ := json.Marshal(want)
	if string(g) != string(w) {
		t.Errorf("%s\n got %s\nwant %s", what, g, w)
	}
}
