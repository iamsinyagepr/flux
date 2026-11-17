package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/iamsinyagepr/flux/project"
)

// runMigrate brings older sources to Flux: a folder's .cdsl files (CDSL, Flux's former name) renamed
// to .flx, or a project exported from Upskale Studio (<name>.upskale.json)
// laid out as a Flux project.
func runMigrate(args []string) error {
	flags := flag.NewFlagSet("migrate", flag.ExitOnError)
	out := flags.String("out", "", "for a Studio project file: the folder to write (default: its name)")
	flags.Parse(flagsAnywhere(args))
	target := "."
	if flags.NArg() > 0 {
		target = flags.Arg(0)
	}
	if strings.HasSuffix(target, ".json") {
		return importStudio(target, *out)
	}
	renamed := 0
	err := filepath.WalkDir(target, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			switch d.Name() {
			case "node_modules", ".git", ".flux", "dist":
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".cdsl") {
			return nil
		}
		to := strings.TrimSuffix(path, ".cdsl") + project.Ext
		if _, err := os.Stat(to); err == nil {
			return fmt.Errorf("%s and %s both exist: keep one", path, to)
		}
		if err := os.Rename(path, to); err != nil {
			return err
		}
		fmt.Printf("%s → %s\n", path, to)
		renamed++
		return nil
	})
	if err != nil {
		return err
	}
	if renamed == 0 {
		fmt.Println("nothing to migrate: no .cdsl files here")
	}
	return nil
}

// studioFile is Studio's project export (projectFile.ts).
type studioFile struct {
	Format  string `json:"format"`
	Project struct {
		Name             string            `json:"name"`
		Description      string            `json:"description"`
		Source           string            `json:"source"`
		ShellSource      string            `json:"shellSource"`
		EntryPageID      string            `json:"entryPageId"`
		ComponentSources map[string]string `json:"componentSources"`
		Config           json.RawMessage   `json:"config"`
		Language         string            `json:"language"`
		StoreID          string            `json:"storeId"`
		Pages            []struct {
			ID         string `json:"id"`
			Source     string `json:"source"`
			Transition string `json:"transition"`
		} `json:"pages"`
	} `json:"project"`
}

func importStudio(file, out string) error {
	raw, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	var studio studioFile
	if err := json.Unmarshal(raw, &studio); err != nil || studio.Format != "upskale-studio-project" {
		return errors.New(file + " isn't a project exported from Upskale Studio")
	}
	p := studio.Project
	if p.Language == "dart" {
		return errors.New("this project was converted to Dart in Studio: it has no Flux sources left to move")
	}
	if out == "" {
		out = strings.TrimSuffix(strings.TrimSuffix(filepath.Base(file), ".json"), ".upskale")
	}
	if entries, err := os.ReadDir(out); err == nil && len(entries) > 0 {
		return fmt.Errorf("%s isn't empty: choose another --out", out)
	}
	config := project.Config{Name: strings.ToLower(filepath.Base(out)), Description: p.Description, Theme: p.Config}
	if p.EntryPageID != "" && p.EntryPageID != "home" {
		config.Entry = p.EntryPageID
	}
	if p.StoreID != "" {
		config.Providers.Upskale = &project.Upskale{Store: p.StoreID}
	}
	write := func(rel, content string) error {
		path := filepath.Join(out, filepath.FromSlash(rel))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return err
		}
		fmt.Println("  " + rel)
		return os.WriteFile(path, []byte(content), 0o644)
	}
	fmt.Printf("%s → %s/\n", file, out)
	for _, page := range p.Pages {
		if page.Transition != "" {
			if config.Transitions == nil {
				config.Transitions = map[string]string{}
			}
			config.Transitions[page.ID] = page.Transition
		}
		if err := write("pages/"+page.ID+project.Ext, page.Source); err != nil {
			return err
		}
	}
	names := make([]string, 0, len(p.ComponentSources))
	for name := range p.ComponentSources {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		if err := write("components/"+name+project.Ext, p.ComponentSources[name]); err != nil {
			return err
		}
	}
	if strings.TrimSpace(p.ShellSource) != "" {
		if err := write("shell"+project.Ext, p.ShellSource); err != nil {
			return err
		}
	}
	if len(p.Pages) == 0 {
		if err := write("main"+project.Ext, p.Source); err != nil {
			return err
		}
	}
	settings, _ := json.MarshalIndent(config, "", "  ")
	if err := write(project.ConfigFile, string(settings)+"\n"); err != nil {
		return err
	}
	if err := ensureIgnored(out); err != nil {
		return err
	}
	fmt.Printf("\n  cd %s\n  flux check\n", out)
	return nil
}
