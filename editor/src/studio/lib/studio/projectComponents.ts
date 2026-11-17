// Synced from Upskale Studio (upskaleapp/src/lib/studio/projectComponents.ts). Edit it there, then npm run sync.
import {
  childrenOf,
  lex,
  literalValue,
  parseSource,
  type Expr,
} from "./parser";
import {
  constructorRegistry,
  functionRegistry,
  type ReferenceEntry,
} from "./registry";
import { MAX_SOURCE_BYTES, sourceBytes, type StudioProject } from "./types";
import { validAppFiles } from "./appFiles";
import { variantChoices } from "./variants";
import { dataOptionType } from "./pageModel";
export const HEADER_NAME = "SharedHeader";
export function validateComponentName(
  name: string,
  sources: Record<string, string> = {},
): string {
  if (!/^[A-Z][A-Za-z0-9]{0,59}$/.test(name))
    return "Use a name starting with a capital letter, with letters and numbers only (up to 60 characters).";
  if (constructorRegistry.has(name) || functionRegistry.has(name))
    return "This name belongs to a built-in component. Select a built-in widget in the source and use Make unique instead.";
  if (Object.hasOwn(sources, name))
    return "A component with this name already exists.";
  if (Object.keys(sources).length >= 20)
    return "This project can have up to 20 components.";
  return "";
}
export function newComponentSource(name: string, description: string): string {
  return `Component(
  dsl: 1, id: "custom/${name.toLowerCase()}", name: ${JSON.stringify(name)}, kind: Kind.section,
  description: ${JSON.stringify(description)},
  options: [StringOption(name: "title", label: "Title", maxLength: 200, default: ${JSON.stringify(name)})],
  variants: [Variant(id: "default", label: "Default", build:
    Column(gap: Space.md, padding: Space.md, children: [
      Text(child: options.title, role: TextRole.heading, size: FontSize.xl),
    ])
  )],
)
`;
}
export function componentReferences(
  sources: Record<string, string> = {},
): Map<string, ReferenceEntry> {
  return new Map(
    Object.entries(sources).map(([name, source]) => {
      const root = parseSource(source).root;
      const options = root?.args.options;
      const parameters: Record<string, string> = { variant: "String" };
      const required: string[] = [];
      const variants =
        root?.args.variants?.type === "list"
          ? root.args.variants.items.filter(
              (item): item is Extract<Expr, { type: "call" }> =>
                item.type === "call" && item.name === "Variant",
            )
          : [];
      const examples: string[] = [];
      const allOptions = [
        ...(options?.type === "list" ? options.items : []),
        ...variants.flatMap((variant) =>
          variant.args.options?.type === "list"
            ? variant.args.options.items
            : [],
        ),
      ];
      for (const option of allOptions) {
        if (option.type !== "call") continue;
        const key = literalValue(option.args.name);
        if (typeof key !== "string") continue;
        if (Object.hasOwn(parameters, key)) continue;
        const value = literalValue(option.args.default);
        const example =
          typeof value === "string"
            ? JSON.stringify(value.slice(0, 80))
            : typeof value === "number" || typeof value === "boolean"
              ? String(value)
              : option.args.default?.type === "ref"
                ? option.args.default.name
                : undefined;
        if (example !== undefined && examples.length < 4)
          examples.push(`${key}: ${example}`);
        parameters[key] =
          (
            {
              StringOption: "String",
              NumberOption: "Number",
              BoolOption: "Bool",
              ColorOption: "Color",
              ComponentOption: "String",
              ActionOption: "Action",
            } as Record<string, string>
          )[option.name] ??
          // Data passed in: its type (Product, Store[]…).
          (option.name === "DataOption" ? (dataOptionType(option) ?? "Value") : "Value");
        if (option.name === "DataOption" && literalValue(option.args.required) === true) required.push(key);
      }
      return [
        name,
        {
          name,
          group: "Components",
          parameters,
          required,
          variants: variantChoices(variants),
          description: String(
            literalValue(root?.args.description) ?? "Project component",
          ),
          usage: `${name}(${examples.join(", ")})`,
        },
      ];
    }),
  );
}
export function headerBuild(args: Record<string, string> = {}): string {
  return `Column(gap: Space.md, padding: Space.md, children: [
    Button(label: ${args.brand ?? 'options.brand == "" ? store.name : options.brand'}, onTap: Navigate(to: Route.menu)),
    Row(gap: Space.sm, children: [
      Button(label: ${args.ordersLabel ?? "options.ordersLabel"}, onTap: Navigate(to: Route.orders)),
      Button(label: ${args.accountLabel ?? "options.accountLabel"}, onTap: Navigate(to: Route.account)),
      Button(label: ${args.cartLabel ?? "options.cartLabel"}, icon: Icons.cart, onTap: Navigate(to: Route.cart)),
    ]),
    Divider(color: Color.border),
  ])`;
}
export function sharedHeaderSource(): string {
  return `// Place SharedHeader() in any page, inside any layout. All elements below are editable.
Component(
  dsl: 1, id: "custom/shared-header", name: "SharedHeader", kind: Kind.navigation,
  description: "Editable brand, navigation buttons, spacing, colors and divider.",
  options: [
    StringOption(name: "brand", label: "Brand", maxLength: 200, default: ""),
    StringOption(name: "ordersLabel", label: "Orders label", maxLength: 200, default: "Orders"),
    StringOption(name: "accountLabel", label: "Account label", maxLength: 200, default: "Account"),
    StringOption(name: "cartLabel", label: "Cart label", maxLength: 200, default: "Cart"),
  ],
  // The store the customer chose and their cart: theirs, read live (Client).
  data: [
    Data(name: "store", from: Client.store(), fetch: "client", type: Store),
    Data(name: "cart", from: Client.cart(), fetch: "client", type: Cart),
  ],
  variants: [Variant(id: "default", label: "Default", build: ${headerBuild({ cartLabel: '"${options.cartLabel} (${cart.count})"' })})],
)
`;
}
function edits(
  source: string,
  changes: { from: number; to: number; text: string }[],
): string {
  for (const change of changes.sort((a, b) => b.from - a.from))
    source =
      source.slice(0, change.from) + change.text + source.slice(change.to);
  if (sourceBytes(source) > MAX_SOURCE_BYTES)
    throw new Error("This edit would exceed the 64 KB source limit.");
  return source;
}
export function placeComponent(
  source: string,
  name: string,
  position: "top" | "bottom",
  move = true,
  /** The call to place, when it's more than `Name()` (wired up: autoWire.ts). */
  snippet?: string,
): string {
  const root = parseSource(source).root;
  if (!root)
    throw new Error("Fix this page's syntax before placing a component.");
  const variants = root.args.variants;
  const changes: { from: number; to: number; text: string }[] = [];
  if (variants?.type === "list")
    for (const variant of variants.items) {
      if (variant.type !== "call" || !variant.args.build) continue;
      const build = variant.args.build;
      let call = snippet ?? `${name}()`;
      const removals: { from: number; to: number; text: string }[] = [];
      function visit(node: Expr) {
        if (node.type === "list" && move) {
          const matching = (item: Expr) =>
            item.type === "call" && item.name === name;
          const comma = (from: number, to: number) =>
            lex(source.slice(from, to), from).find(
              (token) => token.text === ",",
            );
          for (let index = 0; index < node.items.length; index++) {
            if (!matching(node.items[index])) {
              visit(node.items[index]);
              continue;
            }
            const first = index;
            while (
              index + 1 < node.items.length &&
              matching(node.items[index + 1])
            )
              index++;
            call = source.slice(node.items[first].from, node.items[first].to);
            let from = node.items[first].from,
              to = node.items[index].to;
            if (index + 1 < node.items.length)
              to = comma(to, node.items[index + 1].from)?.to ?? to;
            else if (first > 0)
              from = comma(node.items[first - 1].to, from)?.from ?? from;
            else to = comma(to, node.to)?.to ?? to;
            removals.push({ from, to, text: "" });
          }
          return;
        }
        if (node.type === "call" && node.name === name && move) {
          call = source.slice(node.from, node.to);
          removals.push({
            from: node.from,
            to: node.to,
            text: "Column(children: [])",
          });
          return;
        }
        childrenOf(node).forEach(visit);
      }
      visit(build);
      const body = edits(
        source.slice(build.from, build.to),
        removals.map((change) => ({
          ...change,
          from: change.from - build.from,
          to: change.to - build.from,
        })),
      );
      changes.push({
        from: build.from,
        to: build.to,
        text: `Column(gap: Space.md, children: [\n${position === "top" ? call + ",\n" + body : body + ",\n" + call}\n])`,
      });
    }
  if (!changes.length)
    throw new Error(
      "This page needs a variant with a build before placing a component.",
    );
  return edits(source, changes);
}
/** Preserve legacy header edits while replacing implicit shell rendering with explicit calls. */
export function ensurePlacedHeader<T extends StudioProject>(project: T): T {
  if (
    !project.pages ||
    !project.shellSource ||
    Object.hasOwn(project.componentSources ?? {}, HEADER_NAME)
  )
    return project;
  try {
    const root = parseSource(project.shellSource).root;
    if (!root) return project;
    const changes: { from: number; to: number; text: string }[] = [];
    function visit(node: Expr) {
      if (node.type === "call" && node.name === "StoreHeader") {
        const args = Object.fromEntries(
          Object.entries(node.args).map(([key, value]) => [
            key,
            project.shellSource!.slice(value.from, value.to),
          ]),
        );
        changes.push({
          from: node.from,
          to: node.to,
          text: headerBuild({
            brand: "store.name",
            ordersLabel: '"Orders"',
            accountLabel: '"Account"',
            cartLabel: '"Cart"',
            ...args,
          }),
        });
      } else childrenOf(node).forEach(visit);
    }
    visit(root);
    const header = edits(project.shellSource, changes);
    const pages = project.pages.map((page) => ({
      ...page,
      source: lex(page.source).some(
        (token) => token.kind === "name" && token.text === HEADER_NAME,
      )
        ? page.source
        : placeComponent(page.source, HEADER_NAME, "top", false),
    }));
    const next = {
      ...project,
      pages,
      shellSource: header,
      componentSources: { ...project.componentSources, [HEADER_NAME]: header },
      source:
        pages.find((page) => page.id === project.entryPageId)?.source ??
        project.source,
    };
    return validAppFiles(next) ? next : project;
  } catch {
    return project;
  }
}
