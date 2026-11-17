package project

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/iamsinyagepr/flux"
)

func write(t *testing.T, dir, rel, content string) {
	t.Helper()
	path := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

const home = `Page(name: "Home", route: Route(path: "/"), seo: Seo(title: "Home"))

Build(
  Text(child: "Hi")
)
`

func TestSiteURLReachesTheWebsite(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, ConfigFile, `{"name": "shop", "site": {"url": "https://shop.example.com"}}`)
	write(t, dir, "pages/home.flx", home)
	loaded, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.Project.SiteURL != "https://shop.example.com" {
		t.Errorf("the app's site address = %q", loaded.Project.SiteURL)
	}
	result, ok := flux.CompileWeb(loaded.Project, "", loaded.Config.Site)
	if !ok {
		t.Fatal("no website")
	}
	files := map[string]string{}
	for _, f := range result.Files {
		files[f.Path] = f.Content
	}
	if !strings.Contains(files["public/sitemap.xml"], "<loc>https://shop.example.com/</loc>") {
		t.Errorf("no sitemap with the site's address:\n%s", files["public/sitemap.xml"])
	}
	if !strings.Contains(files["public/robots.txt"], "Sitemap: https://shop.example.com/sitemap.xml") {
		t.Errorf("robots.txt doesn't point at the sitemap:\n%s", files["public/robots.txt"])
	}
}

// flux dev's build marks each widget with where it's written and loads the
// editor; a build that ships has neither.
func TestOnlyADevBuildIsMarked(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, ConfigFile, `{"name": "shop"}`)
	write(t, dir, "pages/home.flx", home)
	loaded, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	all := func(options flux.WebOptions) string {
		result, ok := flux.CompileWebWith(loaded.Project, "", loaded.Config.Site, options)
		if !ok {
			t.Fatal("no website")
		}
		var b strings.Builder
		for _, f := range result.Files {
			b.WriteString(f.Content)
		}
		return b.String()
	}
	shipped := all(flux.WebOptions{})
	if strings.Contains(shipped, "data-flx") || strings.Contains(shipped, "__flux") {
		t.Error("a build that ships carries the editor's marks or script")
	}
	dev := all(flux.WebOptions{Marks: true, OverlayURL: "http://127.0.0.1:6173/__flux/overlay.js?t=x"})
	// The Text in home.flx, by its own position in the source.
	from := strings.Index(home, "Text(")
	want := `data-flx="home:` + strconvItoa(from) + `:` + strconvItoa(from+len(`Text(child: "Hi")`)) + `"`
	if !strings.Contains(dev, want) {
		t.Errorf("the dev build doesn't mark the Text with %s", want)
	}
	if !strings.Contains(dev, `<script type="module" src={"http://127.0.0.1:6173/__flux/overlay.js?t=x"} />`) {
		t.Error("the dev build doesn't load the editor")
	}
}

func strconvItoa(n int) string { return strconv.Itoa(n) }

func TestAPartialThemeTakesStudiosDefaults(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, ConfigFile, `{"name": "shop", "theme": {"colors": {"primary": "#0f766e"}, "pageTransition": "fade"}}`)
	write(t, dir, "pages/home.flx", home)
	loaded, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	if field, message, ok := flux.Validate(loaded.Project); !ok {
		t.Fatalf("%s %s", field, message)
	}
	raw, _ := json.Marshal(loaded.Project.Config)
	for _, want := range []string{`"iconLibrary":"material"`, `"primary":"#0f766e"`, `"pageTransition":"fade"`} {
		if !strings.Contains(string(raw), want) {
			t.Errorf("theme %s lacks %s", raw, want)
		}
	}
}

func TestAPageReadsItsRouteFromItsSource(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, ConfigFile, `{"name": "shop"}`)
	write(t, dir, "pages/home.flx", home)
	write(t, dir, "pages/about.flx", "Page(name: \"About us\")\r\n\r\nBuild(\r\n  Text(child: \"Hi\")\r\n)\r\n")
	loaded, err := Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	pages := map[string]string{}
	for _, p := range loaded.Project.Pages {
		pages[p.ID] = p.Name + " " + p.Path
		if strings.Contains(p.Source, "\r") {
			t.Errorf("%s keeps Windows line endings: positions would shift", p.ID)
		}
	}
	if pages["home"] != "Home /" || pages["about"] != "About us /about" {
		t.Errorf("pages = %v", pages)
	}
	if loaded.Project.EntryPageID != "home" {
		t.Errorf("entry = %q", loaded.Project.EntryPageID)
	}
}
