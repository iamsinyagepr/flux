package flux

// Dart mode: a project converted, once and for good, from Flux to the
// Flutter project its Flux compiled to (upskaleapp's src/lib/studio/
// dartMode.ts). From then on its Dart is its own: a build or a run on a
// device takes those files exactly as they are, never compiling anything,
// and adds only lib/upskale_config.dart, the instance it talks to (the
// tenant API's address and a single-store app's store), which its main.dart
// reads and Studio writes afresh each time.

import (
	"regexp"
	"sort"
	"strconv"

	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/flutter"
	"github.com/iamsinyagepr/flux/js"
)

// LanguageDart marks a project converted to Dart.
const LanguageDart = "dart"

// DartConfigPath is the one file of a Dart project Studio writes.
const DartConfigPath = "lib/upskale_config.dart"

const (
	MaxDartProjectFiles     = 400
	MaxDartProjectFileBytes = 524288
	// A build or a run sends the whole project; the API takes up to 2 MB a request.
	MaxDartProjectBytes = 1536 << 10
)

// dartProjectPath is a file a Dart project may hold: its pubspec and root
// files, and what's under lib/, assets/ and test/. No segment starts with a
// dot, so nothing climbs out (..) or hides.
var dartProjectPath = regexp.MustCompile(`^(?:pubspec\.yaml|analysis_options\.yaml|README\.md|\.gitignore|(?:lib|assets|test)/(?:[A-Za-z0-9_][A-Za-z0-9_.-]*/)*[A-Za-z0-9_][A-Za-z0-9_.-]*)$`)

// validateDartProject is why a Dart project's files can't be built, or ok.
func validateDartProject(files *js.Object[string]) (field, message string, ok bool) {
	keys := files.Keys()
	if len(keys) == 0 {
		return "project.dartProject", "has no files", false
	}
	if len(keys) > MaxDartProjectFiles {
		return "project.dartProject", "has more than " + strconv.Itoa(MaxDartProjectFiles) + " files", false
	}
	total := 0
	for _, name := range keys {
		source, _ := files.Get(name)
		switch {
		case !dartProjectPath.MatchString(name):
			return "project.dartProject", "has a file Studio can't build: " + name, false
		case name == DartConfigPath:
			return "project.dartProject", DartConfigPath + " is Studio's: it's written on every build", false
		case js.Bytes(source) > MaxDartProjectFileBytes:
			return "project.dartProject", name + " is larger than 512 KB", false
		}
		total += js.Bytes(source)
	}
	if total > MaxDartProjectBytes {
		return "project.dartProject", "is larger than 1.5 MB in total", false
	}
	if !files.Has("lib/main.dart") || !files.Has("pubspec.yaml") {
		return "project.dartProject", "needs lib/main.dart and pubspec.yaml", false
	}
	return "", "", true
}

// DartConfigSource is lib/upskale_config.dart for an instance (apiURL) and,
// for a single-store app, its store.
func DartConfigSource(apiURL, storeID string) string {
	store := "null"
	if storeID != "" {
		store = js.DartString(storeID)
	}
	return "// Written by Upskale Studio on every build and run: the instance this app\n" +
		"// talks to. Every other file is yours; this one is rewritten each time.\n" +
		"const String upskaleApiUrl = " + js.DartString(apiURL) + ";\n" +
		"const String? upskaleStoreId = " + store + ";\n"
}

// compileDart is a Dart project's build: its files as they are, and the
// instance's config.
func compileDart(project Project, apiURL string) Result {
	names := project.DartProject.Keys()
	sort.Strings(names)
	files := make([]File, 0, len(names)+1)
	for _, name := range names {
		source, _ := project.DartProject.Get(name)
		files = append(files, File{Name: name, Type: fileType(name), Content: source})
	}
	files = append(files, File{Name: DartConfigPath, Type: "dart", Content: DartConfigSource(apiURL, project.StoreID)})
	return Result{
		Version:     dart.Version,
		Success:     true,
		Files:       files,
		Diagnostics: []dart.Diagnostic{},
		Documents:   []Document{},
		ArchiveName: flutter.PackageName(project.Name),
	}
}
