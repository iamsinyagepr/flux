// Synced from Upskale Studio (upskaleapp/src/lib/studio/conditions.ts). Edit it there, then npm run sync.
import { parseSource, type Expr } from "./parser";

/**
 * A condition as the canvas's condition card edits it: tests joined by "and"
 * (&&) or "or" (||). Each test is a screen size, the current page, a
 * true/false value (a state, an option or data such as store.is_open), or a
 * value compared with something:
 *
 *   isDesktop() && isCurrentRoute(Route.cart) && cartCount > 0 && !state.compact
 *
 * Kept as ordinary Flux inside each property it drives
 * (`padding: isDesktop() && state.open ? Space.xl : Space.md`), so the
 * preview and the Flutter compiler need nothing new.
 */
export type CompareOp = "==" | "!=" | ">" | "<" | ">=" | "<=";
export type Clause =
  | { kind: "screen"; size: "isMobile" | "isTablet" | "isDesktop"; not: boolean }
  | { kind: "route"; route: string; not: boolean }
  | { kind: "flag"; ref: string; not: boolean }
  | { kind: "compare"; ref: string; op: CompareOp; value: string };
export interface ConditionModel {
  join: "&&" | "||";
  clauses: Clause[];
}

const SCREENS = ["isMobile", "isTablet", "isDesktop"] as const;
export const COMPARE_OPS: CompareOp[] = ["==", "!=", ">", "<", ">=", "<="];
/** state.x, options.x and data (cartCount, store.is_open): not a token like Color.text. */
const READABLE = /^[a-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

/** The expression [text] parses to, or undefined. */
export function parseExpression(text: string): { expr: Expr; offset: number } | undefined {
  const prefix = "Component(value: ";
  const root = parseSource(prefix + text + ")").root;
  const expr = root?.args.value;
  return expr ? { expr, offset: prefix.length } : undefined;
}

/** [text] as clauses, or undefined when it is written some other way. */
export function readCondition(text: string): ConditionModel | undefined {
  const parsed = parseExpression(text);
  if (!parsed) return undefined;
  const slice = (expr: Expr) => text.slice(expr.from - parsed.offset, expr.to - parsed.offset);
  const leaves: Expr[] = [];
  let join: "&&" | "||" | undefined;
  const flatten = (expr: Expr): boolean => {
    if (expr.type === "binary" && (expr.op === "&&" || expr.op === "||")) {
      if (join && join !== expr.op) return false;
      join = expr.op;
      return flatten(expr.left) && flatten(expr.right);
    }
    leaves.push(expr);
    return true;
  };
  if (!flatten(parsed.expr)) return undefined;
  const clauses: Clause[] = [];
  for (const leaf of leaves) {
    let expr = leaf;
    let not = false;
    if (expr.type === "unary" && expr.op === "!") {
      not = true;
      expr = expr.child;
    }
    const routeArg = expr.type === "call" && expr.name === "isCurrentRoute" ? (expr.positional[0] ?? expr.args.route) : undefined;
    if (expr.type === "call" && (SCREENS as readonly string[]).includes(expr.name) && !Object.keys(expr.args).length && !expr.positional.length)
      clauses.push({ kind: "screen", size: expr.name as (typeof SCREENS)[number], not });
    else if (routeArg) clauses.push({ kind: "route", route: slice(routeArg), not });
    else if (expr.type === "ref" && READABLE.test(expr.name)) clauses.push({ kind: "flag", ref: expr.name, not });
    else if (
      !not &&
      expr.type === "binary" &&
      (COMPARE_OPS as string[]).includes(expr.op) &&
      expr.left.type === "ref" &&
      READABLE.test(expr.left.name) &&
      expr.right.type === "literal"
    )
      clauses.push({ kind: "compare", ref: expr.left.name, op: expr.op as CompareOp, value: slice(expr.right) });
    else return undefined;
  }
  return { join: join ?? "&&", clauses };
}

const clauseText = (clause: Clause): string =>
  clause.kind === "screen"
    ? (clause.not ? "!" : "") + clause.size + "()"
    : clause.kind === "route"
      ? (clause.not ? "!" : "") + `isCurrentRoute(${clause.route})`
      : clause.kind === "flag"
        ? (clause.not ? "!" : "") + clause.ref
        : `${clause.ref} ${clause.op} ${clause.value}`;

export function writeCondition(model: ConditionModel): string {
  return model.clauses.length ? model.clauses.map(clauseText).join(` ${model.join} `) : "true";
}

const OP_WORDS: Record<CompareOp, string> = { "==": "is", "!=": "isn't", ">": "is over", "<": "is under", ">=": "is at least", "<=": "is at most" };
export const compareWords = (op: CompareOp) => OP_WORDS[op];
const short = (ref: string) => ref.replace(/^(state|options)\./, "");

/** In plain words, for a card's title: "Desktop and on cart and cartCount is over 0". */
export function describeCondition(text: string): string {
  const model = readCondition(text);
  if (!model) return text;
  const words = model.clauses.map((clause) =>
    clause.kind === "screen"
      ? (clause.not ? "not " : "") + clause.size.replace(/^is/, "").toLowerCase()
      : clause.kind === "route"
        ? (clause.not ? "not on " : "on ") + clause.route.replace(/^Route\./, "")
        : clause.kind === "flag"
          ? (clause.not ? "not " : "") + short(clause.ref)
          : `${short(clause.ref)} ${OP_WORDS[clause.op]} ${clause.value}`,
  );
  return words.join(model.join === "&&" ? " and " : " or ") || "always";
}

/** One spelling per condition, so properties with the same one share a card. */
export const normalizeCondition = (text: string) => text.replace(/\s+/g, " ").trim();
