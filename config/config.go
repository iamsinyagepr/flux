// Package config is a Studio project's theme configuration — colour and
// size overrides, the project's own tokens and the icon library — validated
// exactly as upskaleapp's projectConfig.ts validates it.
package config

import (
	"regexp"

	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/registry"
)

// MaxCustomTokens is how many tokens of its own a group may add.
const MaxCustomTokens = 24

// Groups are the config groups backed by tokens, in validation order.
var Groups = []string{"colors", "spacing", "radii", "fontSizes", "iconSizes"}

// TokenGroups maps a CDSL token family to its config group.
var TokenGroups = map[string]string{
	"Color":    "colors",
	"Space":    "spacing",
	"Radius":   "radii",
	"FontSize": "fontSizes",
	"Size":     "iconSizes",
}

var (
	hexColor      = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	customToken   = regexp.MustCompile(`^[a-z][A-Za-z0-9]{0,31}$`)
	reservedNames = map[string]bool{"constructor": true, "prototype": true, "toString": true, "valueOf": true}
	iconLibraries = map[string]bool{"material": true, "feather": true, "bootstrap": true}
	// GoogleMapsKey is a Google API key as Config takes it (projectConfig.ts's GOOGLE_MAPS_KEY).
	GoogleMapsKey = regexp.MustCompile(`^[A-Za-z0-9_-]{20,100}$`)
	allowedKeys   = map[string]bool{"colors": true, "darkColors": true, "themeMode": true, "spacing": true, "radii": true, "fontSizes": true, "iconSizes": true, "iconLibrary": true, "pageTransition": true, "googleMapsKey": true, "notice": true}
	themeModes    = map[string]bool{"light": true, "dark": true, "system": true}
	sizeMaximums  = map[string]float64{"spacing": 256, "radii": 9999, "fontSizes": 160, "iconSizes": 128}
)

// ValidHexColor is a six-digit #rrggbb string.
func ValidHexColor(v *js.JSON) bool {
	return v != nil && v.Kind == js.JSONString && hexColor.MatchString(v.String)
}

// BuiltIn reports whether a group already defines name.
func BuiltIn(group, name string) bool {
	if group == "colors" {
		return registry.IsColorVariable(name)
	}
	_, ok := registry.SizeDefault(group, name)
	return ok
}

func validCustomName(name string) bool {
	return customToken.MatchString(name) && !reservedNames[name]
}

// Valid is validStudioConfig: nil (no config) is valid.
func Valid(config *js.JSON) bool {
	if config == nil {
		return true
	}
	if !config.IsObject() {
		return false
	}
	for _, key := range config.Object.Keys() {
		if !allowedKeys[key] {
			return false
		}
	}
	library := config.Field("iconLibrary")
	if library == nil || library.Kind != js.JSONString || !iconLibraries[library.String] {
		return false
	}
	if mode := config.Field("themeMode"); mode != nil && (mode.Kind != js.JSONString || !themeModes[mode.String]) {
		return false
	}
	// The Google Maps display key (projectConfig.ts's GOOGLE_MAPS_KEY).
	if key := config.Field("googleMapsKey"); key != nil && (key.Kind != js.JSONString || !GoogleMapsKey.MatchString(key.String)) {
		return false
	}
	if transition := config.Field("pageTransition"); transition != nil && (transition.Kind != js.JSONString || !PageTransitions[transition.String]) {
		return false
	}
	// The action message toast (projectConfig.ts's validNoticeStyle).
	if notice := config.Field("notice"); notice != nil {
		if !notice.IsObject() {
			return false
		}
		light := config.Field("colors")
		token := func(name *js.JSON) bool {
			return name.Kind == js.JSONString && (BuiltIn("colors", name.String) || (light.IsObject() && light.Object.Has(name.String)))
		}
		for _, key := range notice.Object.Keys() {
			value := notice.Field(key)
			switch key {
			case "background", "color":
				if !token(value) {
					return false
				}
			case "position":
				if value.Kind != js.JSONString || (value.String != "top" && value.String != "bottom") {
					return false
				}
			case "seconds":
				if value.Kind != js.JSONNumber || value.Number < 1 || value.Number > 10 {
					return false
				}
			default:
				return false
			}
		}
	}
	if dark := config.Field("darkColors"); dark != nil {
		light := config.Field("colors")
		if !dark.IsObject() || !light.IsObject() {
			return false
		}
		// Built-in roles, or a custom token the light palette defines.
		for _, key := range dark.Object.Keys() {
			if !(BuiltIn("colors", key) || light.Object.Has(key)) || !ValidHexColor(dark.Field(key)) {
				return false
			}
		}
	}
	for _, group := range Groups {
		values := config.Field(group)
		if !values.IsObject() {
			return false
		}
		custom := 0
		for _, key := range values.Object.Keys() {
			if !BuiltIn(group, key) {
				custom++
			}
		}
		if custom > MaxCustomTokens {
			return false
		}
		for _, key := range values.Object.Keys() {
			value := values.Field(key)
			known := BuiltIn(group, key) || validCustomName(key)
			if group == "colors" {
				if !known || !ValidHexColor(value) {
					return false
				}
				continue
			}
			min := 0.0
			if group == "fontSizes" || group == "iconSizes" {
				min = 1
			}
			if !known || value == nil || value.Kind != js.JSONNumber ||
				value.Number < min || value.Number > sizeMaximums[group] {
				return false
			}
		}
	}
	return true
}

// UsesDarkTheme is usesDarkTheme: the app has a dark theme too (dark or system).
func UsesDarkTheme(config *js.JSON) bool {
	mode := config.Field("themeMode")
	return mode != nil && mode.Kind == js.JSONString && (mode.String == "dark" || mode.String == "system")
}

// PageTransitions are pageTransitions.ts's: how a page can be entered.
var PageTransitions = map[string]bool{"platform": true, "none": true, "fade": true, "slideUp": true, "slideLeft": true}

// PageTransition is the configured pageTransition, "platform" when unset.
func PageTransition(config *js.JSON) string {
	if transition := config.Field("pageTransition"); transition != nil && transition.Kind == js.JSONString {
		return transition.String
	}
	return "platform"
}

// ThemeMode is the configured themeMode, "light" when unset.
func ThemeMode(config *js.JSON) string {
	if mode := config.Field("themeMode"); mode != nil && mode.Kind == js.JSONString {
		return mode.String
	}
	return "light"
}

// DarkPalette is paletteColors(config, "dark"): the custom tokens' light
// values, then darkColors over them, in JS key order.
func DarkPalette(config *js.JSON) *js.Object[*js.JSON] {
	palette := js.NewObject[*js.JSON]()
	colors := config.Field("colors")
	for _, name := range CustomTokens(config, "colors") {
		palette.Set(name, colors.Field(name))
	}
	if dark := config.Field("darkColors"); dark.IsObject() {
		for _, name := range dark.Object.Keys() {
			palette.Set(name, dark.Field(name))
		}
	}
	return palette
}

// CustomTokens are the names a project added itself to a group, in the
// order they were added.
func CustomTokens(config *js.JSON, group string) []string {
	values := config.Field(group)
	if !values.IsObject() {
		return nil
	}
	var names []string
	for _, key := range values.Object.Keys() {
		if !BuiltIn(group, key) {
			names = append(names, key)
		}
	}
	return names
}

// FamilyCustomTokens is activeCustomTokens(family) for this project.
func FamilyCustomTokens(config *js.JSON, family string) []string {
	group, ok := TokenGroups[family]
	if !ok {
		return nil
	}
	return CustomTokens(config, group)
}
