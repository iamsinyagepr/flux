// Synced from Upskale Studio (upskaleapp/src/lib/studio/sourceTree.ts). Edit it there, then npm run sync.
import {
  parseSource,
  literalValue,
  childrenOf,
  type Expr,
  type CallExpr,
} from "./parser";
import { constructorRegistry } from "./registry";
export interface SourceSelection {
  documentId: string;
  from: number;
  to: number;
}
export interface SourceTreeNode extends SourceSelection {
  id: string;
  label: string;
  kind: "section" | "widget" | "option" | "state" | "part";
  focusTo: number;
  children: SourceTreeNode[];
  componentName?: string;
}
const widgetGroups = new Set([
  "Layout",
  "Content",
  "Behavior",
  "Composition",
  "Storefront",
  "Storefront controls",
  "Forms",
  "Library",
]);
export function sourceTree(
  source: string,
  documentId: string,
  components: Iterable<string> = [],
): SourceTreeNode[] {
  const root = parseSource(source).root;
  if (!root) return [];
  const names = new Set(components);
  const make = (
    expr: Expr,
    path: string,
    label: string,
    kind: SourceTreeNode["kind"],
    children: SourceTreeNode[] = [],
  ): SourceTreeNode => ({
    documentId,
    id: documentId + ":" + path + ":" + expr.from,
    from: expr.from,
    to: expr.to,
    focusTo:
      expr.type === "call" ? expr.from + expr.name.length : expr.from + 1,
    label,
    kind,
    children,
  });
  let count = 0;
  function layout(expr: Expr | undefined, path: string): SourceTreeNode[] {
    if (!expr || ++count > 2500) return [];
    if (expr.type === "call") {
      const entry = constructorRegistry.get(expr.name);
      const widget =
        names.has(expr.name) ||
        widgetGroups.has(entry?.group ?? "") ||
        expr.name === "Part";
      const nested = Object.entries(expr.args).flatMap(([key, value]) =>
        layout(value, path + "/" + key),
      );
      if (!widget) return nested;
      const label =
        literalValue(expr.args.label) ??
        literalValue(expr.args.name) ??
        literalValue(expr.args.child);
      const item = make(
        expr,
        path,
        expr.name +
          (typeof label === "string" && label
            ? " \u00b7 " + label.slice(0, 45)
            : ""),
        "widget",
        nested,
      );
      if (names.has(expr.name) || entry?.group === "Storefront")
        item.componentName = expr.name;
      return [item];
    }
    return childrenOf(expr).flatMap((child, index) =>
      layout(child, path + "/" + index),
    );
  }
  const items = (expr: Expr | undefined) =>
    expr?.type === "list" ? expr.items : [];
  const group = (key: string, title: string, children: SourceTreeNode[]) => {
    const expr = root.args[key];
    return expr ? [make(expr, key, title, "section", children)] : [];
  };
  // A Page's build is its outline; a component's, each variant's.
  const outline = (root.name === "Page" && root.args.build
    ? [{ type: "call", name: "Variant", args: { build: root.args.build, label: { type: "literal", value: "Page", from: root.args.build.from, to: root.args.build.from } }, positional: [], from: root.args.build.from, to: root.args.build.to } as Expr]
    : items(root.args.variants)
  ).flatMap((variant, index) =>
    variant.type === "call"
      ? [
          make(
            variant,
            "variant/" + index,
            String(
              literalValue(variant.args.label) ??
                literalValue(variant.args.id) ??
                "Default",
            ),
            "section",
            layout(variant.args.build, "outline/" + index),
          ),
        ]
      : [],
  );
  const declarations = (key: string, kind: "option" | "state" | "part") =>
    items(root.args[key]).flatMap((expr, index) =>
      expr.type === "call"
        ? [
            make(
              expr,
              key + "/" + index,
              String(
                literalValue(expr.args.name) ??
                  literalValue(expr.args.id) ??
                  expr.name,
              ),
              kind,
              kind === "part"
                ? layout(expr.args.build, key + "/" + index + "/build")
                : [],
            ),
          ]
        : [],
    );
  const calls: CallExpr[] = [];
  function references(expr: Expr) {
    if (
      expr.type === "call" &&
      (names.has(expr.name) ||
        constructorRegistry.get(expr.name)?.group === "Storefront")
    )
      calls.push(expr);
    childrenOf(expr).forEach(references);
  }
  if (root.args.variants) references(root.args.variants);
  if (root.name === "Page" && root.args.build) references(root.args.build);
  const used = calls.map((call, index) => ({
    ...make(call, "components/" + index, call.name, "widget"),
    componentName: call.name,
  }));
  const content = root.name === "Page" ? "build" : "variants";
  return [
    ...(root.args[content] ? [make(root.args[content], content, "Outline", "section", outline)] : []),
    ...group("options", "Options", declarations("options", "option")),
    ...group("states", "States", declarations("states", "state")),
    ...group("parts", "Parts", declarations("parts", "part")),
    // References use the variant range for navigation but never win cursor selection.
    ...(root.args[content]
      ? [make(root.args[content], "components", "Components", "section", used)]
      : []),
  ];
}
export function sourceTreeAt(
  nodes: SourceTreeNode[],
  position: number,
): SourceTreeNode | undefined {
  let found: SourceTreeNode | undefined;
  for (const node of nodes) {
    if (position >= node.from && position < node.to) {
      if (!found || node.to - node.from < found.to - found.from) found = node;
      const child = sourceTreeAt(node.children, position);
      if (child && (!found || child.to - child.from < found.to - found.from))
        found = child;
    }
  }
  return found;
}
export function treePath(nodes: SourceTreeNode[], id: string): string[] {
  for (const node of nodes) {
    if (node.id === id) return [node.id];
    const path = treePath(node.children, id);
    if (path.length) return [node.id, ...path];
  }
  return [];
}
