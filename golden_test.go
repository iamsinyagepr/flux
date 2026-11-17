package flux

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux/dart"
)

// The golden cases are the TypeScript compiler's own output, exported by
// upskaleapp's `node scripts/export-studio-compiler.mjs`. The port must
// reproduce every file byte for byte and every diagnostic exactly.
type goldenInput struct {
	Project
	APIURL string `json:"apiUrl"`
}

type goldenExpected struct {
	Version     string            `json:"version"`
	Success     bool              `json:"success"`
	EntryClass  *string           `json:"entryClass"`
	Documents   []dart.Document   `json:"documents"`
	Diagnostics []dart.Diagnostic `json:"diagnostics"`
	Files       []struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	} `json:"files"`
}

func TestGoldenParity(t *testing.T) {
	cases, err := os.ReadDir("testdata/golden")
	if err != nil || len(cases) == 0 {
		t.Fatalf("no golden cases (run upskaleapp's export-studio-compiler.mjs): %v", err)
	}
	for _, c := range cases {
		t.Run(c.Name(), func(t *testing.T) {
			dir := filepath.Join("testdata", "golden", c.Name())
			var input goldenInput
			var want goldenExpected
			read(t, filepath.Join(dir, "input.json"), &input)
			read(t, filepath.Join(dir, "expected.json"), &want)
			got := Compile(input.Project, input.APIURL)
			if got.Version != want.Version || got.Success != want.Success {
				t.Errorf("version/success = %s/%v, want %s/%v", got.Version, got.Success, want.Version, want.Success)
			}
			if (got.EntryClass == nil) != (want.EntryClass == nil) ||
				(got.EntryClass != nil && *got.EntryClass != *want.EntryClass) {
				t.Errorf("entryClass = %v, want %v", deref(got.EntryClass), deref(want.EntryClass))
			}
			gotDocs, _ := json.Marshal(got.Documents)
			var wantDocs []Document
			for _, d := range want.Documents {
				wantDocs = append(wantDocs, Document{d.DocumentID, d.ClassName, d.Path})
			}
			wantDocsJSON, _ := json.Marshal(nonNil(wantDocs))
			if string(gotDocs) != string(wantDocsJSON) {
				t.Errorf("documents\n got %s\nwant %s", gotDocs, wantDocsJSON)
			}
			gotDiag, _ := json.Marshal(got.Diagnostics)
			wantDiag, _ := json.Marshal(nonNilDiag(want.Diagnostics))
			if string(gotDiag) != string(wantDiag) {
				t.Errorf("diagnostics\n got %s\nwant %s", gotDiag, wantDiag)
			}
			if len(got.Files) != len(want.Files) {
				names := func(n int, name func(int) string) string {
					var out []string
					for i := 0; i < n; i++ {
						out = append(out, name(i))
					}
					return strings.Join(out, ", ")
				}
				t.Fatalf("files\n got %s\nwant %s",
					names(len(got.Files), func(i int) string { return got.Files[i].Name }),
					names(len(want.Files), func(i int) string { return want.Files[i].Name }))
			}
			for i, file := range want.Files {
				content := file.Content
				if content == "@runtime" {
					content = dart.Runtime
				}
				if got.Files[i].Name != file.Name {
					t.Errorf("file %d is %s, want %s", i, got.Files[i].Name, file.Name)
					continue
				}
				if got.Files[i].Content != content {
					t.Errorf("%s differs:\n%s", file.Name, firstDifference(got.Files[i].Content, content))
				}
			}
		})
	}
}

func read(t *testing.T, path string, into any) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, into); err != nil {
		t.Fatalf("%s: %v", path, err)
	}
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func nonNil(d []Document) []Document {
	if d == nil {
		return []Document{}
	}
	return d
}

func nonNilDiag(d []dart.Diagnostic) []dart.Diagnostic {
	if d == nil {
		return []dart.Diagnostic{}
	}
	return d
}

// firstDifference shows the first differing line with a little context.
func firstDifference(got, want string) string {
	g, w := strings.Split(got, "\n"), strings.Split(want, "\n")
	for i := 0; i < len(g) || i < len(w); i++ {
		var gl, wl string
		if i < len(g) {
			gl = g[i]
		}
		if i < len(w) {
			wl = w[i]
		}
		if gl != wl {
			from := max(0, i-3)
			ctx := strings.Join(w[from:min(len(w), i)], "\n")
			return "line " + itoa(i+1) + ":\n" + ctx + "\n- want: " + wl + "\n+  got: " + gl
		}
	}
	return "(identical lines; lengths differ)"
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}
