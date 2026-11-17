// Synced from Upskale Studio (upskaleapp/src/lib/studio/parser.ts). Edit it there, then npm run sync.
import { MAX_SOURCE_BYTES, sourceBytes } from "./types";
import type { StudioDiagnostic } from "./languageService";
export type Expr =
  | {
      type: "literal";
      value: string | number | boolean | null;
      from: number;
      to: number;
      segments?: (string | Expr)[];
      /** A name written bare, as the block form names an entry (quantity: Number(...)). */
      bare?: true;
    }
  | { type: "ref"; name: string; from: number; to: number }
  | { type: "list"; items: Expr[]; from: number; to: number }
  | {
      type: "call";
      name: string;
      args: Record<string, Expr>;
      positional: Expr[];
      from: number;
      to: number;
      /** A file in the block form (FLUX.md): where each of its blocks is. */
      blocks?: SourceBlock[];
    }
  | { type: "unary"; op: string; child: Expr; from: number; to: number }
  | {
      type: "binary";
      op: string;
      left: Expr;
      right: Expr;
      from: number;
      to: number;
    }
  | {
      type: "conditional";
      condition: Expr;
      yes: Expr;
      no: Expr;
      from: number;
      to: number;
    }
  | { type: "index"; target: Expr; index: Expr; from: number; to: number };
export type CallExpr = Extract<Expr, { type: "call" }>;
/** One top-level block of a file: its name, its span, and inside its parentheses. */
export interface SourceBlock {
  name: string;
  from: number;
  to: number;
  /** Just inside "(" and just before ")". */
  open: number;
  close: number;
}
/** The blocks a page and a component may have, in the order Studio writes them. */
export const PAGE_BLOCKS = ["usingServer", "usingClient", "State", "Parts", "Build"];
export const COMPONENT_BLOCKS = ["Options", "usingClient", "State", "Parts", "Build", "Variants"];
/** A single-call field and the block it's written in. */
const BLOCK_FIELDS: Record<string, string> = {
  data: "usingServer",
  states: "State",
  parts: "Parts",
  build: "Build",
  options: "Options",
  variants: "Variants",
};
/** State(...)'s types, and the state each is. */
export const STATE_TYPES: Record<string, string> = { String: "StringState", Number: "NumberState", Bool: "BoolState" };
/** Options(...)'s types, and the option each is. */
export const OPTION_TYPES: Record<string, string> = {
  String: "StringOption",
  Number: "NumberOption",
  Bool: "BoolOption",
  Color: "ColorOption",
  Enum: "EnumOption",
  Slot: "ComponentOption",
  Action: "ActionOption",
};
export interface Token {
  kind: "name" | "number" | "string" | "symbol" | "end";
  text: string;
  from: number;
  to: number;
}
export class SourceError extends Error {
  constructor(
    message: string,
    readonly from: number,
    readonly to: number,
  ) {
    super(message);
  }
}
export function lex(source: string, offset = 0): Token[] {
  const tokens: Token[] = [];
  let p = 0;
  const add = (kind: Token["kind"], start: number) =>
    tokens.push({
      kind,
      text: source.slice(start, p),
      from: start + offset,
      to: p + offset,
    });
  function interpolation() {
    let depth = 1;
    while (p < source.length && depth) {
      const c = source[p++];
      if (c === '"') {
        while (p < source.length) {
          const q = source[p++];
          if (q === "\\") {
            p++;
            continue;
          }
          if (q === '"') break;
        }
      } else if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    if (depth)
      throw new SourceError(
        "Unclosed string interpolation.",
        offset + p - 1,
        offset + p,
      );
  }
  while (p < source.length) {
    const start = p,
      c = source[p];
    if (/\s/.test(c)) {
      p++;
      continue;
    }
    if (source.startsWith("//", p)) {
      while (p < source.length && source[p] !== "\n") p++;
      continue;
    }
    if (source.startsWith("/*", p)) {
      const end = source.indexOf("*/", p + 2);
      if (end < 0)
        throw new SourceError(
          "Unclosed block comment.",
          start + offset,
          source.length + offset,
        );
      p = end + 2;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      p++;
      while (p < source.length && /[A-Za-z0-9_]/.test(source[p])) p++;
      add("name", start);
      continue;
    }
    if (/[0-9]/.test(c)) {
      p++;
      while (/[0-9]/.test(source[p] ?? "")) p++;
      if (source[p] === "." && /[0-9]/.test(source[p + 1] ?? "")) {
        p++;
        while (/[0-9]/.test(source[p] ?? "")) p++;
      }
      add("number", start);
      continue;
    }
    if (c === '"') {
      p++;
      let closed = false;
      while (p < source.length) {
        const q = source[p++];
        if (q === "\\") {
          p++;
          continue;
        }
        if (q === '"') {
          closed = true;
          break;
        }
        if (q === "$" && source[p] === "{") {
          p++;
          interpolation();
        }
      }
      if (!closed)
        throw new SourceError(
          "Unclosed string literal.",
          start + offset,
          source.length + offset,
        );
      if (p - start > 8000)
        throw new SourceError(
          "String literal exceeds 2,000 characters.",
          start + offset,
          p + offset,
        );
      add("string", start);
      continue;
    }
    const pair = source.slice(p, p + 2);
    if (["??", "||", "&&", "==", "!=", "<=", ">="].includes(pair)) p += 2;
    else if ("()[],:.?+-*/%!<>".includes(c)) p++;
    else
      throw new SourceError(
        'Unexpected character "' + c + '".',
        start + offset,
        start + offset + 1,
      );
    add("symbol", start);
    if (tokens.length > 20000)
      throw new SourceError(
        "Source has too many tokens.",
        start + offset,
        p + offset,
      );
  }
  tokens.push({ kind: "end", text: "", from: p + offset, to: p + offset });
  return tokens;
}
const precedence: Record<string, number> = {
  "??": 1,
  "||": 2,
  "&&": 3,
  "==": 4,
  "!=": 4,
  "<": 5,
  "<=": 5,
  ">": 5,
  ">=": 5,
  "+": 6,
  "-": 6,
  "*": 7,
  "/": 7,
  "%": 7,
};
class Parser {
  private at = 0;
  private depth = 0;
  constructor(private tokens: Token[]) {}
  peek() {
    return this.tokens[this.at];
  }
  take() {
    return this.tokens[this.at++];
  }
  expect(text: string) {
    const token = this.take();
    if (token.text !== text)
      throw new SourceError(
        'Expected "' +
          text +
          '", found ' +
          (token.kind === "end" ? "end of file" : '"' + token.text + '"') +
          ".",
        token.from,
        Math.max(token.from + 1, token.to),
      );
    return token;
  }
  accept(text: string) {
    if (this.peek().text === text) {
      this.take();
      return true;
    }
    return false;
  }
  /**
   * A file: one Page(...) or Component(...) call (the single-call form), or
   * that call as a header followed by blocks (FLUX.md):
   *
   *   Page(name: "Dish", route: Route(...), seo: Seo(...))
   *   usingServer(dish<Product>(src: Tenant.product(id: route.dish)))
   *   usingClient(orders<Order[]>(src: Tenant.history()))
   *   State(quantity: Number(default: 1))
   *   Parts(price: Text(...))
   *   Build(Column(...))
   *
   * read into the tree the single-call form has (Page(name:, route:, data:
   * [Data(...)], seo:, states: [...], parts: [...], build:)), every node made
   * up for it placed where what it stands for is written.
   */
  parseFile(): Expr {
    const head = this.expression();
    if (this.peek().kind === "end") return head;
    if (head.type !== "call" || (head.name !== "Page" && head.name !== "Component"))
      throw new SourceError("A file must contain one Component(...), or for a page, one Page(...).", head.from, head.to);
    return this.blocks(head);
  }
  private blocks(head: CallExpr): CallExpr {
    const page = head.name === "Page";
    const allowed = page ? PAGE_BLOCKS : COMPONENT_BLOCKS;
    for (const key of Object.keys(head.args))
      if (Object.hasOwn(BLOCK_FIELDS, key))
        throw new SourceError(`${key} goes in its own block: ${BLOCK_FIELDS[key]}(...).`, head.args[key].from, head.args[key].to);
    const args: Record<string, Expr> = Object.create(null);
    Object.assign(args, head.args);
    // A component's is dsl 1, said by its form.
    if (!page && !Object.hasOwn(args, "dsl")) args.dsl = { type: "literal", value: 1, from: head.from, to: head.from };
    const blocks: SourceBlock[] = [];
    const data: Expr[] = [];
    let dataFrom = -1,
      dataTo = -1;
    while (this.peek().kind !== "end") {
      const name = this.take();
      if (name.kind !== "name" || !allowed.includes(name.text))
        throw new SourceError(
          `Expected a block of a ${page ? "page" : "component"}: ${allowed.join(", ")}.`,
          name.from,
          Math.max(name.to, name.from + 1),
        );
      if (blocks.some((block) => block.name === name.text))
        throw new SourceError(`There's already a ${name.text}(...) block.`, name.from, name.to);
      const other = name.text === "Build" ? "Variants" : name.text === "Variants" ? "Build" : "";
      if (other && blocks.some((block) => block.name === other))
        throw new SourceError("A component draws one Build(...) or several Variants(...), not both.", name.from, name.to);
      const open = this.expect("(");
      let items: Expr[] = [];
      let build: Expr | undefined;
      switch (name.text) {
        case "usingServer":
        case "usingClient":
          items = this.entries(() => this.dataEntry(name.text === "usingClient" ? name : undefined));
          break;
        case "Options":
          items = this.optionItems();
          break;
        case "State":
          items = this.entries(() => this.typedEntry(STATE_TYPES, "State"));
          break;
        case "Parts":
          items = this.entries(() => this.partEntry());
          break;
        case "Variants":
          items = this.entries(() => this.variantEntry());
          break;
        case "Build":
          build = this.expression();
          this.accept(",");
          break;
      }
      const close = this.expect(")");
      const span = { from: name.from, to: close.to };
      blocks.push({ name: name.text, ...span, open: open.to, close: close.from });
      switch (name.text) {
        case "usingServer":
        case "usingClient":
          data.push(...items);
          if (dataFrom < 0) dataFrom = name.from;
          dataTo = close.to;
          break;
        case "Options":
          args.options = { type: "list", items, ...span };
          break;
        case "State":
          args.states = { type: "list", items, ...span };
          break;
        case "Parts":
          args.parts = { type: "list", items, ...span };
          break;
        case "Variants":
          args.variants = { type: "list", items, ...span };
          break;
        case "Build":
          if (page) args.build = build!;
          else args.variants = { type: "list", items: [this.defaultVariant(name, build!, span)], ...span };
          break;
      }
    }
    if (dataFrom >= 0) args.data = { type: "list", items: data, from: dataFrom, to: dataTo };
    const last = blocks[blocks.length - 1];
    return { type: "call", name: head.name, args, positional: [], from: head.from, to: last?.to ?? head.to, blocks };
  }
  /** A block's entries, comma separated, a trailing comma allowed. */
  private entries(entry: () => Expr): Expr[] {
    const items: Expr[] = [];
    while (this.peek().text !== ")" && this.peek().kind !== "end") {
      items.push(entry());
      if (items.length > 200) throw new SourceError("Too many entries in one block.", this.peek().from, this.peek().to);
      if (!this.accept(",")) break;
    }
    return items;
  }
  /** name: the entry's name, as the literal the single-call form writes. */
  private entryName(): { token: Token; literal: Expr } {
    const token = this.take();
    if (token.kind !== "name") throw new SourceError("Expected a name.", token.from, Math.max(token.to, token.from + 1));
    return { token, literal: { type: "literal", value: token.text, from: token.from, to: token.to, bare: true } };
  }
  /** <Store>, <Store[]>, <Page<Store>>: its name and whether it's a list. */
  private typeAnnotation(): { type: Expr; list?: Expr } {
    this.expect("<");
    const name = this.take();
    if (name.kind !== "name" || !/^[A-Z]/.test(name.text))
      throw new SourceError("Expected a type: Store, Product[], Json…", name.from, Math.max(name.to, name.from + 1));
    let text = name.text,
      end = name.to;
    if (this.accept("<")) {
      const inner = this.take();
      if (inner.kind !== "name") throw new SourceError("Expected a type.", inner.from, Math.max(inner.to, inner.from + 1));
      text += "<" + inner.text + ">";
      end = this.expect(">").to;
    }
    let list: Expr | undefined;
    if (this.peek().text === "[") {
      const open = this.take();
      const close = this.expect("]");
      list = { type: "literal", value: true, from: open.from, to: close.to };
    }
    this.expect(">");
    return { type: { type: "ref", name: text, from: name.from, to: end }, list };
  }
  /** Named arguments up to the closing parenthesis, which it takes. */
  private namedArgs(into: Record<string, Expr>): Token {
    this.expect("(");
    while (this.peek().text !== ")") {
      const key = this.take();
      if (key.kind !== "name") throw new SourceError("Constructors use named parameters.", key.from, key.to);
      this.expect(":");
      if (Object.hasOwn(into, key.text)) throw new SourceError("Duplicate parameter: " + key.text, key.from, key.to);
      into[key.text] = this.expression();
      if (!this.accept(",")) break;
    }
    return this.expect(")");
  }
  /** dish<Product>(src: Tenant.product(id: route.dish)) as Data(name:, from:, type:, …). */
  private dataEntry(client?: Token): Expr {
    const { token, literal } = this.entryName();
    const { type, list } = this.typeAnnotation();
    const given: Record<string, Expr> = Object.create(null);
    const close = this.namedArgs(given);
    const args: Record<string, Expr> = Object.create(null);
    args.name = literal;
    for (const [key, value] of Object.entries(given)) args[key === "src" ? "from" : key] = value;
    args.type = type;
    if (list) args.list = list;
    if (client) args.fetch = { type: "literal", value: "client", from: client.from, to: client.to };
    return { type: "call", name: "Data", args, positional: [], from: token.from, to: close.to };
  }
  /** quantity: Number(default: 1) as NumberState(name: "quantity", default: 1). */
  private typedEntry(types: Record<string, string>, block: string): Expr {
    const { token, literal } = this.entryName();
    this.expect(":");
    const value = this.expression();
    if (value.type !== "call" || !Object.hasOwn(types, value.name) || value.positional.length)
      throw new SourceError(
        `${block} entries are name: ${Object.keys(types).join("(…), ")}(…).`,
        value.from,
        value.to,
      );
    const args: Record<string, Expr> = Object.create(null);
    args.name = literal;
    for (const [key, arg] of Object.entries(value.args)) {
      if (key === "name") throw new SourceError("The entry's name is its name: remove name:.", arg.from, arg.to);
      args[key] = arg;
    }
    return { type: "call", name: types[value.name], args, positional: [], from: token.from, to: value.to };
  }
  /** Options(...)'s entries: typed data (product<Product>(...)) and name: String(...). */
  private optionItems(): Expr[] {
    return this.entries(() => {
      if (this.tokens[this.at + 1]?.text === "<") {
        const { token, literal } = this.entryName();
        const { type, list } = this.typeAnnotation();
        const given: Record<string, Expr> = Object.create(null);
        const close = this.namedArgs(given);
        const args: Record<string, Expr> = Object.create(null);
        args.name = literal;
        args.type = type;
        if (list) args.list = list;
        for (const [key, value] of Object.entries(given)) {
          if (Object.hasOwn(args, key)) throw new SourceError("Duplicate parameter: " + key, value.from, value.to);
          args[key] = value;
        }
        return { type: "call", name: "DataOption", args, positional: [], from: token.from, to: close.to };
      }
      return this.typedEntry(OPTION_TYPES, "Options");
    });
  }
  /** price: Text(...) as Part(name: "price", build: Text(...)). */
  private partEntry(): Expr {
    const { token, literal } = this.entryName();
    this.expect(":");
    const build = this.expression();
    const args: Record<string, Expr> = Object.create(null);
    args.name = literal;
    args.build = build;
    return { type: "call", name: "Part", args, positional: [], from: token.from, to: build.to };
  }
  /** A component's Build(...): its one variant, "default". */
  private defaultVariant(name: Token, build: Expr, span: { from: number; to: number }): Expr {
    const args: Record<string, Expr> = Object.create(null);
    args.id = { type: "literal", value: "default", from: name.from, to: name.to };
    args.label = { type: "literal", value: "Default", from: name.from, to: name.to };
    args.build = build;
    return { type: "call", name: "Variant", args, positional: [], ...span };
  }
  /** compact: Variant(label: "Compact", options: Options(...), Build(...)). */
  private variantEntry(): Expr {
    const { token, literal } = this.entryName();
    this.expect(":");
    const variant = this.take();
    if (variant.text !== "Variant") throw new SourceError("Variants entries are id: Variant(label: …, Build(…)).", variant.from, Math.max(variant.to, variant.from + 1));
    this.expect("(");
    const args: Record<string, Expr> = Object.create(null);
    args.id = literal;
    while (this.peek().text !== ")") {
      const key = this.take();
      if (key.text === "Build" && this.peek().text === "(") {
        this.take();
        if (Object.hasOwn(args, "build")) throw new SourceError("A variant has one Build(...).", key.from, key.to);
        args.build = this.expression();
        this.accept(",");
        this.expect(")");
      } else if (key.kind === "name") {
        this.expect(":");
        if (Object.hasOwn(args, key.text)) throw new SourceError("Duplicate parameter: " + key.text, key.from, key.to);
        if (key.text === "options" && this.peek().text === "Options") {
          const block = this.take();
          this.expect("(");
          const items = this.optionItems();
          args.options = { type: "list", items, from: block.from, to: this.expect(")").to };
        } else args[key.text] = this.expression();
      } else throw new SourceError("Expected label:, options: or Build(...).", key.from, Math.max(key.to, key.from + 1));
      if (!this.accept(",")) break;
    }
    const close = this.expect(")");
    return { type: "call", name: "Variant", args, positional: [], from: token.from, to: close.to };
  }
  parse(): Expr {
    const result = this.expression();
    if (this.peek().kind !== "end")
      throw new SourceError(
        "Expected a single Component expression.",
        this.peek().from,
        this.peek().to,
      );
    return result;
  }
  expression(min = 0): Expr {
    if (++this.depth > 64)
      throw new SourceError(
        "Maximum expression depth is 64.",
        this.peek().from,
        this.peek().to,
      );
    let left = this.primary();
    while (this.accept("[")) {
      const index = this.expression();
      const end = this.expect("]");
      left = {
        type: "index",
        target: left,
        index,
        from: left.from,
        to: end.to,
      };
    }
    while ((precedence[this.peek().text] ?? 0) > min) {
      const op = this.take().text;
      const right = this.expression(precedence[op]);
      left = { type: "binary", op, left, right, from: left.from, to: right.to };
    }
    if (min === 0 && this.accept("?")) {
      const yes = this.expression();
      this.expect(":");
      const no = this.expression();
      left = {
        type: "conditional",
        condition: left,
        yes,
        no,
        from: left.from,
        to: no.to,
      };
    }
    this.depth--;
    return left;
  }
  primary(): Expr {
    const token = this.take();
    if (token.text === "!" || token.text === "-") {
      const child = this.expression(8);
      return {
        type: "unary",
        op: token.text,
        child,
        from: token.from,
        to: child.to,
      };
    }
    if (token.text === "(") {
      const result = this.expression();
      this.expect(")");
      return result;
    }
    if (token.text === "[") {
      const items: Expr[] = [];
      while (this.peek().text !== "]") {
        items.push(this.expression());
        if (!this.accept(",")) break;
        if (items.length > 1000)
          throw new SourceError(
            "List limit exceeded.",
            token.from,
            this.peek().to,
          );
      }
      const end = this.expect("]");
      return { type: "list", items, from: token.from, to: end.to };
    }
    if (token.kind === "number")
      return {
        type: "literal",
        value: Number(token.text),
        from: token.from,
        to: token.to,
      };
    if (["true", "false", "null"].includes(token.text))
      return {
        type: "literal",
        value: token.text === "null" ? null : token.text === "true",
        from: token.from,
        to: token.to,
      };
    if (token.kind === "string") return this.string(token);
    if (token.kind === "name") {
      let name = token.text;
      let end = token.to;
      while (this.accept(".")) {
        const next = this.take();
        if (next.kind !== "name")
          throw new SourceError(
            "Expected a name after the dot.",
            next.from,
            next.to,
          );
        name += "." + next.text;
        end = next.to;
      }
      if (!this.accept("("))
        return { type: "ref", name, from: token.from, to: end };
      const args: Record<string, Expr> = Object.create(null),
        positional: Expr[] = [];
      const constructor = /^[A-Z]/.test(name);
      while (this.peek().text !== ")") {
        if (constructor) {
          const key = this.take();
          if (key.kind !== "name")
            throw new SourceError(
              "Constructors use named parameters.",
              key.from,
              key.to,
            );
          this.expect(":");
          if (Object.hasOwn(args, key.text))
            throw new SourceError(
              "Duplicate parameter: " + key.text,
              key.from,
              key.to,
            );
          args[key.text] = this.expression();
        } else positional.push(this.expression());
        if (!this.accept(",")) break;
      }
      const close = this.expect(")");
      return {
        type: "call",
        name,
        args,
        positional,
        from: token.from,
        to: close.to,
      };
    }
    throw new SourceError(
      "Expected a value or constructor.",
      token.from,
      Math.max(token.to, token.from + 1),
    );
  }
  string(token: Token): Expr {
    const raw = token.text.slice(1, -1),
      segments: (string | Expr)[] = [];
    let text = "",
      p = 0;
    while (p < raw.length) {
      const c = raw[p++];
      if (c === "\\") {
        const next = raw[p++];
        const escapes: Record<string, string> = {
          n: "\n",
          t: "\t",
          '"': '"',
          "\\": "\\",
          $: "$",
        };
        if (!(next in escapes))
          throw new SourceError(
            "Unsupported string escape.",
            token.from + p - 1,
            token.from + p + 1,
          );
        text += escapes[next];
        continue;
      }
      if (c === "$" && raw[p] === "{") {
        if (text) {
          segments.push(text);
          text = "";
        }
        p++;
        const start = p;
        let depth = 1,
          quote = false,
          escape = false;
        while (p < raw.length && depth) {
          const q = raw[p++];
          if (escape) {
            escape = false;
            continue;
          }
          if (q === "\\") {
            escape = true;
            continue;
          }
          if (q === '"') {
            quote = !quote;
            continue;
          }
          if (!quote) {
            if (q === "{") depth++;
            if (q === "}") depth--;
          }
        }
        if (depth)
          throw new SourceError(
            "Unclosed interpolation.",
            token.from + start,
            token.to,
          );
        segments.push(
          new Parser(
            lex(raw.slice(start, p - 1), token.from + 1 + start),
          ).parse(),
        );
        continue;
      }
      text += c;
    }
    if (text || !segments.length) segments.push(text);
    const value = segments
      .filter((part): part is string => typeof part === "string")
      .join("");
    if (value.length > 2000)
      throw new SourceError(
        "String literal exceeds 2,000 characters.",
        token.from,
        token.to,
      );
    return {
      type: "literal",
      value,
      segments: segments.some((part) => typeof part !== "string")
        ? segments
        : undefined,
      from: token.from,
      to: token.to,
    };
  }
}
export function parseSource(source: string): {
  root?: CallExpr;
  diagnostics: StudioDiagnostic[];
} {
  try {
    if (sourceBytes(source) > MAX_SOURCE_BYTES)
      throw new SourceError("Source exceeds 64 KB.", 0, source.length);
    const root = new Parser(lex(source)).parseFile();
    // A page file is a Page; a component's, a Component (pageModel.ts).
    if (root.type !== "call" || (root.name !== "Component" && root.name !== "Page"))
      throw new SourceError(
        "A file must contain one Component(...), or for a page, one Page(...).",
        root.from,
        root.to,
      );
    return { root, diagnostics: [] };
  } catch (error) {
    const issue =
      error instanceof SourceError
        ? error
        : new SourceError("Unable to parse this source.", 0, 1);
    return {
      diagnostics: [
        {
          code: "syntax",
          severity: "error",
          message: issue.message,
          from: issue.from,
          to: Math.min(source.length, issue.to),
        },
      ],
    };
  }
}
export function childrenOf(expr: Expr): Expr[] {
  switch (expr.type) {
    case "call":
      return [...Object.values(expr.args), ...expr.positional];
    case "list":
      return expr.items;
    case "unary":
      return [expr.child];
    case "binary":
      return [expr.left, expr.right];
    case "conditional":
      return [expr.condition, expr.yes, expr.no];
    case "index":
      return [expr.target, expr.index];
    case "literal":
      return (
        expr.segments?.filter(
          (part): part is Expr => typeof part !== "string",
        ) ?? []
      );
    default:
      return [];
  }
}
export function literalValue(
  expr: Expr | undefined,
): string | number | boolean | null | undefined {
  return expr?.type === "literal" && !expr.segments ? expr.value : undefined;
}
