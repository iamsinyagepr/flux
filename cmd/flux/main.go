// Command flux checks, builds and serves Flux projects.
//
//	flux new <name> [--template site|app|store]
//	flux check
//	flux build [--target web|flutter] [--out dir]
//	flux dev [--port 5173]
//	flux migrate [dir | project.upskale.json]
//	flux lsp
//	flux version
package main

import (
	"fmt"
	"os"

	"github.com/iamsinyagepr/flux"
	"github.com/iamsinyagepr/flux/dart"
)

// version is set by the release build (-ldflags "-X main.version=…").
var version = "dev"

const usage = `Flux: one source, compiled to a website and a Flutter app.

Usage:
  flux new <name> [--template site|app|store]   start a project
  flux check                                    check every .flx in the project
  flux build [--target web|flutter] [--out dir] compile the project
  flux dev [--port 5173]                        build the website and serve it, rebuilding as you edit
  flux migrate [dir | file.upskale.json]        .cdsl → .flx, or a Studio project into a folder
  flux lsp                                      the language server, over stdio (for editors)
  flux version                                  the CLI's and the compiler's versions

Docs: https://flux.upskalelabs.dev
`

func main() {
	if len(os.Args) < 2 {
		fmt.Print(usage)
		os.Exit(2)
	}
	args := os.Args[2:]
	var err error
	switch os.Args[1] {
	case "new", "init":
		err = runNew(args)
	case "check":
		err = runCheck(args)
	case "build":
		err = runBuild(args)
	case "dev":
		err = runDev(args)
	case "migrate":
		err = runMigrate(args)
	case "lsp":
		err = runLSP(args)
	case "version", "--version", "-v":
		fmt.Printf("flux %s (compiler %s)\n", version, dart.Version)
	case "help", "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "flux: unknown command %q\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
	if err != nil {
		if _, failed := err.(checkFailed); !failed {
			fmt.Fprintln(os.Stderr, "flux:", err)
		}
		os.Exit(1)
	}
}

// checkFailed is a check or build with errors, already printed.
type checkFailed struct{ errors int }

func (c checkFailed) Error() string { return fmt.Sprintf("%d errors", c.errors) }

var _ = flux.Compile
