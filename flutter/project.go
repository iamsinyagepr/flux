// Package flutter wraps a compilation into a buildable Flutter project:
// pubspec.yaml, README.md, .gitignore and lib/main.dart around the generated
// lib/ — a port of upskaleapp's flutterProject.ts.
package flutter

import (
	_ "embed"
	"encoding/json"
	"regexp"
	"strings"

	"golang.org/x/text/unicode/norm"

	"github.com/iamsinyagepr/flux/config"
	"github.com/iamsinyagepr/flux/dart"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/pagedata"
)

//go:embed sdk.json
var sdkJSON []byte

// SDK is the upskale_storefront package every generated app installs.
var SDK struct {
	Git string `json:"git"`
	Ref string `json:"ref"`
}

func init() {
	if err := json.Unmarshal(sdkJSON, &SDK); err != nil {
		panic("studio flutter sdk.json: " + err.Error())
	}
}

// Input is what the project files need besides the compilation.
type Input struct {
	Name        string
	Description string
	Pages       []dart.Page
	EntryPageID string
	Config      *js.JSON
	// APIURL is the tenant API the app talks to; empty runs on sample data.
	APIURL string
	// StoreID is a single-store app's store (id or slug): its menu loads at
	// start-up (upskale_storefront's Storefront.configure storeId).
	StoreID string
	// SiteURL is the business's website: pages' imports sent with a secret
	// are fetched through its server.
	SiteURL string
}

// File is one project file.
type File struct {
	Path   string
	Source string
}

var reserved = map[string]bool{}

func init() {
	for _, word := range strings.Fields("abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for function get hide if implements import in interface is late library mixin new null of on operator part required rethrow return set show static super switch sync this throw true try typedef var void while with yield flutter test") {
		reserved[word] = true
	}
}

var (
	nonAlnum       = regexp.MustCompile(`[^a-z0-9]+`)
	edgeUnderscore = regexp.MustCompile(`^_+|_+$`)
	trailing       = regexp.MustCompile(`_+$`)
	startsLetter   = regexp.MustCompile(`^[a-z]`)
	whitespaceRun  = regexp.MustCompile(`[\t\n\v\f\r \x{a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]+`)
	scaffoldCall   = regexp.MustCompile(`\bScaffold\(`)
	relativeImport = regexp.MustCompile(`(?m)^import '\.\./(.+?)';$`)
	locationPath   = regexp.MustCompile(`^/(select-)?location$`)
	appBarUse      = regexp.MustCompile(`Scaffold\(\s*appBar:\s*([A-Za-z_]\w*)\(`)
	bottomBarUse   = regexp.MustCompile(`bottomNavigationBar:\s*([A-Za-z_]\w*)\(`)
	lucideUse      = regexp.MustCompile(`\bLucideIcons\.`)
	bootstrapUse   = regexp.MustCompile(`\bBootstrapIcons\.`)
	gitSuffix      = regexp.MustCompile(`\.git$`)
)

// PackageName is a valid Dart package name from a project name.
func PackageName(name string) string {
	id := strings.ToLower(norm.NFKD.String(name))
	id = nonAlnum.ReplaceAllString(id, "_")
	id = edgeUnderscore.ReplaceAllString(id, "")
	id = js.Slice(id, 0, 48)
	if !startsLetter.MatchString(id) {
		id = "studio_" + id
	}
	id = trailing.ReplaceAllString(id, "")
	if id == "" || id == "studio" {
		id = "studio_app"
	}
	if reserved[id] {
		return id + "_app"
	}
	return id
}

// dartString is a Dart string literal: JSON with `$` and U+2028/9 escaped.
func dartString(value string) string { return js.DartString(value) }

// Files are the project's own files at paths relative to its root folder.
func Files(compilation dart.Compilation, input Input) []File {
	name := PackageName(input.Name)
	files := []File{
		{"pubspec.yaml", pubspec(input, name, compilation)},
		{"README.md", readme(input, name, dart.DrawsGoogleMap(compilation.Files))},
		{".gitignore", gitignore},
		{"lib/main.dart", mainSource(compilation, input)},
	}
	// What an Upskale build gives the platforms (upskale-builds reads it): the
	// Google Maps display key, when the app draws a map and has one.
	if key := input.Config.Field("googleMapsKey"); key != nil && key.String != "" && dart.DrawsGoogleMap(compilation.Files) {
		native := []File{{"upskale_native.json", "{\n  \"googleMapsKey\": " + js.Stringify(key.String) + "\n}\n"}}
		files = append(files[:3], append(native, files[3:]...)...)
	}
	for _, f := range compilation.Files {
		files = append(files, File{f.Path, f.Source})
	}
	return files
}

func pubspec(input Input, name string, compilation dart.Compilation) string {
	uses := func(pattern *regexp.Regexp) bool {
		for _, f := range compilation.Files {
			if pattern.MatchString(f.Source) {
				return true
			}
		}
		return false
	}
	var icons []string
	if uses(lucideUse) {
		icons = append(icons, "  lucide_icons_flutter: ^3.1.0")
	}
	if uses(bootstrapUse) {
		icons = append(icons, "  bootstrap_icons: ^1.13.2")
	}
	description := input.Description
	if description == "" {
		description = input.Name + ", built with Upskale Studio."
	}
	description = js.Slice(whitespaceRun.ReplaceAllString(description, " "), 0, 180)
	iconBlock := ""
	if len(icons) > 0 {
		iconBlock = "  # The icon library chosen in Config.\n" + strings.Join(icons, "\n") + "\n"
	}
	// The Library's packages, for the components this app draws (dart/library.go).
	var library []string
	for _, item := range dart.UsedLibrary(compilation.Files) {
		library = append(library, item.Dependency)
	}
	if len(library) > 0 {
		iconBlock += "  # Upskale's library, for the components this app draws.\n" + strings.Join(library, "\n") + "\n"
	}
	return "name: " + name + "\ndescription: " + js.Stringify(description) + `
publish_to: none
version: 1.0.0+1

environment:
  sdk: ">=3.4.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  # Material's adaptive icons use this font on iOS-style platforms.
  cupertino_icons: ^1.0.8
  # The preview's typeface, Plus Jakarta Sans.
  google_fonts: ^8.1.0
  # The tenant API client, location, stores, menu and cart.
  upskale_storefront:
    git:
      url: ` + SDK.Git + `
      ref: ` + SDK.Ref + `
  # Opens where to pay for an online order, in the browser.
  url_launcher: ^6.3.1
  # Keeps the customer's session on the device, securely, between starts.
  flutter_secure_storage: ^11.2.0
  # Fetches what pages import (their Data settings).
  http: ^1.2.0
` + iconBlock + `
dev_dependencies:
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true
`
}

func readme(input Input, name string, maps bool) string {
	mapsSection := ""
	if maps {
		mapsSection = dart.GoogleMapsReadme
	}
	return "# " + input.Name + "\n\n" +
		"Generated by Upskale Studio from your CDSL sources. Edit the project in\n" +
		"Studio and download it again rather than editing `lib/` by hand — the next\n" +
		"download replaces it.\n\n" +
		"## Run it\n\n" +
		"This download contains the app (`lib/`) and its `pubspec.yaml`. Flutter\n" +
		"creates the platform folders for you, once:\n\n" +
		"```sh\n" +
		"flutter create . --project-name " + name + " --platforms=android,ios,web\n" +
		"flutter pub get\n" +
		"flutter run\n" +
		"```\n\n" +
		"`flutter create .` only adds what is missing (`android/`, `ios/`, `web/`…)\n" +
		"and leaves `lib/` and `pubspec.yaml` as they are. Choose the platforms you\n" +
		"need; `--platforms=android` alone is enough for an APK:\n\n" +
		"```sh\n" +
		"flutter build apk\n" +
		"```\n\n" +
		"The app loads images and its typeface (Plus Jakarta Sans, through\n" +
		"`google_fonts`) over the network. Debug builds can already do that; for a\n" +
		"release build on Android, add this line inside `<manifest>` in\n" +
		"`android/app/src/main/AndroidManifest.xml`:\n\n" +
		"```xml\n" +
		"<uses-permission android:name=\"android.permission.INTERNET\" />\n" +
		"```\n\n" +
		mapsSection +
		"## What's inside\n\n" +
		"- `lib/main.dart` — the app and a route for each page.\n" +
		"- `lib/pages/` — one widget per page.\n" +
		"- `lib/components/` — your reusable components.\n" +
		"- `lib/studio_runtime.dart` — the small helper library the generated widgets use.\n" +
		"- `lib/studio_generated.dart` — exports everything above.\n\n" +
		"Stores, menus, location search and the cart come from\n" +
		"[`upskale_storefront`](" + gitSuffix.ReplaceAllString(SDK.Git, "") + "), the tenant API\n" +
		"client every generated app installs. `lib/main.dart` points it at your\n" +
		"instance's API with `Storefront.configure(apiBaseUrl: ...)`. To replace a\n" +
		"control with your own, pass a `StudioPlatform` in a page's\n" +
		"`bindings['_studio']` (see `lib/studio_runtime.dart`).\n"
}

const gitignore = `# Flutter / Dart
.dart_tool/
.packages
.pub-cache/
.pub/
build/
.flutter-plugins
.flutter-plugins-dependencies

# IDEs
.idea/
*.iml
.vscode/

# OS
.DS_Store
`

// orUndefined is how a missing value reads in a JS template: "undefined".
// (Only reachable for a project that failed to compile.)
func orUndefined(s string) string {
	if s == "" {
		return "undefined"
	}
	return s
}

func mainSource(compilation dart.Compilation, input Input) string {
	pages := input.Pages
	if len(pages) == 0 {
		pages = []dart.Page{{ID: "", Name: input.Name, Path: "/"}}
	}
	className := func(id string) string {
		for _, d := range compilation.Documents {
			if d.DocumentID == id {
				return d.ClassName
			}
		}
		return ""
	}
	entry := pages[0]
	for _, p := range pages {
		if p.ID == input.EntryPageID {
			entry = p
			break
		}
	}
	var routes []dart.Page
	for _, p := range pages {
		if className(p.ID) != "" {
			routes = append(routes, p)
		}
	}
	// A storefront opens on choosing a location; a single-store app (StoreID)
	// has none to choose and opens on its entry page, and so does one whose
	// entry is the store list (a business's own app, where the customer's
	// location doesn't matter).
	start := entry
	found := input.StoreID != "" || entry.ID == "stores"
	for _, p := range routes {
		if found {
			break
		}
		if p.ID == "location" {
			start, found = p, true
			break
		}
	}
	if !found {
		for _, p := range routes {
			if locationPath.MatchString(p.Path) {
				start = p
				break
			}
		}
	}
	// Pages get the preview's 16px padding unless they lay out a Scaffold,
	// directly or in a component they use.
	sources := map[string]string{}
	for _, f := range compilation.Files {
		sources[f.Path] = f.Source
	}
	var scaffolded func(path string, seen map[string]bool) bool
	scaffolded = func(path string, seen map[string]bool) bool {
		source, ok := sources[path]
		if !ok || source == "" || seen[path] {
			return false
		}
		seen[path] = true
		if scaffoldCall.MatchString(source) {
			return true
		}
		for _, m := range relativeImport.FindAllStringSubmatch(source, -1) {
			if scaffolded("lib/"+m[1], seen) {
				return true
			}
		}
		return false
	}
	var padded []string
	for _, p := range routes {
		framed := false
		for _, f := range compilation.Files {
			if f.DocumentID == p.ID && scaffolded(f.Path, map[string]bool{}) {
				framed = true
				break
			}
		}
		if !framed {
			padded = append(padded, dartString(p.ID))
		}
	}
	theme := ""
	if radius := input.Config.Field("radii").Field("md"); radius != nil && radius.Kind == js.JSONNumber && radius.Number >= 0 {
		theme += ", buttonRadius: " + js.NumberString(radius.Number)
	}
	if size := input.Config.Field("fontSizes").Field("md"); size != nil && size.Kind == js.JSONNumber && size.Number > 0 {
		value := js.NumberString(size.Number)
		theme += ", fontSize: " + value + ", buttonFontSize: " + value
	}
	var colors []string
	if group := input.Config.Field("colors"); group.IsObject() {
		for _, name := range group.Object.Keys() {
			value := group.Field(name)
			if config.ValidHexColor(value) {
				colors = append(colors, "        "+dartString(name)+": Color(0xff"+value.String[1:]+"),")
			}
		}
	}
	// A dark theme too when Config asks for one (dark, or following the
	// device): the dark palette over the runtime's dark defaults.
	dark := ""
	// ToggleDarkMode switches the app between light and dark: it has a dark
	// theme then whatever Config says, and follows the mode switched to.
	toggles := false
	for _, f := range compilation.Files {
		if strings.Contains(f.Source, "'ToggleDarkMode'") {
			toggles = true
			break
		}
	}
	modeOver, listen, listenEnd := "", "", ""
	if toggles {
		modeOver = "mode ?? "
		listen = "ValueListenableBuilder<ThemeMode?>(\n" +
			"      // ToggleDarkMode: the mode it switched to, over Config's.\n" +
			"      valueListenable: studioThemeMode,\n" +
			"      builder: (context, mode, _) => "
		listenEnd = ",\n    )"
	}
	if config.UsesDarkTheme(input.Config) || toggles {
		palette := config.DarkPalette(input.Config)
		var darkColors []string
		for _, name := range palette.Keys() {
			value, _ := palette.Get(name)
			if config.ValidHexColor(value) {
				darkColors = append(darkColors, "        "+dartString(name)+": Color(0xff"+value.String[1:]+"),")
			}
		}
		dark = "      // The dark palette, used when the app is dark.\n" +
			"      darkTheme: studioTheme(const {\n" +
			strings.Join(darkColors, "\n") + "\n" +
			"      }" + theme + ", brightness: Brightness.dark),\n" +
			"      themeMode: " + modeOver + "ThemeMode." + config.ThemeMode(input.Config) + ",\n"
	}
	var routePaths, patterns, cases []string
	for _, p := range routes {
		routePaths = append(routePaths, "    "+dartString(p.ID)+": "+dartString(p.Path)+",")
		patterns = append(patterns, "  "+dartString(p.Path)+": "+dartString(p.ID)+",")
		cases = append(cases, "    case "+dartString(p.ID)+":\n      return const "+pageWidget(p, className)+";")
	}
	importSDK, configure := "", ""
	if input.APIURL != "" {
		importSDK = "import 'package:upskale_storefront/upskale_storefront.dart';\n"
		configure = "  // The tenant API this app's stores, menus and orders come from.\n" +
			"  // The customer's session is kept securely on the device (StudioTokenStore),\n" +
			"  // so they stay signed in, with their orders, from one start to the next.\n  "
		if start.ID == "stores" {
			configure += "final storefront = "
		}
		configure += "Storefront.configure(apiBaseUrl: " + dartString(input.APIURL) + storeArg(input.StoreID) + ", tokens: const StudioTokenStore()" + menuArg(routes) + ");\n"
		if start.ID == "stores" {
			configure += "  // It opens on the store list: the stores load at once.\n  storefront.searchStores().ignore();\n"
		}
	}
	// Each page's app bar and bottom navigation (the components its Scaffold
	// places): going between pages that share one has no transition.
	var bars []string
	for _, p := range routes {
		appBar, bottom := "", ""
		if m := appBarUse.FindStringSubmatch(p.Source); m != nil {
			appBar = m[1]
		}
		if m := bottomBarUse.FindStringSubmatch(p.Source); m != nil {
			bottom = m[1]
		}
		if appBar != "" || bottom != "" {
			bars = append(bars, "  "+dartString(p.ID)+": ["+dartString(appBar)+", "+dartString(bottom)+"],")
		}
	}
	// How each page is entered where it isn't the platform's way (the
	// config's pageTransition, or the page's own), and the pages that set
	// their own: those keep it even from a page sharing their bar.
	var transitions, own []string
	for _, p := range routes {
		transition := p.Transition
		if transition == "" {
			transition = config.PageTransition(input.Config)
		} else {
			own = append(own, dartString(p.ID))
		}
		if transition != "platform" {
			transitions = append(transitions, "  "+dartString(p.ID)+": "+dartString(transition)+",")
		}
	}
	transitionMap, routeCheck, routeOwn, transitionRoute := "", "  if (_sharesBar(_shown.pageId, _pageIdOf(settings.name))) {", "", ""
	if len(transitions) > 0 {
		transitionMap = `/// How each page is entered, where it isn't the platform's way.
const _transitions = <String, String>{
` + strings.Join(transitions, "\n") + `
};

/// Pages with a transition of their own: kept even from a page sharing a bar.
const _ownTransition = <String>{` + strings.Join(own, ", ") + `};

`
		routeCheck = `  final pageId = _pageIdOf(settings.name);
  final transition = _transitions[pageId];
  if (transition == "none" ||
      (!_ownTransition.contains(pageId) && _sharesBar(_shown.pageId, pageId))) {`
		routeOwn = "  if (transition != null) return _transitionRoute(settings, build, transition);\n"
		transitionRoute = `
/// A page entering by [transition] (fade, slideUp or slideLeft); still where
/// the device asks for reduced motion.
PageRouteBuilder<void> _transitionRoute(
  RouteSettings settings,
  WidgetBuilder build,
  String transition,
) {
  return PageRouteBuilder<void>(
    settings: settings,
    transitionDuration: const Duration(milliseconds: 300),
    reverseTransitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (context, animation, secondaryAnimation) => build(context),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      if (MediaQuery.disableAnimationsOf(context)) return child;
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      if (transition == "fade") {
        return FadeTransition(opacity: curved, child: child);
      }
      final slide = SlideTransition(
        position: Tween<Offset>(
          begin: transition == "slideUp" ? const Offset(0, 0.08) : const Offset(1, 0),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      );
      return transition == "slideUp"
          ? FadeTransition(opacity: curved, child: slide)
          : slide;
    },
  );
}
`
	}
	return `// Generated by Upskale Studio. The app entry point: one route per page.
import 'package:flutter/material.dart';
` + importSDK + `
import 'studio_generated.dart';

void main() {
` + configure + pageDataConfig(routes, input) + `  // Route tokens (Route.cart …) open this project's own page paths.
  studioRoutePaths.addAll(const {
` + strings.Join(routePaths, "\n") + `
  });
` + noticeStyle(input.Config) + `  runApp(const StudioApp());
}

class StudioApp extends StatelessWidget {
  const StudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ` + listen + `MaterialApp(
      title: ` + dartString(input.Name) + `,
      debugShowCheckedModeBanner: false,
      // The Studio preview's palette, with this project's Config colours.
      theme: studioTheme(const {
` + strings.Join(colors, "\n") + `
      }` + theme + `),
` + dark + `      // The storefront (location, stores, menu, cart) above every page.
      builder: (context, child) => StudioStorefrontScope(child: child!),
      initialRoute: ` + dartString(start.Path) + `,
      // Only the first page: not the pages its path is nested under.
      onGenerateInitialRoutes: (initial) => [_route(RouteSettings(name: initial))],
      onGenerateRoute: _route,
      navigatorObservers: [_shown],
    )` + listenEnd + `;
  }
}

/// Each page's app bar and bottom navigation components.
const _bars = <String, List<String>>{
` + strings.Join(bars, "\n") + `
};

/// Whether two pages share their app bar or bottom navigation.
bool _sharesBar(String? from, String? to) {
  final a = _bars[from], b = _bars[to];
  if (a == null || b == null) return false;
  return (a[0].isNotEmpty && a[0] == b[0]) || (a[1].isNotEmpty && a[1] == b[1]);
}

/// The page on screen, as the navigator changes it.
class _ShownPage extends NavigatorObserver {
  String? pageId;
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      pageId = _pageIdOf(route.settings.name);
  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      pageId = _pageIdOf(previousRoute?.settings.name);
  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      pageId = _pageIdOf(newRoute?.settings.name);
}

final _shown = _ShownPage();

` + transitionMap + `/// A page's route: without a transition from a page sharing its app bar or
/// bottom navigation (the bar stays still), and with the platform's own
/// otherwise.
Route<dynamic> _route(RouteSettings settings) {
  Widget build(BuildContext context) => _page(
        settings.name ?? ` + dartString(start.Path) + `,
        settings.arguments is Map<String, dynamic>
            ? settings.arguments as Map<String, dynamic>
            : const {},
      );
` + routeCheck + `
    return PageRouteBuilder<void>(
      settings: settings,
      transitionDuration: Duration.zero,
      reverseTransitionDuration: Duration.zero,
      pageBuilder: (context, animation, secondaryAnimation) => build(context),
    );
  }
` + routeOwn + `  return MaterialPageRoute<void>(settings: settings, builder: build);
}
` + transitionRoute + `
String? _pageIdOf(String? location) {
  if (location == null) return null;
  final segments = Uri.parse(location).pathSegments;
  for (final MapEntry(key: pattern, value: pageId) in _patterns.entries) {
    if (_match(pattern, segments) != null) return pageId;
  }
  return null;
}

/// Each page's path pattern. A ` + "`$name`" + ` segment matches any value and is
/// passed to the page as ` + "`route.params.name`" + `.
const _patterns = <String, String>{
` + strings.Join(patterns, "\n") + `
};

/// Pages without their own Scaffold get the preview's 16px content padding
/// and scroll.
const _padded = <String>{` + strings.Join(padded, ", ") + `};

Widget _build(String pageId) {
  switch (pageId) {
` + strings.Join(cases, "\n") + `
    default:
      return const ` + orUndefined(className(entry.ID)) + `();
  }
}

/// Finds the page for [location] and hands it the route it was opened with.
Widget _page(String location, Map<String, dynamic> values) {
  final uri = Uri.parse(location);
  for (final MapEntry(key: pattern, value: pageId) in _patterns.entries) {
    final params = _match(pattern, uri.pathSegments);
    if (params == null) continue;
    return _scoped(pageId, pattern, uri.path, params, values);
  }
  return _scoped(` + dartString(entry.ID) + `, ` + dartString(entry.Path) + `, uri.path, const {}, values);
}

Map<String, String>? _match(String pattern, List<String> segments) {
  final parts = pattern.split('/').where((part) => part.isNotEmpty).toList();
  if (parts.length != segments.length) return null;
  final params = <String, String>{};
  for (var index = 0; index < parts.length; index++) {
    if (parts[index].startsWith(r'$')) {
      params[parts[index].substring(1)] = segments[index];
    } else if (parts[index] != segments[index]) {
      return null;
    }
  }
  return params;
}

Widget _scoped(
  String pageId,
  String pattern,
  String path,
  Map<String, String> params,
  Map<String, dynamic> values,
) {
  return StudioScope(
    values: {
      // What the navigation carried, e.g. the product OpenProduct opened.
      ...values,
      'route': {
        'pageId': pageId,
        'pattern': pattern,
        'path': path,
        'params': params,
      },
    },
    child: Scaffold(
      body: SafeArea(
        // Like the preview, a page without its own Scaffold scrolls as a whole.
        child: _padded.contains(pageId)
            ? SingleChildScrollView(padding: const EdgeInsets.all(16), child: _build(pageId))
            : _build(pageId),
      ),
    ),
  );
}
`
}

// storeArg is the configure call's storeId argument, when there is one.
func storeArg(storeID string) string {
	if storeID == "" {
		return ""
	}
	return ", storeId: " + dartString(storeID)
}

// menuArg is the configure call's menu: false, when the pages fetch the
// menu themselves (a tenant menu import): then choosing a store loads only
// the store, and each page its own data (flutterProject.ts's pagesImportMenu).
func menuArg(routes []dart.Page) string {
	if pagedata.ImportsResource(pageImports(routes), "menu") {
		return ", menu: false"
	}
	return ""
}

// pageImports is every page's Data settings.
func pageImports(routes []dart.Page) [][]pagedata.Import {
	out := make([][]pagedata.Import, len(routes))
	for i, p := range routes {
		out[i] = p.Data
	}
	return out
}

// pageDataConfig is where pages' imported data comes from, when any has
// Data settings (flutterProject.ts's).
func pageDataConfig(routes []dart.Page, input Input) string {
	for _, p := range routes {
		if len(p.Data) > 0 {
			return "  // Where pages' imported data comes from: the tenant API, and the website\n" +
				"  // (whose server holds any key an import is sent with).\n" +
				"  studioApiUrl = " + dartString(input.APIURL) + ";\n" +
				"  studioSiteUrl = " + dartString(input.SiteURL) + ";\n"
		}
	}
	return ""
}

// pageWidget is a page's widget, inside what fetches its imports when it
// has Data settings (the runtime's StudioPageData): each import a constant,
// the tenant's by API path, an external one by address, and one sent with a
// secret through the website's server (flutterProject.ts's pageWidget).
func pageWidget(p dart.Page, className func(string) string) string {
	if len(p.Data) == 0 {
		return className(p.ID) + "()"
	}
	imports := make([]string, len(p.Data))
	for i, item := range p.Data {
		fields := []string{"name: " + dartString(item.Name)}
		if item.Source == "client" {
			imports[i] = "StudioImport(" + fields[0] + ", client: " + dartString(item.Resource) + ")"
			continue
		}
		switch {
		case item.Source == "tenant":
			resource := pagedata.Resources[item.Resource]
			fields = append(fields, "path: "+dartString(resource.Path))
			var query []string
			for _, param := range resource.Params {
				if !strings.Contains(resource.Path, "{"+param.Name+"}") {
					query = append(query, dartString(param.Name))
				}
			}
			if len(query) > 0 {
				fields = append(fields, "query: ["+strings.Join(query, ", ")+"]")
			}
		case item.Secret != "":
			fields = append(fields, "viaSite: true")
		default:
			fields = append(fields, "url: "+dartString(item.URL))
		}
		if item.Select != "" && !(item.Source == "external" && item.Secret != "") {
			fields = append(fields, "select: "+dartString(item.Select))
		}
		// The signed-in customer's: asked with their session.
		if item.Source == "tenant" && pagedata.Resources[item.Resource].Auth {
			fields = append(fields, "auth: true")
		}
		if len(item.Params) > 0 {
			params := make([]string, len(item.Params))
			for j, param := range item.Params {
				args := []string{dartString(param.Name), dartString(param.From)}
				if param.Value != "" || param.Fallback != nil {
					args = append(args, dartString(param.Value))
				}
				if param.Fallback != nil {
					args = append(args, dartString(*param.Fallback))
				}
				params[j] = "StudioImportParam(" + strings.Join(args, ", ") + ")"
			}
			fields = append(fields, "params: ["+strings.Join(params, ", ")+"]")
		}
		imports[i] = "StudioImport(" + strings.Join(fields, ", ") + ")"
	}
	return "StudioPageData(page: " + dartString(p.ID) + ", imports: [" + strings.Join(imports, ", ") + "], child: " + className(p.ID) + "())"
}

// noticeStyle is main.dart's line setting Config's notice style ("" when it
// has none): flutterProject.ts's noticeStyle.
func noticeStyle(cfg *js.JSON) string {
	notice := cfg.Field("notice")
	if notice == nil || !notice.IsObject() {
		return ""
	}
	var parts []string
	if v := notice.Field("background"); v != nil {
		parts = append(parts, "background: "+dartString(v.String))
	}
	if v := notice.Field("color"); v != nil {
		parts = append(parts, "color: "+dartString(v.String))
	}
	if v := notice.Field("position"); v != nil && v.String == "top" {
		parts = append(parts, "top: true")
	}
	if v := notice.Field("seconds"); v != nil {
		parts = append(parts, "seconds: "+js.NumberString(v.Number))
	}
	return "  // How the messages actions show look (Config's notice).\n" +
		"  studioNotice = const StudioNoticeStyle(" + strings.Join(parts, ", ") + ");\n"
}
