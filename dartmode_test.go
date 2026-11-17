package flux

import (
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux/js"
)

func dartFiles(pairs ...string) *js.Object[string] {
	files := js.NewObject[string]()
	for i := 0; i+1 < len(pairs); i += 2 {
		files.Set(pairs[i], pairs[i+1])
	}
	return files
}

func TestDartProjectBuildsAsItIs(t *testing.T) {
	main := "import 'upskale_config.dart';\nvoid main() {}\n"
	project := Project{Name: "Tip Tap", Language: LanguageDart, StoreID: "store-1",
		DartProject: dartFiles("lib/main.dart", main, "pubspec.yaml", "name: tip_tap\n", "lib/pages/menu.dart", "// mine\n")}
	if field, message, ok := Validate(project); !ok {
		t.Fatalf("refused: %s %s", field, message)
	}
	result := Compile(project, "https://tiptap.example.com")
	if !result.Success {
		t.Fatalf("not built: %+v", result.Diagnostics)
	}
	got := map[string]string{}
	for _, f := range result.Files {
		got[f.Name] = f.Content
	}
	if got["lib/main.dart"] != main || got["lib/pages/menu.dart"] != "// mine\n" {
		t.Errorf("its files changed: %q", got)
	}
	config := got[DartConfigPath]
	if !strings.Contains(config, `const String upskaleApiUrl = "https://tiptap.example.com";`) ||
		!strings.Contains(config, `const String? upskaleStoreId = "store-1";`) {
		t.Errorf("config: %q", config)
	}
}

func TestDartProjectRefusesWhatItCantBuild(t *testing.T) {
	base := []string{"lib/main.dart", "void main() {}", "pubspec.yaml", "name: x\n"}
	for _, bad := range []string{"../etc/passwd", "lib/../../x.dart", "android/app/build.gradle", "lib/.hidden.dart", DartConfigPath, "/lib/x.dart"} {
		project := Project{Language: LanguageDart, DartProject: dartFiles(append(append([]string{}, base...), bad, "x")...)}
		if _, _, ok := Validate(project); ok {
			t.Errorf("took %s", bad)
		}
	}
	if _, _, ok := Validate(Project{Language: LanguageDart, DartProject: dartFiles("lib/x.dart", "x")}); ok {
		t.Error("took a project without lib/main.dart and pubspec.yaml")
	}
	if _, _, ok := Validate(Project{Language: "python"}); ok {
		t.Error("took a language that isn't cdsl or dart")
	}
}
