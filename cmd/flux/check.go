package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/iamsinyagepr/flux"
	"github.com/iamsinyagepr/flux/project"
)

// diagnostic is a problem in one source.
type diagnostic struct {
	File     string // "pages/home.flx", or "" for the project
	Severity string // "error", "warning" or "info"
	Code     string
	Message  string
	From, To int // UTF-16 offsets
}

// diagnose is every problem in the project: its limits, each page's route,
// data and SEO, and what the compilers find, once each.
func diagnose(loaded *project.Loaded) []diagnostic {
	var out []diagnostic
	seen := map[string]bool{}
	add := func(d diagnostic) {
		key := fmt.Sprintf("%s|%d|%d|%s", d.File, d.From, d.To, d.Message)
		if !seen[key] {
			seen[key] = true
			out = append(out, d)
		}
	}
	fileOf := func(documentID string) string {
		if f := loaded.FileFor(documentID); f != nil {
			return f.Path
		}
		return ""
	}
	if field, message, ok := flux.Validate(loaded.Project); !ok {
		add(diagnostic{Severity: "error", Code: "project", Message: field + " " + message})
	}
	for documentID, problems := range loaded.Problems {
		for _, p := range problems {
			add(diagnostic{File: fileOf(documentID), Severity: "error", Code: "page", Message: p.Message, From: p.From, To: p.To})
		}
	}
	result := flux.Compile(loaded.Project, loaded.Config.API())
	for _, d := range result.Diagnostics {
		add(diagnostic{File: fileOf(d.DocumentID), Severity: d.Severity, Code: d.Code, Message: d.Message, From: d.From, To: d.To})
	}
	if len(loaded.Project.Pages) > 0 {
		if web, ok := flux.CompileWeb(loaded.Project, loaded.Config.API(), loaded.Config.Site); ok {
			for _, d := range web.Diagnostics {
				add(diagnostic{File: fileOf(d.DocumentID), Severity: d.Severity, Code: d.Code, Message: d.Message, From: d.From, To: d.To})
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].File != out[j].File {
			return out[i].File < out[j].File
		}
		return out[i].From < out[j].From
	})
	return out
}

// report prints diagnostics as file:line:col: severity: message, and how
// many errors there were.
func report(w io.Writer, loaded *project.Loaded, diagnostics []diagnostic) int {
	errors := 0
	for _, d := range diagnostics {
		if d.Severity == "error" {
			errors++
		}
		where := project.ConfigFile
		if d.File != "" {
			line, col := 1, 1
			for _, f := range loaded.Files {
				if f.Path == d.File {
					line, col = project.Position(f.Source, d.From)
				}
			}
			where = fmt.Sprintf("%s:%d:%d", d.File, line, col)
		}
		fmt.Fprintf(w, "%s: %s: %s\n", where, d.Severity, d.Message)
	}
	return errors
}

func load(dir string) (*project.Loaded, error) {
	root, err := project.Find(dir)
	if err != nil {
		return nil, err
	}
	return project.Load(root)
}

func runCheck(args []string) error {
	flags := flag.NewFlagSet("check", flag.ExitOnError)
	flags.Parse(args)
	dir := "."
	if flags.NArg() > 0 {
		dir = flags.Arg(0)
	}
	loaded, err := load(dir)
	if err != nil {
		return err
	}
	diagnostics := diagnose(loaded)
	errors := report(os.Stdout, loaded, diagnostics)
	files := len(loaded.Files)
	if errors > 0 {
		fmt.Printf("%d %s in %d %s\n", errors, plural(errors, "error", "errors"), files, plural(files, "file", "files"))
		return checkFailed{errors}
	}
	warnings := len(diagnostics) - errors
	summary := fmt.Sprintf("%d %s checked", files, plural(files, "file", "files"))
	if warnings > 0 {
		summary += fmt.Sprintf(", %d %s", warnings, plural(warnings, "warning", "warnings"))
	}
	fmt.Println(summary + ": no errors")
	return nil
}

func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

// flagsAnywhere lets flags follow positional arguments (flux new shop --template store).
func flagsAnywhere(args []string) []string {
	var flags, rest []string
	for i := 0; i < len(args); i++ {
		if strings.HasPrefix(args[i], "-") {
			flags = append(flags, args[i])
			if !strings.Contains(args[i], "=") && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
				flags = append(flags, args[i+1])
				i++
			}
			continue
		}
		rest = append(rest, args[i])
	}
	return append(flags, rest...)
}
