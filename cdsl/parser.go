package cdsl

import (
	"strconv"
	"strings"

	"github.com/iamsinyagepr/flux/js"
)

// MaxSourceBytes is the size limit of one Flux file (UTF-8 bytes).
const MaxSourceBytes = 65_536

// TokenKind is the kind of a lexed token.
type TokenKind uint8

const (
	NameToken TokenKind = iota
	NumberToken
	StringToken
	SymbolToken
	EndToken
)

// Token is one lexed token; From and To are UTF-16 positions.
type Token struct {
	Kind     TokenKind
	Text     string
	From, To int
}

// SourceError is a syntax error at a UTF-16 range.
type SourceError struct {
	Message  string
	From, To int
}

func (e *SourceError) Error() string { return e.Message }

func fail(message string, from, to int) { panic(&SourceError{message, from, to}) }

// Diagnostic is one analysis finding.
type Diagnostic struct {
	Code     string `json:"code"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	From     int    `json:"from"`
	To       int    `json:"to"`
}

func isNameStart(c uint16) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isDigit(c uint16) bool { return c >= '0' && c <= '9' }

// Lex tokenises source; offset shifts every position (for interpolations).
func Lex(source string, offset int) (tokens []Token, err error) {
	defer func() {
		if r := recover(); r != nil {
			if se, ok := r.(*SourceError); ok {
				err = se
				return
			}
			panic(r)
		}
	}()
	return lex(js.Units(source), offset), nil
}

func lex(src []uint16, offset int) []Token {
	var tokens []Token
	p := 0
	at := func(i int) uint16 {
		if i < len(src) && i >= 0 {
			return src[i]
		}
		return 0
	}
	startsWith := func(s string, i int) bool {
		if i+len(s) > len(src) {
			return false
		}
		for k := 0; k < len(s); k++ {
			if src[i+k] != uint16(s[k]) {
				return false
			}
		}
		return true
	}
	add := func(kind TokenKind, start int) {
		tokens = append(tokens, Token{Kind: kind, Text: js.FromUnits(src[start:p]), From: start + offset, To: p + offset})
	}
	interpolation := func() {
		depth := 1
		for p < len(src) && depth > 0 {
			c := src[p]
			p++
			if c == '"' {
				for p < len(src) {
					q := src[p]
					p++
					if q == '\\' {
						p++
						continue
					}
					if q == '"' {
						break
					}
				}
			} else if c == '{' {
				depth++
			} else if c == '}' {
				depth--
			}
		}
		if depth > 0 {
			fail("Unclosed string interpolation.", offset+p-1, offset+p)
		}
	}
	for p < len(src) {
		start, c := p, src[p]
		if js.IsSpace(c) {
			p++
			continue
		}
		if startsWith("//", p) {
			for p < len(src) && src[p] != '\n' {
				p++
			}
			continue
		}
		if startsWith("/*", p) {
			end := -1
			for i := p + 2; i+1 < len(src); i++ {
				if src[i] == '*' && src[i+1] == '/' {
					end = i
					break
				}
			}
			if end < 0 {
				fail("Unclosed block comment.", start+offset, len(src)+offset)
			}
			p = end + 2
			continue
		}
		if isNameStart(c) {
			p++
			for p < len(src) && js.IsWord(src[p]) {
				p++
			}
			add(NameToken, start)
			continue
		}
		if isDigit(c) {
			p++
			for isDigit(at(p)) && p < len(src) {
				p++
			}
			if at(p) == '.' && p < len(src) && isDigit(at(p+1)) && p+1 < len(src) {
				p++
				for isDigit(at(p)) && p < len(src) {
					p++
				}
			}
			add(NumberToken, start)
			continue
		}
		if c == '"' {
			p++
			closed := false
			for p < len(src) {
				q := src[p]
				p++
				if q == '\\' {
					p++
					continue
				}
				if q == '"' {
					closed = true
					break
				}
				if q == '$' && at(p) == '{' && p < len(src) {
					p++
					interpolation()
				}
			}
			if !closed {
				fail("Unclosed string literal.", start+offset, len(src)+offset)
			}
			if p-start > 8000 {
				fail("String literal exceeds 2,000 characters.", start+offset, p+offset)
			}
			add(StringToken, start)
			continue
		}
		pair := ""
		if p+1 < len(src) {
			pair = js.FromUnits(src[p : p+2])
		}
		switch {
		case pair == "??" || pair == "||" || pair == "&&" || pair == "==" || pair == "!=" || pair == "<=" || pair == ">=":
			p += 2
		case strings.ContainsRune("()[],:.?+-*/%!<>", rune(c)) && c < 0x80:
			p++
		default:
			fail(`Unexpected character "`+js.FromUnits(src[p:p+1])+`".`, start+offset, start+offset+1)
		}
		add(SymbolToken, start)
		if len(tokens) > 20000 {
			fail("Source has too many tokens.", start+offset, p+offset)
		}
	}
	return append(tokens, Token{Kind: EndToken, From: p + offset, To: p + offset})
}

var precedence = map[string]int{
	"??": 1, "||": 2, "&&": 3, "==": 4, "!=": 4,
	"<": 5, "<=": 5, ">": 5, ">=": 5, "+": 6, "-": 6, "*": 7, "/": 7, "%": 7,
}

type parser struct {
	tokens []Token
	at     int
	depth  int
}

func (p *parser) peek() Token { return p.tokens[p.at] }

func (p *parser) take() Token {
	t := p.tokens[p.at]
	p.at++
	return t
}

func (p *parser) expect(text string) Token {
	t := p.take()
	if t.Text != text {
		found := `"` + t.Text + `"`
		if t.Kind == EndToken {
			found = "end of file"
		}
		fail(`Expected "`+text+`", found `+found+".", t.From, max(t.From+1, t.To))
	}
	return t
}

func (p *parser) accept(text string) bool {
	if p.peek().Text == text {
		p.take()
		return true
	}
	return false
}

func (p *parser) parse() *Expr {
	result := p.expression(0)
	if p.peek().Kind != EndToken {
		fail("Expected a single Component expression.", p.peek().From, p.peek().To)
	}
	return result
}

func (p *parser) expression(min int) *Expr {
	p.depth++
	if p.depth > 64 {
		fail("Maximum expression depth is 64.", p.peek().From, p.peek().To)
	}
	left := p.primary()
	for p.accept("[") {
		index := p.expression(0)
		end := p.expect("]")
		left = &Expr{Kind: Index, Target: left, IndexExpr: index, From: left.From, To: end.To}
	}
	for precedence[p.peek().Text] > min {
		op := p.take().Text
		right := p.expression(precedence[op])
		left = &Expr{Kind: Binary, Op: op, Left: left, Right: right, From: left.From, To: right.To}
	}
	if min == 0 && p.accept("?") {
		yes := p.expression(0)
		p.expect(":")
		no := p.expression(0)
		left = &Expr{Kind: Conditional, Condition: left, Yes: yes, No: no, From: left.From, To: no.To}
	}
	p.depth--
	return left
}

func (p *parser) primary() *Expr {
	token := p.take()
	if token.Text == "!" || token.Text == "-" {
		child := p.expression(8)
		return &Expr{Kind: Unary, Op: token.Text, Child: child, From: token.From, To: child.To}
	}
	if token.Text == "(" && token.Kind == SymbolToken {
		result := p.expression(0)
		p.expect(")")
		return result
	}
	if token.Text == "[" && token.Kind == SymbolToken {
		var items []*Expr
		for p.peek().Text != "]" {
			items = append(items, p.expression(0))
			if !p.accept(",") {
				break
			}
			if len(items) > 1000 {
				fail("List limit exceeded.", token.From, p.peek().To)
			}
		}
		end := p.expect("]")
		return &Expr{Kind: List, Items: items, From: token.From, To: end.To}
	}
	if token.Kind == NumberToken {
		n, _ := strconv.ParseFloat(token.Text, 64)
		return &Expr{Kind: Literal, Value: js.NumberValue(n), From: token.From, To: token.To}
	}
	if token.Text == "true" || token.Text == "false" || token.Text == "null" {
		value := js.NullValue()
		if token.Text != "null" {
			value = js.BoolValue(token.Text == "true")
		}
		return &Expr{Kind: Literal, Value: value, From: token.From, To: token.To}
	}
	if token.Kind == StringToken {
		return p.str(token)
	}
	if token.Kind == NameToken {
		name, end := token.Text, token.To
		for p.accept(".") {
			next := p.take()
			if next.Kind != NameToken {
				fail("Expected a name after the dot.", next.From, next.To)
			}
			name += "." + next.Text
			end = next.To
		}
		if !p.accept("(") {
			return &Expr{Kind: Ref, Name: name, From: token.From, To: end}
		}
		args := &Args{}
		var positional []*Expr
		constructor := name[0] >= 'A' && name[0] <= 'Z'
		for p.peek().Text != ")" {
			if constructor {
				key := p.take()
				if key.Kind != NameToken {
					fail("Constructors use named parameters.", key.From, key.To)
				}
				p.expect(":")
				if args.Has(key.Text) {
					fail("Duplicate parameter: "+key.Text, key.From, key.To)
				}
				args.set(key.Text, p.expression(0))
			} else {
				positional = append(positional, p.expression(0))
			}
			if !p.accept(",") {
				break
			}
		}
		close := p.expect(")")
		return &Expr{Kind: Call, Name: name, Args: args, Positional: positional, From: token.From, To: close.To}
	}
	fail("Expected a value or constructor.", token.From, max(token.To, token.From+1))
	return nil
}

func (p *parser) str(token Token) *Expr {
	all := js.Units(token.Text)
	raw := all[1 : len(all)-1]
	var segments []Segment
	var text []uint16
	hasExpr := false
	i := 0
	for i < len(raw) {
		c := raw[i]
		i++
		if c == '\\' {
			var next uint16
			if i < len(raw) {
				next = raw[i]
			}
			i++
			var escaped uint16
			switch next {
			case 'n':
				escaped = '\n'
			case 't':
				escaped = '\t'
			case '"', '\\', '$':
				escaped = next
			default:
				fail("Unsupported string escape.", token.From+i-1, token.From+i+1)
			}
			text = append(text, escaped)
			continue
		}
		if c == '$' && i < len(raw) && raw[i] == '{' {
			if len(text) > 0 {
				segments = append(segments, Segment{Text: js.FromUnits(text)})
				text = nil
			}
			i++
			start := i
			depth, quote, escape := 1, false, false
			for i < len(raw) && depth > 0 {
				q := raw[i]
				i++
				if escape {
					escape = false
					continue
				}
				if q == '\\' {
					escape = true
					continue
				}
				if q == '"' {
					quote = !quote
					continue
				}
				if !quote {
					if q == '{' {
						depth++
					}
					if q == '}' {
						depth--
					}
				}
			}
			if depth > 0 {
				fail("Unclosed interpolation.", token.From+start, token.To)
			}
			inner := &parser{tokens: lex(raw[start:i-1], token.From+1+start)}
			segments = append(segments, Segment{Expr: inner.parse()})
			hasExpr = true
			continue
		}
		text = append(text, c)
	}
	if len(text) > 0 || len(segments) == 0 {
		segments = append(segments, Segment{Text: js.FromUnits(text)})
	}
	var value strings.Builder
	length := 0
	for _, s := range segments {
		if s.Expr == nil {
			value.WriteString(s.Text)
			length += js.Len(s.Text)
		}
	}
	if length > 2000 {
		fail("String literal exceeds 2,000 characters.", token.From, token.To)
	}
	expr := &Expr{Kind: Literal, Value: js.StringValue(value.String()), From: token.From, To: token.To}
	if hasExpr {
		expr.Segments = segments
	}
	return expr
}

// Parsed is a parsed source: its root Component, or the syntax error.
type Parsed struct {
	Root        *Expr
	Diagnostics []Diagnostic
}

// ParseSource parses one Flux file, which must be a single Component(...).
func ParseSource(source string) (parsed Parsed) {
	length := js.Len(source)
	defer func() {
		if r := recover(); r != nil {
			issue, ok := r.(*SourceError)
			if !ok {
				issue = &SourceError{"Unable to parse this source.", 0, 1}
			}
			parsed = Parsed{Diagnostics: []Diagnostic{{
				Code: "syntax", Severity: "error", Message: issue.Message,
				From: issue.From, To: min(length, issue.To),
			}}}
		}
	}()
	if js.Bytes(source) > MaxSourceBytes {
		fail("Source exceeds 64 KB.", 0, length)
	}
	root := (&parser{tokens: lex(js.Units(source), 0)}).parseFile()
	// A page file is a Page; a component's, a Component (page.go).
	if root.Kind != Call || (root.Name != "Component" && root.Name != "Page") {
		fail("A file must contain one Component(...), or for a page, one Page(...).", root.From, root.To)
	}
	return Parsed{Root: root}
}

// ParseExpression parses one expression on its own (a page's SEO title,
// say), or reports why it can't be.
func ParseExpression(source string) (root *Expr, problem *Diagnostic) {
	length := js.Len(source)
	defer func() {
		if r := recover(); r != nil {
			issue, ok := r.(*SourceError)
			if !ok {
				issue = &SourceError{"Unable to parse this expression.", 0, 1}
			}
			root, problem = nil, &Diagnostic{Code: "syntax", Severity: "error", Message: issue.Message,
				From: issue.From, To: min(length, issue.To)}
		}
	}()
	if js.Bytes(source) > MaxSourceBytes {
		fail("Expression exceeds 64 KB.", 0, length)
	}
	return (&parser{tokens: lex(js.Units(source), 0)}).parse(), nil
}
