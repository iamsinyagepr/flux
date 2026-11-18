package main

import (
	"crypto/sha256"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/iamsinyagepr/flux"
	"github.com/iamsinyagepr/flux/project"
)

// runDev builds the website into .flux/web, installs its packages, runs its
// dev server and rebuilds as sources change: only changed files are
// written, so Vite reloads just what changed.
func runDev(args []string) error {
	flags := flag.NewFlagSet("dev", flag.ExitOnError)
	port := flags.Int("port", 5173, "the dev server's port")
	noEditor := flags.Bool("no-editor", false, "serve the site without the editor over it")
	flags.Parse(flagsAnywhere(args))
	dir := "."
	if flags.NArg() > 0 {
		dir = flags.Arg(0)
	}
	root, err := project.Find(dir)
	if err != nil {
		return err
	}
	out := filepath.Join(root, ".flux", "web")
	if err := ensureIgnored(root); err != nil {
		return err
	}

	// The editor over the page (cmd/flux/editor.go): its own server, beside
	// the site's, the page marked so it can find each widget's source.
	var edit *editor
	options := flux.WebOptions{}
	if !*noEditor {
		edit = newEditor(root, *port)
		overlay, err := edit.listen(*port + 1000)
		if err != nil {
			return fmt.Errorf("starting the editor: %w", err)
		}
		options = flux.WebOptions{Marks: true, OverlayURL: overlay}
	}

	build := func() bool {
		// The editor learns whether the page on screen is this build or the
		// last one that worked (a source with an error keeps it there).
		failed := func(loaded *project.Loaded, diagnostics []diagnostic, err error) bool {
			if edit != nil {
				edit.buildFailed(loaded, diagnostics, err)
			}
			return false
		}
		loaded, err := project.Load(root)
		if err != nil {
			fmt.Fprintln(os.Stderr, "flux:", err)
			return failed(nil, nil, err)
		}
		files, diagnostics, err := compileWith(loaded, "web", options)
		if err != nil {
			fmt.Fprintln(os.Stderr, "flux:", err)
			return failed(loaded, diagnostics, err)
		}
		report(os.Stderr, loaded, diagnostics)
		if files == nil {
			fmt.Fprintln(os.Stderr, "flux: not rebuilt: fix the errors above (the page keeps its last build)")
			return failed(loaded, diagnostics, nil)
		}
		changed, err := writeOutput(out, files)
		if err != nil {
			fmt.Fprintln(os.Stderr, "flux:", err)
			return failed(loaded, nil, err)
		}
		if edit != nil {
			edit.builtFrom(loaded)
		}
		if changed > 0 {
			fmt.Printf("flux: rebuilt (%d %s changed)\n", changed, plural(changed, "file", "files"))
		}
		return true
	}

	if !build() {
		if _, err := os.Stat(filepath.Join(out, "package.json")); err != nil {
			return errors.New("the first build failed; fix the errors and run flux dev again")
		}
	}
	if err := install(out); err != nil {
		return err
	}

	server := npm(out, "run", "dev", "--", "--port", strconv.Itoa(*port), "--strictPort")
	server.Stdout, server.Stderr = os.Stdout, os.Stderr
	if err := server.Start(); err != nil {
		return fmt.Errorf("starting the dev server: %w", err)
	}
	fmt.Printf("flux: serving on http://localhost:%d, watching %s\n", *port, root)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	exited := make(chan error, 1)
	go func() { exited <- server.Wait() }()

	last := snapshot(root)
	tick := time.NewTicker(300 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-stop:
			if server.Process != nil {
				server.Process.Kill()
			}
			return nil
		case err := <-exited:
			if err != nil {
				return fmt.Errorf("the dev server stopped: %w", err)
			}
			return nil
		case <-tick.C:
			now := snapshot(root)
			if now == last {
				continue
			}
			last = now
			before := hashFile(filepath.Join(out, "package.json"))
			build()
			if edit != nil {
				edit.changed()
			}
			if hashFile(filepath.Join(out, "package.json")) != before {
				// A widget that needs a new package (a map, an animation).
				if err := install(out); err != nil {
					fmt.Fprintln(os.Stderr, "flux:", err)
				}
			}
		}
	}
}

// snapshot is a fingerprint of the project's sources: each .flx and
// flux.json, by path, size and time.
func snapshot(root string) string {
	h := sha256.New()
	filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			switch d.Name() {
			case ".flux", "dist", "node_modules", ".git":
				return filepath.SkipDir
			}
			return nil
		}
		public := strings.HasPrefix(path, filepath.Join(root, "public")+string(filepath.Separator))
		if strings.HasSuffix(path, project.Ext) || d.Name() == project.ConfigFile || public {
			if info, err := d.Info(); err == nil {
				fmt.Fprintf(h, "%s|%d|%d\n", path, info.Size(), info.ModTime().UnixNano())
			}
		}
		return nil
	})
	return string(h.Sum(nil))
}

func hashFile(path string) string {
	raw, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	sum := sha256.Sum256(raw)
	return string(sum[:])
}

func npm(dir string, args ...string) *exec.Cmd {
	cmd := exec.Command("npm", args...)
	cmd.Dir = dir
	return cmd
}

// install runs npm install in the build when its packages aren't there yet,
// or have changed since they were installed.
func install(dir string) error {
	stamp := filepath.Join(dir, "node_modules", ".flux-installed")
	want := hashFile(filepath.Join(dir, "package.json"))
	if had, err := os.ReadFile(stamp); err == nil && string(had) == want {
		return nil
	}
	if _, err := exec.LookPath("npm"); err != nil {
		return errors.New("flux dev runs the website with Node.js: install it from https://nodejs.org (npm comes with it)")
	}
	fmt.Println("flux: installing the website's packages (npm install)…")
	cmd := npm(dir, "install", "--no-audit", "--no-fund")
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("npm install: %w", err)
	}
	return os.WriteFile(stamp, []byte(want), 0o644)
}

// ensureIgnored keeps .flux/ and dist/ out of the project's git.
func ensureIgnored(root string) error {
	path := filepath.Join(root, ".gitignore")
	raw, _ := os.ReadFile(path)
	text := string(raw)
	var add []string
	for _, line := range []string{".flux/", "dist/"} {
		if !strings.Contains(text, line) {
			add = append(add, line)
		}
	}
	if len(add) == 0 {
		return nil
	}
	if text != "" && !strings.HasSuffix(text, "\n") {
		text += "\n"
	}
	return os.WriteFile(path, []byte(text+strings.Join(add, "\n")+"\n"), 0o644)
}
