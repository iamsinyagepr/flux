package cdsl

import (
	"strings"

	"github.com/iamsinyagepr/flux/js"
)

// The block form of a file (upskaleapp's CDSL.md and parser.ts): its
// Page(...) or Component(...) call as a header, then blocks,
//
//	Page(name: "Dish", route: Route(...), seo: Seo(...))
//	usingServer(dish<Product>(src: Tenant.product(id: route.dish)))
//	usingClient(orders<Order[]>(src: Tenant.history()))
//	State(quantity: Number(default: 1))
//	Parts(price: Text(...))
//	Build(Column(...))
//
// read into the tree the single-call form has, every node made up for it
// placed where what it stands for is written, exactly as parser.ts places it.

var (
	pageBlocks      = []string{"usingServer", "usingClient", "State", "Parts", "Build"}
	componentBlocks = []string{"Options", "usingClient", "State", "Parts", "Build", "Variants"}
	blockFields     = map[string]string{
		"data": "usingServer", "states": "State", "parts": "Parts", "build": "Build", "options": "Options", "variants": "Variants",
	}
	blockStateTypes  = [][2]string{{"String", "StringState"}, {"Number", "NumberState"}, {"Bool", "BoolState"}}
	blockOptionTypes = [][2]string{
		{"String", "StringOption"}, {"Number", "NumberOption"}, {"Bool", "BoolOption"}, {"Color", "ColorOption"},
		{"Enum", "EnumOption"}, {"Slot", "ComponentOption"}, {"Action", "ActionOption"},
	}
)

func typeFor(types [][2]string, name string) (string, bool) {
	for _, t := range types {
		if t[0] == name {
			return t[1], true
		}
	}
	return "", false
}

func has(list []string, s string) bool {
	for _, item := range list {
		if item == s {
			return true
		}
	}
	return false
}

// parseFile is one call (the single-call form), or a header and its blocks.
func (p *parser) parseFile() *Expr {
	head := p.expression(0)
	if p.peek().Kind == EndToken {
		return head
	}
	if head.Kind != Call || (head.Name != "Page" && head.Name != "Component") {
		fail("A file must contain one Component(...), or for a page, one Page(...).", head.From, head.To)
	}
	return p.blocks(head)
}

func literal(value js.Value, from, to int) *Expr {
	return &Expr{Kind: Literal, Value: value, From: from, To: to}
}

func (p *parser) blocks(head *Expr) *Expr {
	page := head.Name == "Page"
	allowed := componentBlocks
	kind := "component"
	if page {
		allowed, kind = pageBlocks, "page"
	}
	for _, key := range head.Args.Keys() {
		if block, ok := blockFields[key]; ok {
			value := head.Args.Get(key)
			fail(key+" goes in its own block: "+block+"(...).", value.From, value.To)
		}
	}
	args := &Args{}
	for _, key := range head.Args.Keys() {
		args.set(key, head.Args.Get(key))
	}
	if !page && !args.Has("dsl") {
		args.set("dsl", literal(js.NumberValue(1), head.From, head.From))
	}
	var seen []string
	var data []*Expr
	dataFrom, dataTo, to := -1, -1, head.To
	for p.peek().Kind != EndToken {
		name := p.take()
		if name.Kind != NameToken || !has(allowed, name.Text) {
			fail("Expected a block of a "+kind+": "+strings.Join(allowed, ", ")+".", name.From, max(name.To, name.From+1))
		}
		if has(seen, name.Text) {
			fail("There's already a "+name.Text+"(...) block.", name.From, name.To)
		}
		other := map[string]string{"Build": "Variants", "Variants": "Build"}[name.Text]
		if other != "" && has(seen, other) {
			fail("A component draws one Build(...) or several Variants(...), not both.", name.From, name.To)
		}
		p.expect("(")
		var items []*Expr
		var build *Expr
		switch name.Text {
		case "usingServer", "usingClient":
			client := name.Text == "usingClient"
			items = p.entries(func() *Expr { return p.dataEntry(name, client) })
		case "Options":
			items = p.optionItems()
		case "State":
			items = p.entries(func() *Expr { return p.typedEntry(blockStateTypes, "State") })
		case "Parts":
			items = p.entries(p.partEntry)
		case "Variants":
			items = p.entries(p.variantEntry)
		case "Build":
			build = p.expression(0)
			p.accept(",")
		}
		close := p.expect(")")
		seen = append(seen, name.Text)
		to = close.To
		list := func() *Expr { return &Expr{Kind: List, Items: items, From: name.From, To: close.To} }
		switch name.Text {
		case "usingServer", "usingClient":
			data = append(data, items...)
			if dataFrom < 0 {
				dataFrom = name.From
			}
			dataTo = close.To
		case "Options":
			args.set("options", list())
		case "State":
			args.set("states", list())
		case "Parts":
			args.set("parts", list())
		case "Variants":
			args.set("variants", list())
		case "Build":
			if page {
				args.set("build", build)
			} else {
				variant := &Args{}
				variant.set("id", literal(js.StringValue("default"), name.From, name.To))
				variant.set("label", literal(js.StringValue("Default"), name.From, name.To))
				variant.set("build", build)
				items = []*Expr{{Kind: Call, Name: "Variant", Args: variant, From: name.From, To: close.To}}
				args.set("variants", list())
			}
		}
	}
	if dataFrom >= 0 {
		if data == nil {
			data = []*Expr{}
		}
		args.set("data", &Expr{Kind: List, Items: data, From: dataFrom, To: dataTo})
	}
	return &Expr{Kind: Call, Name: head.Name, Args: args, From: head.From, To: to}
}

// entries are a block's, comma separated, a trailing comma allowed.
func (p *parser) entries(entry func() *Expr) []*Expr {
	items := []*Expr{}
	for p.peek().Text != ")" && p.peek().Kind != EndToken {
		items = append(items, entry())
		if len(items) > 200 {
			fail("Too many entries in one block.", p.peek().From, p.peek().To)
		}
		if !p.accept(",") {
			break
		}
	}
	return items
}

func (p *parser) entryName() (Token, *Expr) {
	token := p.take()
	if token.Kind != NameToken {
		fail("Expected a name.", token.From, max(token.To, token.From+1))
	}
	return token, literal(js.StringValue(token.Text), token.From, token.To)
}

// typeAnnotation is <Store>, <Store[]> or <Page<Store>>.
func (p *parser) typeAnnotation() (*Expr, *Expr) {
	p.expect("<")
	name := p.take()
	if name.Kind != NameToken || name.Text == "" || name.Text[0] < 'A' || name.Text[0] > 'Z' {
		fail("Expected a type: Store, Product[], Json…", name.From, max(name.To, name.From+1))
	}
	text, end := name.Text, name.To
	if p.accept("<") {
		inner := p.take()
		if inner.Kind != NameToken {
			fail("Expected a type.", inner.From, max(inner.To, inner.From+1))
		}
		text += "<" + inner.Text + ">"
		end = p.expect(">").To
	}
	var list *Expr
	if p.peek().Text == "[" {
		open := p.take()
		close := p.expect("]")
		list = literal(js.BoolValue(true), open.From, close.To)
	}
	p.expect(">")
	return &Expr{Kind: Ref, Name: text, From: name.From, To: end}, list
}

// namedArgs are named arguments up to the closing parenthesis, which it takes.
func (p *parser) namedArgs(into *Args) Token {
	p.expect("(")
	for p.peek().Text != ")" {
		key := p.take()
		if key.Kind != NameToken {
			fail("Constructors use named parameters.", key.From, key.To)
		}
		p.expect(":")
		if into.Has(key.Text) {
			fail("Duplicate parameter: "+key.Text, key.From, key.To)
		}
		into.set(key.Text, p.expression(0))
		if !p.accept(",") {
			break
		}
	}
	return p.expect(")")
}

// dataEntry is dish<Product>(src: ...) as Data(name:, from:, type:, …).
func (p *parser) dataEntry(block Token, client bool) *Expr {
	token, name := p.entryName()
	t, list := p.typeAnnotation()
	given := &Args{}
	close := p.namedArgs(given)
	args := &Args{}
	args.set("name", name)
	for _, key := range given.Keys() {
		target := key
		if key == "src" {
			target = "from"
		}
		args.set(target, given.Get(key))
	}
	args.set("type", t)
	if list != nil {
		args.set("list", list)
	}
	if client {
		args.set("fetch", literal(js.StringValue("client"), block.From, block.To))
	}
	return &Expr{Kind: Call, Name: "Data", Args: args, From: token.From, To: close.To}
}

// typedEntry is quantity: Number(default: 1) as NumberState(name: "quantity", default: 1).
func (p *parser) typedEntry(types [][2]string, block string) *Expr {
	token, name := p.entryName()
	p.expect(":")
	value := p.expression(0)
	full, ok := "", false
	if value.Kind == Call {
		full, ok = typeFor(types, value.Name)
	}
	if !ok || len(value.Positional) > 0 {
		names := make([]string, len(types))
		for i, t := range types {
			names[i] = t[0]
		}
		fail(block+" entries are name: "+strings.Join(names, "(…), ")+"(…).", value.From, value.To)
	}
	args := &Args{}
	args.set("name", name)
	for _, key := range value.Args.Keys() {
		arg := value.Args.Get(key)
		if key == "name" {
			fail("The entry's name is its name: remove name:.", arg.From, arg.To)
		}
		args.set(key, arg)
	}
	return &Expr{Kind: Call, Name: full, Args: args, From: token.From, To: value.To}
}

// optionItems are Options(...)'s: typed data and name: String(...) entries.
func (p *parser) optionItems() []*Expr {
	return p.entries(func() *Expr {
		if p.at+1 < len(p.tokens) && p.tokens[p.at+1].Text == "<" {
			token, name := p.entryName()
			t, list := p.typeAnnotation()
			given := &Args{}
			close := p.namedArgs(given)
			args := &Args{}
			args.set("name", name)
			args.set("type", t)
			if list != nil {
				args.set("list", list)
			}
			for _, key := range given.Keys() {
				value := given.Get(key)
				if args.Has(key) {
					fail("Duplicate parameter: "+key, value.From, value.To)
				}
				args.set(key, value)
			}
			return &Expr{Kind: Call, Name: "DataOption", Args: args, From: token.From, To: close.To}
		}
		return p.typedEntry(blockOptionTypes, "Options")
	})
}

// partEntry is price: Text(...) as Part(name: "price", build: Text(...)).
func (p *parser) partEntry() *Expr {
	token, name := p.entryName()
	p.expect(":")
	build := p.expression(0)
	args := &Args{}
	args.set("name", name)
	args.set("build", build)
	return &Expr{Kind: Call, Name: "Part", Args: args, From: token.From, To: build.To}
}

// variantEntry is compact: Variant(label: "Compact", options: Options(...), Build(...)).
func (p *parser) variantEntry() *Expr {
	token, id := p.entryName()
	p.expect(":")
	variant := p.take()
	if variant.Text != "Variant" {
		fail("Variants entries are id: Variant(label: …, Build(…)).", variant.From, max(variant.To, variant.From+1))
	}
	p.expect("(")
	args := &Args{}
	args.set("id", id)
	for p.peek().Text != ")" {
		key := p.take()
		switch {
		case key.Text == "Build" && p.peek().Text == "(":
			p.take()
			if args.Has("build") {
				fail("A variant has one Build(...).", key.From, key.To)
			}
			args.set("build", p.expression(0))
			p.accept(",")
			p.expect(")")
		case key.Kind == NameToken:
			p.expect(":")
			if args.Has(key.Text) {
				fail("Duplicate parameter: "+key.Text, key.From, key.To)
			}
			if key.Text == "options" && p.peek().Text == "Options" {
				block := p.take()
				p.expect("(")
				items := p.optionItems()
				close := p.expect(")")
				args.set("options", &Expr{Kind: List, Items: items, From: block.From, To: close.To})
			} else {
				args.set(key.Text, p.expression(0))
			}
		default:
			fail("Expected label:, options: or Build(...).", key.From, max(key.To, key.From+1))
		}
		if !p.accept(",") {
			break
		}
	}
	close := p.expect(")")
	return &Expr{Kind: Call, Name: "Variant", Args: args, From: token.From, To: close.To}
}
