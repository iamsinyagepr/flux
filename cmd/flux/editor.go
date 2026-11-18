package main

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/iamsinyagepr/flux/config"
	"github.com/iamsinyagepr/flux/js"
	"github.com/iamsinyagepr/flux/project"
)

// The editor flux dev puts over the site it serves (editor/, built into
// overlay/overlay.js): Studio's context menu and properties panel, editing
// the project's .flx files through this server.
//
//go:embed overlay/overlay.js
var overlayScript []byte

// editor is flux dev's editing server: on 127.0.0.1 only, and every request
// carries the session's token (in the overlay's own address), so no other
// site open in the browser can read or write the project.
type editor struct {
	root    string
	token   string
	origins map[string]bool // the dev site's, the only one the overlay runs on
	mu      sync.Mutex
	clients map[chan struct{}]bool
	// built is each source as the page was last built from it (its marks
	// point into these), and failing the errors that stopped the latest
	// build: while there are any, the page shows that last build.
	built   map[string]string
	failing []editorProblem
}

// editorProblem is an error that stops the build, where it is.
type editorProblem struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Message string `json:"message"`
}

// builtFrom records a build that succeeded: the sources the page now shows.
func (e *editor) builtFrom(loaded *project.Loaded) {
	built := map[string]string{}
	for _, f := range loaded.Files {
		built[f.DocumentID] = f.Source
	}
	e.mu.Lock()
	e.built, e.failing = built, nil
	e.mu.Unlock()
}

// buildFailed records a build stopped by errors: the page keeps the last one.
func (e *editor) buildFailed(loaded *project.Loaded, diagnostics []diagnostic, err error) {
	var problems []editorProblem
	if err != nil {
		problems = append(problems, editorProblem{Path: project.ConfigFile, Message: err.Error()})
	}
	for _, d := range diagnostics {
		if d.Severity != "error" {
			continue
		}
		p := editorProblem{Path: d.File, Message: d.Message}
		if p.Path == "" {
			p.Path = project.ConfigFile
		}
		if loaded != nil {
			for _, f := range loaded.Files {
				if f.Path == d.File {
					p.Line, p.Column = project.Position(f.Source, d.From)
				}
			}
		}
		problems = append(problems, p)
	}
	e.mu.Lock()
	e.failing = problems
	e.mu.Unlock()
}

func newEditor(root string, sitePort int) *editor {
	raw := make([]byte, 16)
	rand.Read(raw)
	return &editor{
		root:  root,
		token: hex.EncodeToString(raw),
		origins: map[string]bool{
			fmt.Sprintf("http://localhost:%d", sitePort): true,
			fmt.Sprintf("http://127.0.0.1:%d", sitePort): true,
		},
		clients: map[chan struct{}]bool{},
	}
}

// listen starts the server, on port if it's free or the next one that is.
func (e *editor) listen(port int) (string, error) {
	var listener net.Listener
	var err error
	for try := 0; try < 20; try++ {
		listener, err = net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port+try))
		if err == nil {
			break
		}
	}
	if err != nil {
		return "", err
	}
	go http.Serve(listener, e)
	return fmt.Sprintf("http://127.0.0.1:%d/__flux/overlay.js?t=%s", listener.Addr().(*net.TCPAddr).Port, e.token), nil
}

// changed tells every open overlay to read the project again.
func (e *editor) changed() {
	e.mu.Lock()
	defer e.mu.Unlock()
	for client := range e.clients {
		select {
		case client <- struct{}{}:
		default:
		}
	}
}

func (e *editor) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if origin := r.Header.Get("Origin"); origin != "" {
		if !e.origins[origin] {
			http.Error(w, "not the dev site", http.StatusForbidden)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Flux-Token, X-Flux-Name")
		w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, POST")
		w.Header().Set("Vary", "Origin")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	token := r.Header.Get("X-Flux-Token")
	if token == "" {
		token = r.URL.Query().Get("t")
	}
	if token != e.token {
		http.Error(w, "this isn't flux dev's session", http.StatusUnauthorized)
		return
	}
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/__flux/overlay.js":
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(overlayScript)
	case r.Method == http.MethodGet && r.URL.Path == "/__flux/project":
		e.project(w)
	case r.Method == http.MethodPut && r.URL.Path == "/__flux/source":
		e.save(w, r)
	case r.Method == http.MethodPut && r.URL.Path == "/__flux/config":
		e.saveConfig(w, r)
	case r.Method == http.MethodPost && r.URL.Path == "/__flux/upload":
		e.upload(w, r)
	case r.Method == http.MethodGet && r.URL.Path == "/__flux/events":
		e.events(w, r)
	default:
		http.NotFound(w, r)
	}
}

func reply(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func problem(w http.ResponseWriter, status int, message string) {
	reply(w, status, map[string]string{"error": message})
}

type editorFile struct {
	Path       string `json:"path"`
	DocumentID string `json:"documentId"`
	Source     string `json:"source"`
}

type editorPage struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

type editorDiagnostic struct {
	Code     string `json:"code"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	From     int    `json:"from"`
	To       int    `json:"to"`
}

// project is the sources as they are on disk, the pages, the theme, and
// each source's problems.
func (e *editor) project(w http.ResponseWriter) {
	loaded, err := project.Load(e.root)
	if err != nil {
		problem(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	files := make([]editorFile, len(loaded.Files))
	byPath := map[string]string{}
	for i, f := range loaded.Files {
		files[i] = editorFile{f.Path, f.DocumentID, f.Source}
		byPath[f.Path] = f.DocumentID
	}
	pages := make([]editorPage, len(loaded.Project.Pages))
	for i, p := range loaded.Project.Pages {
		pages[i] = editorPage{p.ID, p.Name, p.Path}
	}
	diagnostics := map[string][]editorDiagnostic{}
	for _, d := range diagnose(loaded) {
		if id, ok := byPath[d.File]; ok {
			diagnostics[id] = append(diagnostics[id], editorDiagnostic{d.Code, d.Severity, d.Message, d.From, d.To})
		}
	}
	e.mu.Lock()
	built, failing := e.built, e.failing
	e.mu.Unlock()
	if failing == nil {
		failing = []editorProblem{}
	}
	reply(w, http.StatusOK, map[string]any{
		"name":        loaded.Config.Name,
		"description": loaded.Config.Description,
		"files":       files,
		"pages":       pages,
		"config":      loaded.Project.Config,
		"diagnostics": diagnostics,
		// What the page on screen was built from, and what stops a new build.
		"built":   built,
		"failing": failing,
	})
}

// save writes an edited source, unless the file changed on disk since the
// edit was made (before), which is a conflict: nothing is written.
func (e *editor) save(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DocumentID string `json:"documentId"`
		Source     string `json:"source"`
		Before     string `json:"before"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		problem(w, http.StatusBadRequest, "expected {documentId, source, before}")
		return
	}
	loaded, err := project.Load(e.root)
	if err != nil {
		problem(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	file := loaded.FileFor(body.DocumentID)
	if file == nil {
		problem(w, http.StatusNotFound, "there's no source "+body.DocumentID)
		return
	}
	if file.Source != body.Before {
		problem(w, http.StatusConflict, file.Path+" changed on disk since that edit was made")
		return
	}
	full := filepath.Join(e.root, filepath.FromSlash(file.Path))
	source := body.Source
	// A file written with Windows line endings keeps them.
	if raw, err := os.ReadFile(full); err == nil && strings.Contains(string(raw), "\r\n") {
		source = strings.ReplaceAll(source, "\n", "\r\n")
	}
	if err := os.WriteFile(full, []byte(source), 0o644); err != nil {
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	reply(w, http.StatusOK, map[string]string{"path": file.Path})
}

var (
	uploadName  = regexp.MustCompile(`[^a-z0-9._-]+`)
	uploadTypes = map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true, ".svg": true, ".avif": true}
)

// upload saves an image into the project's public/uploads, served at /uploads/<name>.
func (e *editor) upload(w http.ResponseWriter, r *http.Request) {
	given, _ := url.QueryUnescape(r.Header.Get("X-Flux-Name"))
	name := uploadName.ReplaceAllString(strings.ToLower(path.Base(given)), "-")
	ext := path.Ext(name)
	if !uploadTypes[ext] {
		problem(w, http.StatusUnsupportedMediaType, "flux dev takes images: png, jpg, gif, webp, svg or avif")
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, 10<<20+1))
	if err != nil || len(data) > 10<<20 {
		problem(w, http.StatusRequestEntityTooLarge, "an image is at most 10 MB")
		return
	}
	dir := filepath.Join(e.root, "public", "uploads")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	stem := strings.TrimSuffix(name, ext)
	for n := 1; ; n++ {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			break
		}
		name = fmt.Sprintf("%s-%d%s", stem, n, ext)
	}
	if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	reply(w, http.StatusOK, map[string]string{"url": "/uploads/" + name})
}

// events is a stream with a "changed" event after every rebuild.
func (e *editor) events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "no streaming", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	client := make(chan struct{}, 1)
	e.mu.Lock()
	e.clients[client] = true
	e.mu.Unlock()
	defer func() {
		e.mu.Lock()
		delete(e.clients, client)
		e.mu.Unlock()
	}()
	fmt.Fprint(w, ": flux\n\n")
	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-client:
			fmt.Fprint(w, "event: changed\ndata: {}\n\n")
			flusher.Flush()
		}
	}
}

// configOrder is flux.json's keys in the order a project writes them; any
// other key keeps its place after these.
var configOrder = []string{"name", "description", "entry", "theme", "transitions", "site", "providers"}

// saveConfig writes the theme dialog's changes into flux.json: its theme,
// and the project's name and description. Everything else in it stays.
func (e *editor) saveConfig(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Theme       json.RawMessage `json:"theme"`
		Name        *string         `json:"name"`
		Description *string         `json:"description"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil || len(body.Theme) == 0 {
		problem(w, http.StatusBadRequest, "expected {theme, name, description}")
		return
	}
	path := filepath.Join(e.root, project.ConfigFile)
	raw, err := os.ReadFile(path)
	if err != nil {
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	var keys []string
	values := map[string]json.RawMessage{}
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		problem(w, http.StatusUnprocessableEntity, project.ConfigFile+" isn't a JSON object")
		return
	}
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			problem(w, http.StatusUnprocessableEntity, project.ConfigFile+": "+err.Error())
			return
		}
		key := token.(string)
		var value json.RawMessage
		if err := decoder.Decode(&value); err != nil {
			problem(w, http.StatusUnprocessableEntity, project.ConfigFile+": "+err.Error())
			return
		}
		keys = append(keys, key)
		values[key] = value
	}
	set := func(key string, value json.RawMessage) {
		if _, ok := values[key]; !ok {
			keys = append(keys, key)
		}
		values[key] = value
	}
	// A theme Studio's own checks refuse would stop every build: not written.
	var theme struct {
		Config *js.JSON `json:"config"`
	}
	if err := json.Unmarshal([]byte(`{"config":`+string(body.Theme)+`}`), &theme); err != nil || !config.Valid(theme.Config) {
		problem(w, http.StatusUnprocessableEntity, "that theme isn't one Flux can build with")
		return
	}
	set("theme", body.Theme)
	if body.Name != nil && *body.Name != "" {
		name, _ := json.Marshal(*body.Name)
		set("name", name)
	}
	if body.Description != nil {
		description, _ := json.Marshal(*body.Description)
		set("description", description)
	}
	// The known keys first, in their order; the rest as they were.
	ordered := make([]string, 0, len(keys))
	for _, key := range configOrder {
		if _, ok := values[key]; ok {
			ordered = append(ordered, key)
		}
	}
	for _, key := range keys {
		known := false
		for _, k := range configOrder {
			known = known || k == key
		}
		if !known {
			ordered = append(ordered, key)
		}
	}
	var out strings.Builder
	out.WriteString("{\n")
	for i, key := range ordered {
		var indented strings.Builder
		var value any
		json.Unmarshal(values[key], &value)
		text, _ := json.MarshalIndent(value, "  ", "  ")
		indented.Write(text)
		name, _ := json.Marshal(key)
		fmt.Fprintf(&out, "  %s: %s", name, indented.String())
		if i < len(ordered)-1 {
			out.WriteString(",")
		}
		out.WriteString("\n")
	}
	out.WriteString("}\n")
	// Written whole or not at all: to a file beside it, then put in its place.
	if err := os.WriteFile(path+".next", []byte(out.String()), 0o644); err != nil {
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := os.Rename(path+".next", path); err != nil {
		os.Remove(path + ".next")
		problem(w, http.StatusInternalServerError, err.Error())
		return
	}
	reply(w, http.StatusOK, map[string]string{"path": project.ConfigFile})
}
