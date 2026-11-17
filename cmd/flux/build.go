package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/iamsinyagepr/flux"
	"github.com/iamsinyagepr/flux/project"
)

// marker is the file flux leaves in an output folder: a folder without it
// isn't flux's to clear.
const marker = ".flux-output"

// outFile is one generated file, by its path inside the output.
type outFile struct {
	Path    string
	Content string
}

// compile is the project's files for a target, or why it can't build.
func compile(loaded *project.Loaded, target string) ([]outFile, []diagnostic, error) {
	return compileWith(loaded, target, flux.WebOptions{})
}

// publicFiles are the project's public/ folder (images, a favicon), served
// as they are by the website: public/uploads/x.png at /uploads/x.png.
func publicFiles(root string) ([]outFile, error) {
	var files []outFile
	dir := filepath.Join(root, "public")
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return filepath.SkipAll
			}
			return err
		}
		if d.IsDir() {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(dir, path)
		files = append(files, outFile{"public/" + filepath.ToSlash(rel), string(raw)})
		return nil
	})
	return files, err
}

// compileWith is compile with a dev build's website options.
func compileWith(loaded *project.Loaded, target string, options flux.WebOptions) ([]outFile, []diagnostic, error) {
	diagnostics := diagnose(loaded)
	for _, d := range diagnostics {
		if d.Severity == "error" {
			return nil, diagnostics, nil
		}
	}
	var files []outFile
	switch target {
	case "web":
		result, ok := flux.CompileWebWith(loaded.Project, loaded.Config.API(), loaded.Config.Site, options)
		if !ok {
			return nil, diagnostics, errors.New("a website needs pages: add pages/<id>" + project.Ext + " (a single main" + project.Ext + " builds with --target flutter)")
		}
		generated := map[string]bool{}
		for _, f := range result.Files {
			files = append(files, outFile{f.Path, f.Content})
			generated[f.Path] = true
		}
		public, err := publicFiles(loaded.Dir)
		if err != nil {
			return nil, diagnostics, err
		}
		for _, f := range public {
			// What the compiler writes (robots.txt, sitemap.xml) wins.
			if !generated[f.Path] {
				files = append(files, f)
			}
		}
	case "flutter":
		result := flux.Compile(loaded.Project, loaded.Config.API())
		for _, f := range result.Files {
			files = append(files, outFile{f.Name, f.Content})
		}
	default:
		return nil, nil, fmt.Errorf("unknown target %q: web or flutter", target)
	}
	return files, diagnostics, nil
}

// defaultTarget is web for a project with pages, flutter for one component.
func defaultTarget(loaded *project.Loaded) string {
	if len(loaded.Project.Pages) > 0 {
		return "web"
	}
	return "flutter"
}

func runBuild(args []string) error {
	flags := flag.NewFlagSet("build", flag.ExitOnError)
	target := flags.String("target", "", "web (a React website) or flutter (a Flutter app); default web for a project with pages")
	out := flags.String("out", "", "the output folder (default dist/<target>)")
	flags.Parse(flagsAnywhere(args))
	dir := "."
	if flags.NArg() > 0 {
		dir = flags.Arg(0)
	}
	loaded, err := load(dir)
	if err != nil {
		return err
	}
	if *target == "" {
		*target = defaultTarget(loaded)
	}
	if *out == "" {
		*out = filepath.Join(loaded.Dir, "dist", *target)
	}
	files, diagnostics, err := compile(loaded, *target)
	if err != nil {
		return err
	}
	if errors := report(os.Stderr, loaded, diagnostics); files == nil {
		fmt.Fprintf(os.Stderr, "not built: %d %s\n", errors, plural(errors, "error", "errors"))
		return checkFailed{errors}
	}
	written, err := writeOutput(*out, files)
	if err != nil {
		return err
	}
	rel := *out
	if wd, err := os.Getwd(); err == nil {
		if r, err := filepath.Rel(wd, *out); err == nil {
			rel = r
		}
	}
	fmt.Printf("built %s → %s (%d files, %d changed)\n", *target, rel, len(files), written)
	switch *target {
	case "web":
		fmt.Printf("  cd %s && npm install && npm run dev\n", rel)
	case "flutter":
		fmt.Printf("  cd %s && flutter pub get && flutter run\n", rel)
	}
	return nil
}

// writeOutput makes dir hold exactly files: each written only when it
// changed (a dev server reloads only what did), any other file of a former
// build removed. It never clears a folder flux didn't make.
func writeOutput(dir string, files []outFile) (int, error) {
	if entries, err := os.ReadDir(dir); err == nil && len(entries) > 0 {
		if _, err := os.Stat(filepath.Join(dir, marker)); err != nil {
			return 0, fmt.Errorf("%s isn't empty and isn't a flux build: choose another --out", dir)
		}
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return 0, err
	}
	keep := map[string]bool{marker: true}
	written := 0
	for _, f := range files {
		clean := filepath.FromSlash(f.Path)
		if filepath.IsAbs(clean) || strings.HasPrefix(filepath.Clean(clean), "..") {
			return written, fmt.Errorf("the compiler gave a path outside the output: %s", f.Path)
		}
		keep[filepath.ToSlash(filepath.Clean(clean))] = true
		path := filepath.Join(dir, clean)
		if old, err := os.ReadFile(path); err == nil && bytes.Equal(old, []byte(f.Content)) {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return written, err
		}
		if err := os.WriteFile(path, []byte(f.Content), 0o644); err != nil {
			return written, err
		}
		written++
	}
	// What the generated project makes for itself is its own: its packages,
	// its build output, Flutter's and Vite's caches.
	own := map[string]bool{"node_modules": true, "dist": true, ".output": true, ".dart_tool": true, "build": true, ".tanstack": true, ".vinxi": true}
	var stale []string
	filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || path == dir {
			return nil
		}
		rel, _ := filepath.Rel(dir, path)
		rel = filepath.ToSlash(rel)
		if d.IsDir() {
			if own[d.Name()] && !strings.Contains(rel, "/") {
				return filepath.SkipDir
			}
			return nil
		}
		if !keep[rel] && !generatedByTools(rel) {
			stale = append(stale, path)
		}
		return nil
	})
	sort.Strings(stale)
	for _, path := range stale {
		os.Remove(path)
	}
	os.WriteFile(filepath.Join(dir, marker), []byte("Made by flux build: it may replace anything here.\n"), 0o644)
	return written, nil
}

// generatedByTools are files the generated project's own tools write.
func generatedByTools(rel string) bool {
	switch rel {
	case "package-lock.json", "pubspec.lock", "src/routeTree.gen.ts", ".flutter-plugins", ".flutter-plugins-dependencies", ".metadata":
		return true
	}
	return strings.HasPrefix(rel, ".idea/") || strings.HasPrefix(rel, "android/") || strings.HasPrefix(rel, "ios/") ||
		strings.HasPrefix(rel, "web/") || strings.HasPrefix(rel, "windows/") || strings.HasPrefix(rel, "macos/") || strings.HasPrefix(rel, "linux/")
}
