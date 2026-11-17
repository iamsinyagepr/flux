// Synced from Upskale Studio (upskaleapp/src/lib/studio/dynamicProps.ts). Edit it there, then npm run sync.
import type { Expr } from "./parser";

/**
 * A property driven by a state or option, kept as an ordinary Flux
 * conditional so the preview and the Flutter compiler need nothing new:
 *
 *   bool:  color: state.open ? Color.danger : Color.text
 *   cases: color: state.size == "big" ? Color.danger : state.size == "small" ? Color.muted : Color.text
 *   when:  padding: isDesktop() && state.open ? Space.xl : Space.md   (a condition card)
 *          padding: isDesktop() && Insets(x: Space.xxl)                (no otherwise: unset)
 */
export interface Branch {
  text: string;
  /** For reading the branch's value with the property's own field. */
  expr?: Expr;
}
export type Dynamic =
  | { kind: "bool"; ref: string; whenTrue: Branch; whenFalse: Branch }
  | { kind: "cases"; ref: string; cases: { match: string; value: Branch }[]; otherwise: Branch }
  /** Any other condition (screen sizes, several tests): a condition card drives it. */
  | { kind: "when"; condition: string; whenTrue: Branch; whenFalse: Branch | null };

/** What drives a dynamic property: a state/option ref, or a condition card's condition. */
export const driverOf = (value: Dynamic): string => (value.kind === "when" ? "condition" : value.ref);

const DRIVER = /^(state|options)\.[A-Za-z_]\w*$/;
const branch = (source: string, expr: Expr): Branch => ({ text: source.slice(expr.from, expr.to), expr });

/** A boolean test, rather than a value used only when a condition holds. */
const isTest = (expr: Expr): boolean =>
  // Data (`p.is_available`) may be a boolean; tokens (`Space.xl`) are values.
  (expr.type === "ref" && !/^[A-Z]/.test(expr.name)) ||
  (expr.type === "unary" && expr.op === "!") ||
  (expr.type === "binary" && ["&&", "||", "==", "!=", "<", ">", "<=", ">="].includes(expr.op)) ||
  (expr.type === "call" && /^is[A-Z]/.test(expr.name)) ||
  (expr.type === "literal" && typeof expr.value === "boolean");

/** The property as a dynamic value, or undefined when it isn't one. */
export function readDynamic(source: string, expr: Expr | undefined): Dynamic | undefined {
  // The shorthand: `isDesktop() && Insets(x: Space.xxl)`, unset otherwise.
  if (expr?.type === "binary" && expr.op === "&&" && !isTest(expr.right))
    return { kind: "when", condition: source.slice(expr.left.from, expr.left.to), whenTrue: branch(source, expr.right), whenFalse: null };
  if (expr?.type !== "conditional") return undefined;
  const condition = expr.condition;
  if (condition.type === "ref" && DRIVER.test(condition.name))
    return { kind: "bool", ref: condition.name, whenTrue: branch(source, expr.yes), whenFalse: branch(source, expr.no) };
  if (condition.type === "unary" && condition.op === "!" && condition.child.type === "ref" && DRIVER.test(condition.child.name))
    return { kind: "bool", ref: condition.child.name, whenTrue: branch(source, expr.no), whenFalse: branch(source, expr.yes) };
  const caseOf = (item: Expr) =>
    item.type === "conditional" &&
    item.condition.type === "binary" &&
    item.condition.op === "==" &&
    item.condition.left.type === "ref" &&
    DRIVER.test(item.condition.left.name) &&
    item.condition.right.type === "literal"
      ? { ref: item.condition.left.name, match: source.slice(item.condition.right.from, item.condition.right.to), item }
      : undefined;
  const first = caseOf(expr);
  if (!first)
    return { kind: "when", condition: source.slice(condition.from, condition.to), whenTrue: branch(source, expr.yes), whenFalse: branch(source, expr.no) };
  const cases: { match: string; value: Branch }[] = [];
  let current: Expr = expr;
  let found: ReturnType<typeof caseOf> = first;
  // Follow the chain while it keeps testing the same state or option.
  while (found && found.ref === first.ref) {
    const item = found.item as Extract<Expr, { type: "conditional" }>;
    cases.push({ match: found.match, value: branch(source, item.yes) });
    current = item.no;
    found = caseOf(current);
  }
  return { kind: "cases", ref: first.ref, cases, otherwise: branch(source, current) };
}

/** A branch's text, bracketed when it is itself a conditional. */
const wrap = (text: string) => (/\?/.test(text) && !/^\(.*\)$/s.test(text.trim()) ? `(${text})` : text);

/** A condition, bracketed where && or ?: would bind differently. */
const wrapCondition = (text: string, shorthand: boolean) =>
  (/\?/.test(text) || (shorthand && /\|\|/.test(text))) && !/^\(.*\)$/s.test(text.trim()) ? `(${text})` : text;

export function writeDynamic(value: Dynamic): string {
  if (value.kind === "when")
    return value.whenFalse
      ? `${wrapCondition(value.condition, false)} ? ${wrap(value.whenTrue.text)} : ${wrap(value.whenFalse.text)}`
      : `${wrapCondition(value.condition, true)} && ${wrap(value.whenTrue.text)}`;
  if (value.kind === "bool") return `${value.ref} ? ${wrap(value.whenTrue.text)} : ${wrap(value.whenFalse.text)}`;
  return (
    value.cases.map((item) => `${value.ref} == ${item.match} ? ${wrap(item.value.text)} : `).join("") + wrap(value.otherwise.text)
  );
}

/**
 * Link a property to a state or option: its current value becomes every
 * branch, ready to change. A bool driver splits into true/false; any other
 * into one case (matching the driver's starting value) and otherwise.
 */
export function linkDynamic(current: string, ref: string, bool: boolean, firstMatch: string): Dynamic {
  const value = { text: current };
  return bool
    ? { kind: "bool", ref, whenTrue: value, whenFalse: { text: current } }
    : { kind: "cases", ref, cases: [{ match: firstMatch, value }], otherwise: { text: current } };
}

/**
 * Link a property to a condition card: its current value applies when the
 * condition holds and stays as it is otherwise, ready to change.
 */
export function linkCondition(current: string, condition: string): Dynamic {
  return { kind: "when", condition, whenTrue: { text: current }, whenFalse: { text: current } };
}

/** The value left when a dynamic property is unlinked: what it is otherwise. */
export function unlinkDynamic(value: Dynamic): string {
  if (value.kind === "when") return (value.whenFalse ?? value.whenTrue).text;
  return value.kind === "bool" ? value.whenFalse.text : value.otherwise.text;
}
