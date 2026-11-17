package main

import (
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

//go:embed all:templates
var templates embed.FS

var templateNames = []string{"site", "app", "store"}

var projectName = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,99}$`)

// title is a project's name as a person reads it: "my-shop" → "My Shop".
func title(name string) string {
	words := strings.FieldsFunc(name, func(r rune) bool { return r == '-' || r == '_' || r == '.' })
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}

func runNew(args []string) error {
	flags := flag.NewFlagSet("new", flag.ExitOnError)
	template := flags.String("template", "site", "site (a website), app (a Flutter app) or store (a storefront on an Upskale business's API)")
	flags.Parse(flagsAnywhere(args))
	if flags.NArg() != 1 {
		return errors.New("usage: flux new <name> [--template site|app|store]")
	}
	dir := flags.Arg(0)
	name := strings.ToLower(filepath.Base(dir))
	if dir == "." {
		wd, _ := os.Getwd()
		name = strings.ToLower(filepath.Base(wd))
	}
	if !projectName.MatchString(name) {
		return fmt.Errorf("%q isn't a usable project name: lowercase letters, digits, dots, dashes and underscores", name)
	}
	known := false
	for _, t := range templateNames {
		known = known || t == *template
	}
	if !known {
		return fmt.Errorf("unknown template %q: %s", *template, strings.Join(templateNames, ", "))
	}
	if entries, err := os.ReadDir(dir); err == nil && len(entries) > 0 {
		return fmt.Errorf("%s isn't empty", dir)
	}
	root := path.Join("templates", *template)
	replace := strings.NewReplacer("{{name}}", name, "{{title}}", title(name))
	err := fs.WalkDir(templates, root, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		raw, err := templates.ReadFile(p)
		if err != nil {
			return err
		}
		target := filepath.Join(dir, filepath.FromSlash(strings.TrimPrefix(p, root+"/")))
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return os.WriteFile(target, []byte(replace.Replace(string(raw))), 0o644)
	})
	if err != nil {
		return err
	}
	if err := ensureIgnored(dir); err != nil {
		return err
	}
	fmt.Printf("Made %s (%s).\n", dir, *template)
	// npm create @upskale/flux says what's next itself: its project runs
	// flux through npm, not from the PATH.
	if os.Getenv("FLUX_CREATE") != "" {
		return nil
	}
	fmt.Println()
	switch *template {
	case "app":
		fmt.Printf("  cd %s\n  flux build --target flutter\n  cd dist/flutter && flutter run\n", dir)
	case "store":
		fmt.Printf("  cd %s\n  flux dev\n\nIt runs on sample data. Put your business's API address in flux.json\n(providers.upskale.api) for its real stores.\n", dir)
	default:
		fmt.Printf("  cd %s\n  flux dev\n", dir)
	}
	return nil
}
