package dart

// The Library's Flutter side: a Dart file per component, written into an app
// only when its pages use the component, with the pub.dev package it needs.
// A port of upskaleapp's src/lib/studio/dartLibrary.ts, whose files
// export-studio-compiler.mjs writes to library/.

import (
	_ "embed"
	"regexp"
)

//go:embed library/google_map.dart
var googleMapSource string

//go:embed library/lottie.dart
var lottieSource string

// LibraryItem is one of the Library's Dart files.
type LibraryItem struct {
	// Path is the file in the app: lib/studio_library/<name>.dart.
	Path string
	// Uses matches a page or component that draws it.
	Uses *regexp.Regexp
	// Dependency is its pubspec.yaml line.
	Dependency string
	Source     string
}

// Library is the Library's Dart files, in the order an app gets them.
var Library = []LibraryItem{
	{"lib/studio_library/google_map.dart", regexp.MustCompile(`\bStudioGoogleMap\(`), "  google_maps_flutter: ^2.12.1", googleMapSource},
	{"lib/studio_library/lottie.dart", regexp.MustCompile(`\bStudioLottie\(`), "  lottie: ^3.3.1", lottieSource},
}

// UsedLibrary is the library files a compilation's files use.
func UsedLibrary(files []File) []LibraryItem {
	var used []LibraryItem
	for _, item := range Library {
		for _, f := range files {
			if item.Uses.MatchString(f.Source) {
				used = append(used, item)
				break
			}
		}
	}
	return used
}

// DrawsGoogleMap reports whether a compilation draws a Google map.
func DrawsGoogleMap(files []File) bool {
	for _, f := range files {
		if f.Path == Library[0].Path {
			return true
		}
	}
	return false
}

// GoogleMapsReadme is the README's Google Maps section (dartLibrary.ts's GOOGLE_MAPS_README).
const GoogleMapsReadme = "## Google Maps\n\n" +
	"This app draws Google maps. Upskale's builds give them the display key from\n" +
	"Config → Maps (`upskale_native.json`). Building it yourself, give the key to\n" +
	"each platform as `google_maps_flutter`'s README shows: Android's\n" +
	"`AndroidManifest.xml`, iOS's `AppDelegate.swift`, and `web/index.html`.\n\n"
