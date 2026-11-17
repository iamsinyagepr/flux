package dart

import (
	"regexp"
	"strings"

	"github.com/iamsinyagepr/flux/js"
)

// Format lays out generated Dart the way `dart format` would for the shapes
// the compiler emits: a bracket group stays on one line when it fits in 80
// columns, otherwise its items go one per line with a trailing comma, and
// blocks get one statement per line. A port of upskaleapp's dartFormat.ts;
// widths count UTF-16 units, as JS string lengths do.
func Format(source string) string {
	tokens := tokenize(js.Units(source))
	out := &writer{}
	topLevel(out, parseNodes(tokens))
	return out.b.String()
}

const width = 80
const indentUnit = "  "

func indent(depth int) string { return strings.Repeat(indentUnit, depth) }

type tokenKind uint8

const (
	atom tokenKind = iota
	str
	comment
	open
	closeTok
	comma
	semi
)

type token struct {
	kind  tokenKind
	text  string
	size  int // UTF-16 length of text
	space bool
}

// node is a token, or a bracket group (open, items, close).
type node struct {
	tok   *token
	group *group
}

type group struct {
	open, close *token
	items       []node
}

func (n node) isGroup() bool { return n.group != nil }

func first(n node) *token {
	if n.group != nil {
		return n.group.open
	}
	return n.tok
}

func stringEnd(src []uint16, i int) int {
	start := i
	if src[start] == 'r' {
		start++
	}
	quote := src[start]
	triple := start+2 < len(src) && src[start+1] == quote && src[start+2] == quote
	closingLen := 1
	if triple {
		closingLen = 3
	}
	raw := start != i
	closes := func(j int) bool {
		if j+closingLen > len(src) {
			return false
		}
		for k := 0; k < closingLen; k++ {
			if src[j+k] != quote {
				return false
			}
		}
		return true
	}
	j := start + closingLen
	for j < len(src) {
		if !raw && src[j] == '\\' {
			j += 2
			continue
		}
		if closes(j) {
			return j + closingLen
		}
		if !raw && src[j] == '$' && j+1 < len(src) && src[j+1] == '{' {
			depth := 0
			j++
			for j < len(src) {
				c := src[j]
				if c == '\'' || c == '"' {
					j = stringEnd(src, j)
					continue
				}
				if c == '{' {
					depth++
				} else if c == '}' {
					depth--
					if depth == 0 {
						j++
						break
					}
				}
				j++
			}
			continue
		}
		if !triple && src[j] == '\n' {
			return j
		}
		j++
	}
	return j
}

func tokenize(src []uint16) []*token {
	var tokens []*token
	i, space := 0, false
	push := func(kind tokenKind, end int) {
		if end > len(src) {
			end = len(src)
		}
		tokens = append(tokens, &token{kind: kind, text: js.FromUnits(src[i:end]), size: end - i, space: space})
		space = false
		i = end
	}
	startsWith := func(s string, at int) bool {
		if at+len(s) > len(src) {
			return false
		}
		for k := 0; k < len(s); k++ {
			if src[at+k] != uint16(s[k]) {
				return false
			}
		}
		return true
	}
	indexOf := func(s string, from int) int {
		for k := from; k+len(s) <= len(src); k++ {
			if startsWith(s, k) {
				return k
			}
		}
		return -1
	}
	breaksAtom := func(c uint16) bool {
		return js.IsSpace(c) || strings.ContainsRune("()[]{},;'\"", rune(c)) && c < 0x80
	}
	for i < len(src) {
		c := src[i]
		switch {
		case js.IsSpace(c):
			space = true
			i++
		case startsWith("//", i):
			end := indexOf("\n", i)
			if end < 0 {
				end = len(src)
			}
			push(comment, end)
		case startsWith("/*", i):
			end := indexOf("*/", i+2)
			if end < 0 {
				end = len(src)
			} else {
				end += 2
			}
			push(comment, end)
		case c == '\'' || c == '"' ||
			(c == 'r' && i+1 < len(src) && (src[i+1] == '\'' || src[i+1] == '"') &&
				!(i > 0 && (js.IsWord(src[i-1]) || src[i-1] == '$'))):
			push(str, stringEnd(src, i))
		case c == '(' || c == '[' || c == '{':
			push(open, i+1)
		case c == ')' || c == ']' || c == '}':
			push(closeTok, i+1)
		case c == ',':
			push(comma, i+1)
		case c == ';':
			push(semi, i+1)
		default:
			j := i + 1
			for j < len(src) && !breaksAtom(src[j]) && !startsWith("//", j) && !startsWith("/*", j) {
				j++
			}
			push(atom, j)
		}
	}
	return tokens
}

func parseNodes(tokens []*token) []node {
	i := 0
	var sequence func(closing bool) []node
	sequence = func(closing bool) []node {
		var nodes []node
		for i < len(tokens) {
			t := tokens[i]
			if t.kind == closeTok {
				if closing {
					return nodes
				}
				nodes = append(nodes, node{tok: t}) // unbalanced: keep it as text
				i++
				continue
			}
			i++
			if t.kind == open {
				items := sequence(true)
				if i < len(tokens) && tokens[i].kind == closeTok {
					end := tokens[i]
					i++
					nodes = append(nodes, node{group: &group{open: t, items: items, close: end}})
				} else {
					nodes = append(nodes, node{tok: t})
					nodes = append(nodes, items...)
				}
			} else {
				nodes = append(nodes, node{tok: t})
			}
		}
		return nodes
	}
	return sequence(false)
}

func hasComment(nodes []node) bool {
	for _, n := range nodes {
		if n.isGroup() {
			if hasComment(n.group.items) {
				return true
			}
		} else if n.tok.kind == comment {
			return true
		}
	}
	return false
}

var caseLabel = regexp.MustCompile(`^(case|default:?)$`)

func isBlock(g *group) bool {
	if g.open.text != "{" {
		return false
	}
	for _, n := range g.items {
		if !n.isGroup() && (n.tok.kind == semi || (n.tok.kind == atom && caseLabel.MatchString(n.tok.text))) {
			return true
		}
		if n.isGroup() && isBlock(n.group) {
			return true
		}
	}
	return false
}

var headerWord = regexp.MustCompile(`^(if|for|switch|while|catch|await\s+for)$`)

func isHeader(previous *node) bool {
	return previous != nil && !previous.isGroup() && previous.tok.kind == atom && headerWord.MatchString(previous.tok.text)
}

func spaced(previous *node, n node) bool {
	if previous == nil {
		return false
	}
	t := first(n)
	before := previous.tok
	if previous.isGroup() {
		before = previous.group.close
	}
	switch {
	case t.kind == comma || t.kind == semi || t.kind == closeTok:
		return false
	case before.kind == open:
		return false
	case before.kind == comma || before.kind == semi || before.kind == comment:
		return true
	case t.kind == open && t.text != "{" && !t.space:
		return false
	}
	return t.space
}

func at(nodes []node, i int) *node {
	if i < 0 || i >= len(nodes) {
		return nil
	}
	return &nodes[i]
}

func flat(nodes []node) string {
	var b strings.Builder
	flatInto(&b, nodes)
	return b.String()
}

func flatInto(b *strings.Builder, nodes []node) {
	for i, n := range nodes {
		if spaced(at(nodes, i-1), n) {
			b.WriteByte(' ')
		}
		if n.isGroup() {
			b.WriteString(n.group.open.text)
			flatInto(b, n.group.items)
			b.WriteString(n.group.close.text)
		} else {
			b.WriteString(n.tok.text)
		}
	}
}

// flatLen is js.Len(flat(nodes)) without building the string.
func flatLen(nodes []node) int {
	n := 0
	for i, nd := range nodes {
		if spaced(at(nodes, i-1), nd) {
			n++
		}
		if nd.isGroup() {
			n += nd.group.open.size + flatLen(nd.group.items) + nd.group.close.size
		} else {
			n += nd.tok.size
		}
	}
	return n
}

func groupLen(g *group) int { return g.open.size + flatLen(g.items) + g.close.size }

func isWordByte(c byte) bool {
	return c == '_' || (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isLetterOrUnderscore(c byte) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func splitCommas(nodes []node) [][]node {
	items := [][]node{{}}
	angle := 0
	for _, n := range nodes {
		if !n.isGroup() && n.tok.kind == atom {
			text := n.tok.text
			for k := 0; k < len(text); k++ {
				var prev, next byte
				if k > 0 {
					prev = text[k-1]
				}
				if k+1 < len(text) {
					next = text[k+1]
				}
				if text[k] == '<' && k > 0 && isWordByte(prev) && k+1 < len(text) && isLetterOrUnderscore(next) {
					angle++
				} else if text[k] == '>' && angle > 0 && prev != '=' && next != '=' {
					angle--
				}
			}
		}
		if !n.isGroup() && n.tok.kind == comma && angle == 0 {
			items = append(items, []node{})
		} else {
			items[len(items)-1] = append(items[len(items)-1], n)
		}
	}
	var out [][]node
	for _, item := range items {
		if len(item) > 0 {
			out = append(out, item)
		}
	}
	return out
}

var (
	annotation   = regexp.MustCompile(`^@\w+$`)
	caseStart    = regexp.MustCompile(`^(case|default)`)
	continuation = regexp.MustCompile(`^(\.|else\b|catch\b|finally\b|on\b|while\b|\)|\?\?)`)
)

func splitStatements(nodes []node) [][]node {
	var statements [][]node
	var current []node
	end := func() {
		if len(current) > 0 {
			statements = append(statements, current)
		}
		current = nil
	}
	for i, n := range nodes {
		next := at(nodes, i+1)
		if !n.isGroup() && n.tok.kind == comment {
			end()
			statements = append(statements, []node{n})
			continue
		}
		current = append(current, n)
		var t *token
		if !n.isGroup() {
			t = n.tok
		}
		if t != nil && t.kind == semi {
			end()
			continue
		}
		if len(current) == 1 && t != nil && t.kind == atom && annotation.MatchString(t.text) &&
			!(next != nil && next.isGroup() && next.group.open.text == "(" && !next.group.open.space) {
			end()
			continue
		}
		leading := first(current[0])
		if t != nil && t.kind == atom && leading.kind == atom && caseStart.MatchString(leading.text) &&
			strings.HasSuffix(t.text, ":") && !(next != nil && next.isGroup() && isBlock(next.group)) {
			end()
			continue
		}
		if n.isGroup() && isBlock(n.group) {
			continues := false
			if next != nil {
				after := first(*next)
				continues = after.kind == closeTok || after.kind == comma || after.kind == semi ||
					(after.kind == atom && continuation.MatchString(after.tok()))
			}
			if !continues {
				end()
			}
		}
	}
	end()
	return statements
}

func (t *token) tok() string { return t.text }

type writer struct {
	b      strings.Builder
	column int
}

func (w *writer) write(text string) {
	w.b.WriteString(text)
	if i := strings.LastIndexByte(text, '\n'); i >= 0 {
		w.column = js.Len(text[i+1:])
	} else {
		w.column += js.Len(text)
	}
}

func (w *writer) token(t *token)  { w.write(t.text) }
func (w *writer) raw(text string) { w.write(text) }

func atomIndex(nodes []node, text string) int {
	for i, n := range nodes {
		if !n.isGroup() && n.tok.kind == atom && n.tok.text == text {
			return i
		}
	}
	return -1
}

func writeConditional(out *writer, nodes []node, depth int) bool {
	question, colon := atomIndex(nodes, "?"), atomIndex(nodes, ":")
	if question <= 0 || colon <= question+1 || colon >= len(nodes)-1 {
		return false
	}
	cont := "\n" + indent(depth+2)
	writeSequence(out, nodes[:question], depth, 0)
	out.raw(cont)
	writeSequence(out, nodes[question:colon], depth+2, 0)
	out.raw(cont)
	writeSequence(out, nodes[colon:], depth+2, 0)
	return true
}

var classClause = regexp.MustCompile(`^(extends|implements|with)$`)

func writeStatement(out *writer, statement []node, depth int) {
	body := -1
	for i, n := range statement {
		if n.isGroup() && isBlock(n.group) {
			body = i
			break
		}
	}
	line := statement
	if body >= 0 {
		line = statement[:body+1]
	}
	overflow := out.column + flatLen(line)
	if body >= 0 {
		overflow -= flatLen(statement[body:body+1]) - 1
	}
	if overflow > width {
		clause := -1
		for i, n := range statement {
			if i > 0 && !n.isGroup() && n.tok.kind == atom && classClause.MatchString(n.tok.text) {
				clause = i
				break
			}
		}
		if clause > 0 && first(statement[0]).text == "class" {
			writeSequence(out, statement[:clause], depth, 0)
			out.raw("\n" + indent(depth+2))
			writeSequence(out, statement[clause:], depth, 0)
			return
		}
		if writeConditional(out, statement, depth) {
			return
		}
		last := -1
		for i, n := range statement {
			if n.isGroup() && len(n.group.items) > 0 {
				last = i
			}
		}
		if last >= 0 {
			g := statement[last].group
			opening := flatLen(append(append([]node{}, statement[:last]...), node{tok: g.open}))
			breakable := isBlock(g) || groupLen(g) > 24 || anyGroup(g.items)
			if breakable && out.column+opening <= width {
				writeSequence(out, statement, depth, 0)
				return
			}
		}
		for _, arrow := range []string{"=>", "="} {
			i := atomIndex(statement, arrow)
			if i > 0 && i < len(statement)-1 {
				head, rest := statement[:i+1], statement[i+1:]
				if out.column+flatLen(head) <= width {
					writeSequence(out, head, depth, 0)
					out.raw("\n" + indent(depth+2))
					writeSequence(out, rest, depth+2, 0)
					return
				}
				break
			}
		}
	}
	writeSequence(out, statement, depth, 0)
}

func anyGroup(nodes []node) bool {
	for _, n := range nodes {
		if n.isGroup() {
			return true
		}
	}
	return false
}

func writeSequence(out *writer, nodes []node, depth, reserve int) {
	for i := range nodes {
		n, previous := nodes[i], at(nodes, i-1)
		if previous != nil && previous.isGroup() && isHeader(at(nodes, i-2)) &&
			!(n.isGroup() && isBlock(n.group)) &&
			out.column+1+flatLen(nodes[i:])+reserve > width {
			out.raw("\n" + indent(depth+1))
			writeSequence(out, nodes[i:], depth+1, reserve)
			return
		}
		writeNode(out, nodes, i, depth, reserve)
	}
}

func writeNode(out *writer, nodes []node, index, depth, reserve int) {
	n, previous := nodes[index], at(nodes, index-1)
	if previous != nil && !previous.isGroup() && previous.tok.kind == comment {
		out.raw("\n" + indent(depth))
	} else if spaced(previous, n) {
		out.raw(" ")
	}
	if !n.isGroup() {
		out.token(n.tok)
		return
	}
	next := index + 1
	for next < len(nodes) && !nodes[next].isGroup() {
		next++
	}
	after := flatLen(nodes[index:next]) - groupLen(n.group)
	if next == len(nodes) {
		after += reserve
	}
	writeGroup(out, n.group, depth, isHeader(previous), after, isCall(previous, n.group))
}

func writeFlatGroup(out *writer, g *group) {
	out.token(g.open)
	for i, n := range g.items {
		if spaced(at(g.items, i-1), n) {
			out.raw(" ")
		}
		if n.isGroup() {
			writeFlatGroup(out, n.group)
		} else {
			out.token(n.tok)
		}
	}
	out.token(g.close)
}

var (
	calleeEnd     = regexp.MustCompile(`[\w$]$`)
	typeArgsEnd   = regexp.MustCompile(`[\w$>]>$`)
	arrowEnd      = regexp.MustCompile(`[=-]>$`)
	notCalleeWord = regexp.MustCompile(`^(return|await|yield|throw|in|is|as|case|else|new|const|final|var)$`)
)

// isCall: is this `(` an argument list straight after a callee, rather than
// a grouping parenthesis? Only argument lists may take a trailing comma.
func isCall(previous *node, g *group) bool {
	if g.open.text != "(" {
		return true
	}
	if previous == nil || g.open.space {
		return false
	}
	if previous.isGroup() {
		return true
	}
	if previous.tok.kind == closeTok {
		return true
	}
	if previous.tok.kind != atom {
		return false
	}
	text := previous.tok.text
	callee := calleeEnd.MatchString(text) || (typeArgsEnd.MatchString(text) && !arrowEnd.MatchString(text))
	return callee && !notCalleeWord.MatchString(text)
}

func writeGroup(out *writer, g *group, depth int, header bool, reserve int, call bool) {
	block := isBlock(g)
	forced := block || hasComment(g.items)
	length := groupLen(g)
	if len(g.items) == 0 || header ||
		(!forced && out.column+length+reserve <= width) ||
		(!forced && length <= 24 && !anyGroup(g.items)) {
		writeFlatGroup(out, g)
		return
	}
	if !call && !block {
		out.token(g.open)
		inner := indent(depth + 1)
		if js.Len(inner)+flatLen(g.items) <= width {
			out.raw("\n" + inner)
			writeSequence(out, g.items, depth+1, 0)
			out.raw("\n" + indent(depth))
		} else if !writeConditional(out, g.items, depth) {
			writeSequence(out, g.items, depth, reserve+1)
		}
		out.token(g.close)
		return
	}
	inner := indent(depth + 1)
	out.token(g.open)
	if block {
		for i, statement := range splitStatements(g.items) {
			lead := first(statement[0])
			if i > 0 && lead.kind == atom && strings.HasPrefix(lead.text, "@") {
				out.raw("\n")
			}
			out.raw("\n" + inner)
			writeStatement(out, statement, depth+1)
		}
	} else {
		items := splitCommas(g.items)
		if len(items) == 1 && len(items[0]) == 1 && items[0][0].isGroup() && !hasTopComma(g.items) {
			only := items[0][0].group
			writeGroup(out, only, depth, false, reserve+1, isCall(nil, only))
			out.token(g.close)
			return
		}
		for _, item := range items {
			out.raw("\n" + inner)
			if !(out.column+flatLen(item) > width && writeConditional(out, item, depth+1)) {
				writeSequence(out, item, depth+1, 1)
			}
			last := item[len(item)-1]
			if !(!last.isGroup() && last.tok.kind == comment) {
				out.raw(",")
			}
		}
	}
	out.raw("\n" + indent(depth))
	out.token(g.close)
}

// hasTopComma: some direct item is a comma token.
func hasTopComma(nodes []node) bool {
	for _, n := range nodes {
		if !n.isGroup() && n.tok.kind == comma {
			return true
		}
	}
	return false
}

var directive = regexp.MustCompile(`^(import|export|part|library)$`)

func topLevel(out *writer, nodes []node) {
	statements := splitStatements(nodes)
	isDirective := func(s []node) bool {
		lead := first(s[0])
		return lead.kind == atom && directive.MatchString(lead.text)
	}
	isComment := func(s []node) bool { return first(s[0]).kind == comment }
	for i, statement := range statements {
		if i > 0 {
			previous := statements[i-1]
			together := (isDirective(previous) && isDirective(statement)) ||
				(isComment(previous) && !isDirective(statement) && i > 1) ||
				(isComment(previous) && isDirective(statement))
			if together {
				out.raw("\n")
			} else {
				out.raw("\n\n")
			}
		}
		writeStatement(out, statement, 0)
	}
	out.raw("\n")
}
