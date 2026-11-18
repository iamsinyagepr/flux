// Synced from Upskale Studio (upskaleapp/src/console/functions/studio/visual-fields/index.ts). Edit it there, then npm run sync.
import { useState, useEffect } from "react";
import { tokenGroups, sizeDefaults, colorVariables } from "../../../../lib/studio/projectConfig";
import { cdslString } from "../../../../lib/studio/sourceEdits";
import { type ActionContext } from "../../../../lib/studio/actionModel";
import { type Dynamic } from "../../../../lib/studio/dynamicProps";
import { bindingCompletions, dataSuggestions } from "../../../../lib/studio/dataBindings";
import { tokenChoices, declaredNames } from "../../../../lib/studio/visualModel";
import type { CallExpr, Expr } from "../../../../lib/studio/parser";
import type { StudioConfig } from "../../../../lib/studio/projectConfig";
import type { FieldContext, Driver } from "../../../../components/studio/VisualFields";

export function useDraft(value: string, onCommit: (text: string) => void) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return {
    value: draft,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    commit: () => {
      if (draft !== value) onCommit(draft);
    },
    revert: () => setDraft(value),
  };
}

export const actionContext = (context: FieldContext): ActionContext => ({
  states: context.stateTypes,
  actionOptions: context.actionOptions,
  routes: tokenChoices("Route", context.config),
  pagePaths: context.pagePaths,
  bindings: context.bindings,
});

export const swap = <T,>(items: T[], a: number, b: number): T[] => {
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};

export const literalText = (text: string | undefined): string => {
  if (!text) return "";
  try {
    const value = JSON.parse(text);
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  } catch {
    return "";
  }
};

/** Stable ids for a branch's control (labels are unique within a property). */
export const branchId = (name: string, label: string) => "dynamic-" + name + "-" + label.replace(/\W+/g, "-");

/** A value not used by a case yet: the next enum value, else a fresh one. */
export function nextMatch(value: Extract<Dynamic, { kind: "cases" }>, driver?: Driver): string {
  const used = new Set(value.cases.map((item) => item.match));
  const unused = driver?.values?.find((item) => !used.has(item));
  if (unused) return unused;
  if (/Number/.test(driver?.type ?? "")) {
    let next = 0;
    while (used.has(String(next))) next++;
    return String(next);
  }
  let next = 1;
  while (used.has(cdslString("value" + next))) next++;
  return cdslString("value" + next);
}

/** A token's size in px: the project's value, else the built-in default. */
export function tokenSize(family: string, name: string, context: FieldContext): number | undefined {
  const group = tokenGroups[family];
  if (!group || group === "colors") return undefined;
  const own = context.config?.[group]?.[name];
  if (typeof own === "number") return own;
  return (sizeDefaults[group] as Record<string, number>)[name];
}

/** What a colour token paints: the project's hex, else the theme variable. */
export function tokenColor(name: string, context: FieldContext): string {
  const own = context.config?.colors?.[name];
  if (own) return own;
  const variable = colorVariables[name];
  return variable ? `var(${variable})` : "transparent";
}

export function declarationsOf(root: CallExpr, list: "states" | "options"): CallExpr[] {
  const value = root.args[list];
  return value?.type === "list"
    ? value.items.filter((item): item is CallExpr => item.type === "call" && item.args.name?.type === "literal")
    : [];
}
export const nameOf = (item: CallExpr) => String((item.args.name as Extract<Expr, { type: "literal" }>).value);

/** The states and options a property can change with (not ActionOptions or colours). */
export function driversOf(root: CallExpr, source: string): Driver[] {
  const text = (expr: Expr | undefined) => (expr ? source.slice(expr.from, expr.to) : undefined);
  return [
    ...declarationsOf(root, "states").map((item) => ({ ref: "state." + nameOf(item), type: item.name, initial: text(item.args.default) })),
    ...declarationsOf(root, "options")
      .filter((item) => ["StringOption", "NumberOption", "BoolOption", "EnumOption"].includes(item.name))
      .map((item) => ({
        ref: "options." + nameOf(item),
        type: item.name,
        initial: text(item.args.default),
        values:
          item.name === "EnumOption" && item.args.values?.type === "list"
            ? item.args.values.items.map((value) => source.slice(value.from, value.to))
            : undefined,
      })),
  ];
}

/**
 * What a property's value editor needs, for the call at `at` in `source`: the
 * canvas (VisualEditor) and the code editor's "Add property" card build it
 * the same way.
 */
export function fieldContextFor({
  source,
  root,
  at,
  config,
  pagePaths = [],
  readOnly,
}: {
  source: string;
  root: CallExpr | undefined;
  at: number;
  config?: StudioConfig;
  pagePaths?: string[];
  readOnly: boolean;
}): FieldContext {
  return {
    source,
    config,
    bindings: bindingCompletions(source, at).map((item) => item.label),
    // state. and options. are the component's own declarations, which the
    // data scope (bindingCompletions) doesn't hold; the rest is its data.
    completeBinding: (prefix) => {
      const [head, ...rest] = prefix.split(".");
      if (rest.length === 1 && (head === "state" || head === "options")) {
        const names = !root ? [] : head === "state" ? declaredNames(root, "states") : declarationsOf(root, "options").map(nameOf);
        return names.map((name) => ({ label: head + "." + name, detail: head === "state" ? "State" : "Option" }));
      }
      return bindingCompletions(source, at, prefix);
    },
    suggestData: (word) => dataSuggestions(source, at, word),
    states: root ? declaredNames(root, "states") : [],
    actionOptions: root ? declarationsOf(root, "options").filter((item) => item.name === "ActionOption").map(nameOf) : [],
    stateTypes: root ? Object.fromEntries(declarationsOf(root, "states").map((item) => [nameOf(item), item.name])) : {},
    pagePaths,
    drivers: root ? driversOf(root, source) : [],
    readOnly,
  };
}
