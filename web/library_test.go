package web

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/js"
)

// The Library's components, on one page: a Lottie, and a Google map with a marker.
const libraryPage = `Page(name: "Home", build: Column(children: [
  Lottie(src: "https://cdn.example.com/ready.json", height: 120, loop: false, alt: "Order ready"),
  GoogleMap(latitude: -26.2041, longitude: 28.0473, zoom: 12, mapType: MapType.satellite,
    markers: [MapMarker(id: "rosebank", title: "Rosebank", latitude: -26.1458, longitude: 28.0436)],
    onMarkerTap: ShowMessage(message: event.title))
]))`

func libraryConfig(t *testing.T, key string) *js.JSON {
	t.Helper()
	raw := `{"colors":{},"spacing":{},"radii":{},"fontSizes":{},"iconSizes":{},"iconLibrary":"material"` +
		map[bool]string{true: `,"googleMapsKey":"` + key + `"`, false: ""}[key != ""] + `}`
	var config js.JSON
	if err := json.Unmarshal([]byte(raw), &config); err != nil {
		t.Fatal(err)
	}
	return &config
}

func librarySite(t *testing.T, key string) Result {
	t.Helper()
	r := Compile(Input{Name: "Library", Pages: []dart.Page{{ID: "home", Name: "Home", Path: "/", Source: libraryPage}},
		EntryPageID: "home", Config: libraryConfig(t, key)})
	if !r.Success {
		t.Fatalf("did not compile: %+v", r.Diagnostics)
	}
	return r
}

// The Library is drawn on the web: the page places W.Lottie and W.GoogleMap
// (its markers as objects, its key from Config), the runtime has them, and
// only a site that plays an animation installs lottie-web.
func TestLibraryOnTheWeb(t *testing.T) {
	f := files(librarySite(t, "AIzaSyTestKey_0123456789-abcdefgh"))
	page := f["src/pages/home.tsx"]
	for _, want := range []string{"<W.Lottie", `src="https://cdn.example.com/ready.json"`, "<W.GoogleMap", `apiKey={"AIzaSyTestKey_0123456789-abcdefgh"}`,
		`markers={[{ latitude: `, `id: "rosebank", title: "Rosebank" }]}`, "onMarkerTap={(event: rt.Event) =>", `mapType="satellite"`} {
		if !strings.Contains(page, want) {
			t.Errorf("page lacks %s:\n%s", want, page)
		}
	}
	widgets := f["src/studio/widgets.tsx"]
	for _, want := range []string{"export function Lottie(", "export function GoogleMap(", "lottie-web/build/player/lottie_light"} {
		if !strings.Contains(widgets, want) {
			t.Errorf("widgets.tsx lacks %s", want)
		}
	}
	if !strings.Contains(f["package.json"], `"lottie-web": "5.13.0"`) {
		t.Errorf("package.json has no lottie-web:\n%s", f["package.json"])
	}

	// Without a key the map is there, saying it's unavailable: no key in the page.
	if page := files(librarySite(t, ""))["src/pages/home.tsx"]; strings.Contains(page, "apiKey") {
		t.Error("a page without a key has one")
	}
	// A site that draws neither has neither, and no lottie-web.
	plain := files(Compile(Input{Name: "Plain", Pages: []dart.Page{{ID: "home", Name: "Home", Path: "/",
		Source: `Page(name: "Home", build: Text(child: "Hi"))`}}, EntryPageID: "home"}))
	if strings.Contains(plain["src/studio/widgets.tsx"], "function Lottie(") || strings.Contains(plain["package.json"], "lottie-web") {
		t.Error("a site without the Library got it")
	}
}
