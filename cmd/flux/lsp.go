package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/iamsinyagepr/flux/project"
	"github.com/iamsinyagepr/flux/registry"
)

// runLSP is the language server, over stdio: diagnostics as you type (the
// same flux check gives), completion of widgets, parameters and tokens, and
// hover with each one's parameters.
func runLSP(args []string) error {
	s := &server{out: bufio.NewWriter(os.Stdout), open: map[string]string{}, published: map[string]bool{}}
	return s.serve(bufio.NewReader(os.Stdin))
}

type server struct {
	mu        sync.Mutex
	out       *bufio.Writer
	open      map[string]string // abs path → text
	published map[string]bool   // uris with diagnostics shown
	timer     *time.Timer
	pending   map[string]bool // project roots (or lone files) to check
}

type message struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Method  string           `json:"method,omitempty"`
	Params  json.RawMessage  `json:"params,omitempty"`
	Result  any              `json:"result,omitempty"`
	Error   any              `json:"error,omitempty"`
}

func (s *server) serve(in *bufio.Reader) error {
	for {
		length := 0
		for {
			line, err := in.ReadString('\n')
			if err != nil {
				if err == io.EOF {
					return nil
				}
				return err
			}
			line = strings.TrimSpace(line)
			if line == "" {
				break
			}
			if name, value, ok := strings.Cut(line, ":"); ok && strings.EqualFold(name, "Content-Length") {
				length, _ = strconv.Atoi(strings.TrimSpace(value))
			}
		}
		body := make([]byte, length)
		if _, err := io.ReadFull(in, body); err != nil {
			return err
		}
		var m message
		if json.Unmarshal(body, &m) != nil {
			continue
		}
		if m.Method == "exit" {
			return nil
		}
		s.handle(m)
	}
}

func (s *server) send(m message) {
	m.JSONRPC = "2.0"
	body, _ := json.Marshal(m)
	s.mu.Lock()
	defer s.mu.Unlock()
	fmt.Fprintf(s.out, "Content-Length: %d\r\n\r\n%s", len(body), body)
	s.out.Flush()
}

func (s *server) reply(id *json.RawMessage, result any) {
	if id == nil {
		return
	}
	if result == nil {
		result = json.RawMessage("null")
	}
	s.send(message{ID: id, Result: result})
}

type position struct {
	Line      int `json:"line"`
	Character int `json:"character"`
}

type lspRange struct {
	Start position `json:"start"`
	End   position `json:"end"`
}

type textDocument struct {
	URI  string `json:"uri"`
	Text string `json:"text"`
}

func (s *server) handle(m message) {
	switch m.Method {
	case "initialize":
		s.reply(m.ID, map[string]any{
			"capabilities": map[string]any{
				"textDocumentSync":   map[string]any{"openClose": true, "change": 1, "save": true},
				"hoverProvider":      true,
				"completionProvider": map[string]any{"triggerCharacters": []string{".", "(", ",", " "}},
			},
			"serverInfo": map[string]any{"name": "flux", "version": version},
		})
	case "shutdown":
		s.reply(m.ID, nil)
	case "textDocument/didOpen", "textDocument/didChange", "textDocument/didSave", "textDocument/didClose":
		var p struct {
			TextDocument   textDocument `json:"textDocument"`
			ContentChanges []struct {
				Text string `json:"text"`
			} `json:"contentChanges"`
		}
		json.Unmarshal(m.Params, &p)
		path := pathOf(p.TextDocument.URI)
		if path == "" {
			return
		}
		s.mu.Lock()
		switch m.Method {
		case "textDocument/didOpen":
			s.open[path] = p.TextDocument.Text
		case "textDocument/didChange":
			if n := len(p.ContentChanges); n > 0 {
				s.open[path] = p.ContentChanges[n-1].Text
			}
		case "textDocument/didClose":
			delete(s.open, path)
		}
		s.mu.Unlock()
		s.schedule(path)
	case "textDocument/hover":
		s.reply(m.ID, s.hover(m.Params))
	case "textDocument/completion":
		s.reply(m.ID, s.complete(m.Params))
	default:
		if m.ID != nil && m.Method != "" {
			s.send(message{ID: m.ID, Error: map[string]any{"code": -32601, "message": "not supported: " + m.Method}})
		}
	}
}

// schedule checks path's project once typing pauses.
func (s *server) schedule(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.pending == nil {
		s.pending = map[string]bool{}
	}
	s.pending[path] = true
	if s.timer != nil {
		s.timer.Stop()
	}
	s.timer = time.AfterFunc(250*time.Millisecond, s.flush)
}

func (s *server) flush() {
	s.mu.Lock()
	paths := s.pending
	s.pending = nil
	overlay := project.Overlay{}
	for path, text := range s.open {
		overlay[path] = text
	}
	s.mu.Unlock()
	done := map[string]bool{}
	for path := range paths {
		root, err := project.Find(filepath.Dir(path))
		if err != nil {
			s.checkLone(path, overlay)
			continue
		}
		if done[root] {
			continue
		}
		done[root] = true
		s.checkProject(root, overlay)
	}
}

// checkProject publishes every file's diagnostics, and clears those fixed.
func (s *server) checkProject(root string, overlay project.Overlay) {
	loaded, err := project.LoadWith(root, overlay)
	byURI := map[string][]map[string]any{}
	if err != nil {
		uri := uriOf(filepath.Join(root, project.ConfigFile))
		byURI[uri] = append(byURI[uri], lspDiagnostic("", 0, 0, "error", err.Error()))
	} else {
		for _, f := range loaded.Files {
			byURI[uriOf(filepath.Join(root, filepath.FromSlash(f.Path)))] = nil
		}
		for _, d := range diagnose(loaded) {
			file := filepath.Join(root, project.ConfigFile)
			source := ""
			if d.File != "" {
				file = filepath.Join(root, filepath.FromSlash(d.File))
				for _, f := range loaded.Files {
					if f.Path == d.File {
						source = f.Source
					}
				}
			}
			uri := uriOf(file)
			byURI[uri] = append(byURI[uri], lspDiagnostic(source, d.From, d.To, d.Severity, d.Message))
		}
	}
	s.publish(root, byURI)
}

// checkLone checks a .flx outside any project as a project of its own: a
// Page as its one page, anything else as its one component.
func (s *server) checkLone(path string, overlay project.Overlay) {
	source, ok := overlay[path]
	if !ok {
		raw, err := os.ReadFile(path)
		if err != nil {
			return
		}
		source = string(raw)
	}
	dir, err := os.MkdirTemp("", "flux-lsp-")
	if err != nil {
		return
	}
	defer os.RemoveAll(dir)
	rel := "main" + project.Ext
	if strings.HasPrefix(strings.TrimSpace(source), "Page(") {
		rel = "pages/page" + project.Ext
		os.Mkdir(filepath.Join(dir, "pages"), 0o755)
	}
	os.WriteFile(filepath.Join(dir, project.ConfigFile), []byte(`{"name":"file"}`), 0o644)
	os.WriteFile(filepath.Join(dir, filepath.FromSlash(rel)), []byte(source), 0o644)
	var list []map[string]any
	if loaded, err := project.Load(dir); err == nil {
		for _, d := range diagnose(loaded) {
			if d.File == rel {
				list = append(list, lspDiagnostic(source, d.From, d.To, d.Severity, d.Message))
			}
		}
	}
	s.publish(path, map[string][]map[string]any{uriOf(path): list})
}

func (s *server) publish(scope string, byURI map[string][]map[string]any) {
	scopeURI := uriOf(scope)
	s.mu.Lock()
	var cleared []string
	for uri := range s.published {
		if strings.HasPrefix(uri, scopeURI) {
			if _, still := byURI[uri]; !still {
				cleared = append(cleared, uri)
			}
		}
	}
	s.mu.Unlock()
	for _, uri := range cleared {
		byURI[uri] = nil
	}
	uris := make([]string, 0, len(byURI))
	for uri := range byURI {
		uris = append(uris, uri)
	}
	sort.Strings(uris)
	for _, uri := range uris {
		list := byURI[uri]
		if list == nil {
			list = []map[string]any{}
		}
		s.send(message{Method: "textDocument/publishDiagnostics", Params: mustJSON(map[string]any{"uri": uri, "diagnostics": list})})
		s.mu.Lock()
		if len(list) > 0 {
			s.published[uri] = true
		} else {
			delete(s.published, uri)
		}
		s.mu.Unlock()
	}
}

func mustJSON(v any) json.RawMessage {
	raw, _ := json.Marshal(v)
	return raw
}

func lspDiagnostic(source string, from, to int, severity, text string) map[string]any {
	level := map[string]int{"error": 1, "warning": 2, "info": 3}[severity]
	if level == 0 {
		level = 1
	}
	return map[string]any{
		"range":    lspRange{lspPosition(source, from), lspPosition(source, max(to, from))},
		"severity": level,
		"source":   "flux",
		"message":  text,
	}
}

// lspPosition is a UTF-16 offset as a 0-based line and UTF-16 character.
func lspPosition(source string, offset int) position {
	line, char, units := 0, 0, 0
	for _, r := range source {
		if units >= offset {
			break
		}
		w := 1
		if r >= 0x10000 {
			w = 2
		}
		if r == '\n' {
			line, char = line+1, 0
		} else {
			char += w
		}
		units += w
	}
	return position{line, char}
}

func pathOf(uri string) string {
	u, err := url.Parse(uri)
	if err != nil || u.Scheme != "file" {
		return ""
	}
	path := u.Path
	if runtime.GOOS == "windows" {
		path = strings.TrimPrefix(path, "/")
	}
	abs, err := filepath.Abs(filepath.FromSlash(path))
	if err != nil {
		return ""
	}
	return abs
}

func uriOf(path string) string {
	slashed := filepath.ToSlash(path)
	if !strings.HasPrefix(slashed, "/") {
		slashed = "/" + slashed
	}
	return (&url.URL{Scheme: "file", Path: slashed}).String()
}

// --- hover and completion --------------------------------------------------

type documentPosition struct {
	TextDocument textDocument `json:"textDocument"`
	Position     position     `json:"position"`
}

func (s *server) textAt(params json.RawMessage) (string, int, bool) {
	var p documentPosition
	if json.Unmarshal(params, &p) != nil {
		return "", 0, false
	}
	path := pathOf(p.TextDocument.URI)
	s.mu.Lock()
	text, ok := s.open[path]
	s.mu.Unlock()
	if !ok {
		return "", 0, false
	}
	return text, unitsToByte(text, project.Offset(text, p.Position.Line, p.Position.Character)), true
}

// unitsToByte is a UTF-16 offset as a byte index.
func unitsToByte(text string, units int) int {
	u := 0
	for i, r := range text {
		if u >= units {
			return i
		}
		if r >= 0x10000 {
			u += 2
		} else {
			u++
		}
	}
	return len(text)
}

func isName(b byte) bool {
	return b == '_' || b == '.' || (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9')
}

// signature is an entry as it's called: Text(child, size, …), required ones marked.
func signature(e *registry.Entry) string {
	required := map[string]bool{}
	for _, r := range e.Required {
		required[r] = true
	}
	var params []string
	for _, p := range e.Params {
		mark := ""
		if required[p.Name] {
			mark = " (required)"
		}
		params = append(params, "  "+p.Name+": "+p.Type+mark)
	}
	if len(params) == 0 {
		return e.Name + "()"
	}
	return e.Name + "(\n" + strings.Join(params, ",\n") + ",\n)"
}

func lookup(name string) *registry.Entry {
	if e := registry.Constructors[name]; e != nil {
		return e
	}
	return registry.Functions[name]
}

func (s *server) hover(params json.RawMessage) any {
	text, at, ok := s.textAt(params)
	if !ok {
		return nil
	}
	from, to := at, at
	for from > 0 && isName(text[from-1]) {
		from--
	}
	for to < len(text) && isName(text[to]) {
		to++
	}
	word := text[from:to]
	if word == "" {
		return nil
	}
	var body string
	if e := lookup(word); e != nil {
		body = "```flux\n" + signature(e) + "\n```\n" + e.Group
	} else if family, member, ok := strings.Cut(word, "."); ok && registry.InFamily(family, member) {
		body = "`" + word + "`: one of " + family + ": " + strings.Join(registry.TokenFamilies[family], ", ")
	} else if values, ok := registry.TokenFamilies[word]; ok {
		body = "`" + word + "`: " + strings.Join(values, ", ")
	}
	if body == "" {
		return nil
	}
	return map[string]any{"contents": map[string]any{"kind": "markdown", "value": body}}
}

// enclosingCall is the name of the call whose parentheses the cursor is in.
func enclosingCall(text string, at int) string {
	depth := 0
	for i := at - 1; i >= 0; i-- {
		switch text[i] {
		case ')', ']':
			depth++
		case '[':
			if depth == 0 {
				return ""
			}
			depth--
		case '(':
			if depth > 0 {
				depth--
				continue
			}
			end := i
			for end > 0 && text[end-1] == ' ' {
				end--
			}
			start := end
			for start > 0 && isName(text[start-1]) {
				start--
			}
			return text[start:end]
		case '"':
			// Skip a string literal backwards.
			for i--; i >= 0 && text[i] != '"'; i-- {
			}
		}
	}
	return ""
}

func (s *server) complete(params json.RawMessage) any {
	text, at, ok := s.textAt(params)
	if !ok {
		return []any{}
	}
	from := at
	for from > 0 && isName(text[from-1]) {
		from--
	}
	typed := text[from:at]
	var items []map[string]any
	// Family.member: a token.
	if family, partial, dotted := strings.Cut(typed, "."); dotted {
		for _, value := range registry.TokenFamilies[family] {
			if strings.HasPrefix(value, partial) {
				items = append(items, map[string]any{"label": value, "kind": 20, "detail": family})
			}
		}
		for name, e := range registry.Constructors {
			if strings.HasPrefix(name, family+"."+partial) {
				items = append(items, map[string]any{"label": strings.TrimPrefix(name, family+"."), "kind": 3, "detail": e.Group, "insertText": strings.TrimPrefix(name, family+".") + "($1)", "insertTextFormat": 2})
			}
		}
		return items
	}
	// A parameter of the call the cursor is in.
	if call := lookup(enclosingCall(text, from)); call != nil {
		before := strings.TrimRight(text[:from], " \t\r\n")
		if strings.HasSuffix(before, "(") || strings.HasSuffix(before, ",") {
			required := map[string]bool{}
			for _, r := range call.Required {
				required[r] = true
			}
			for i, p := range call.Params {
				sort := fmt.Sprintf("1%03d", i)
				if required[p.Name] {
					sort = fmt.Sprintf("0%03d", i)
				}
				items = append(items, map[string]any{"label": p.Name, "kind": 5, "detail": p.Type, "insertText": p.Name + ": ", "sortText": sort})
			}
		}
	}
	// A widget, an action or a function.
	for name, e := range registry.Constructors {
		if strings.Contains(name, ".") || (typed != "" && !strings.HasPrefix(name, typed)) {
			continue
		}
		items = append(items, map[string]any{"label": name, "kind": 7, "detail": e.Group, "insertText": name + "($1)", "insertTextFormat": 2, "sortText": "2" + name})
	}
	for name, e := range registry.Functions {
		if typed != "" && !strings.HasPrefix(name, typed) {
			continue
		}
		items = append(items, map[string]any{"label": name, "kind": 3, "detail": e.Group, "insertText": name + "($1)", "insertTextFormat": 2, "sortText": "3" + name})
	}
	for family := range registry.TokenFamilies {
		if typed != "" && !strings.HasPrefix(family, typed) {
			continue
		}
		items = append(items, map[string]any{"label": family, "kind": 13, "detail": "tokens", "sortText": "4" + family})
	}
	return items
}
