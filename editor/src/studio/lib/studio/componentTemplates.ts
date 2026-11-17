// Synced from Upskale Studio (upskaleapp/src/lib/studio/componentTemplates.ts). Edit it there, then npm run sync.
import { STUDIO_EXAMPLES } from "./exampleSources";
import {
  childrenOf,
  lex,
  literalValue,
  parseSource,
  type Expr,
} from "./parser";
import {
  newComponentSource,
  validateComponentName,
  sharedHeaderSource,
} from "./projectComponents";
import { constructorRegistry, functionRegistry } from "./registry";
import {
  sourceBytes,
  MAX_SOURCE_BYTES,
  type ComponentKind,
  type StudioProject,
} from "./types";
export interface ComponentTemplate {
  id: string;
  title: string;
  description: string;
  author: string;
  kind: ComponentKind;
  origin: "starter" | "library";
  tags: string[];
  source: string;
  primaryName?: string;
  components?: Record<string, string>;
  blank?: boolean;
}
const section = (
  id: string,
  title: string,
  description: string,
  build: string,
  states = "",
) =>
  `Component(dsl: 1, id: "template/${id}", name: ${JSON.stringify(title)}, kind: Kind.section, description: ${JSON.stringify(description)}, states: [${states}], variants: [Variant(id: "default", label: "Default", build: ${build})])`;
export const componentStarters: ComponentTemplate[] = [
  {
    id: "blank",
    title: "Blank component",
    description: "Build your own reusable component from a clean canvas.",
    author: "Upskale",
    kind: "section",
    origin: "starter",
    tags: ["starter", "blank"],
    source: newComponentSource("BlankComponent", ""),
    blank: true,
  },
  ...STUDIO_EXAMPLES.filter(
    (item) => item.type === "component" && item.id !== "blank",
  ).map((item) => ({
    id: "example:" + item.id,
    title: item.name,
    description: item.description,
    author: "Upskale",
    kind: item.kind,
    origin: "starter" as const,
    tags: item.tags,
    source: item.source,
  })),
  {
    id: "product-grid",
    title: "Product grid",
    description: "A grid of products the page passes in: picture, name, price and a button to open each.",
    author: "Upskale",
    kind: "product-collection",
    origin: "starter",
    tags: ["menu", "products"],
    source: `Component(
  dsl: 1, id: "custom/product-grid", name: "ProductGrid", kind: Kind.productCollection,
  description: "A grid of products, passed in by the page (its products, from Tenant.products or a menu).",
  options: [
    DataOption(name: "products", type: Product, list: true, required: true),
    StringOption(name: "buttonLabel", label: "Button label", maxLength: 40, default: "Customise"),
    NumberOption(name: "columns", label: "Columns", min: 1, max: 4, default: 2),
  ],
  variants: [Variant(id: "default", label: "Default", build:
    Grid(cols: options.columns, gap: Space.md, children: [
      ForEach(items: options.products, as: "p", child: Box(background: Color.surface, radius: Radius.lg, padding: Space.md, child:
        Column(gap: Space.sm, children: [
          Image(src: p.image_url, alt: p.name, aspectRatio: 1.5),
          Text(child: p.name, weight: FontWeight.bold),
          Text(child: p.description, size: FontSize.sm, color: Color.textMuted),
          Text(child: formatMoney(p.display_price_cents)),
          Button(label: options.buttonLabel, disabled: !p.is_available, onTap: OpenProduct(product: p)),
        ])
      )),
    ])
  )],
)
`,
    primaryName: "ProductGrid",
  },
  {
    id: "shared-header",
    title: "Shared header",
    description: "Brand, navigation links and cart count in a reusable header.",
    author: "Upskale",
    kind: "navigation",
    origin: "starter",
    tags: ["navigation", "header"],
    source: sharedHeaderSource(),
    primaryName: "SharedHeader",
  },
  {
    id: "search-menu",
    title: "Search menu",
    description: "A search field connected to a product menu.",
    author: "Upskale",
    kind: "product-collection",
    origin: "starter",
    tags: ["search", "menu", "input"],
    source: `Component(
  dsl: 1, id: "starter/search-menu", name: "SearchMenu", kind: Kind.productCollection,
  description: "A search field over products the page passes in (its products, from Tenant.products or a menu).",
  options: [DataOption(name: "products", type: Product, list: true, required: true)],
  states: [StringState(name: "query", default: "")],
  variants: [Variant(id: "default", label: "Default", build:
    Column(gap: Space.md, children: [
      SearchField(state: "query", label: "Search menu", placeholder: "Find products"),
      ForEach(items: search(options.products, state.query, ["name", "description"]), as: "p", empty: Text(child: "Nothing matches."), child: Button(label: p.name, style: ButtonStyle.ghost, onTap: OpenProduct(product: p))),
    ])
  )],
)
`,
  },
  {
    id: "contact-form",
    title: "Contact form",
    description:
      "Name and email inputs with validation and submit/reset actions.",
    author: "Upskale",
    kind: "section",
    origin: "starter",
    tags: ["form", "input", "email"],
    source: section(
      "contact-form",
      "Contact form",
      "Validated contact form",
      'Form(id: "contact", onSubmit: ShowMessage(message: "Thanks, ${form.values.name}!"), child: Column(gap: Space.md, children: [TextField(name: "name", label: "Name", required: true), TextField(name: "email", label: "Email", type: InputType.email, required: true), Row(gap: Space.sm, children: [SubmitButton(label: "Send"), ResetButton(label: "Reset", style: ButtonStyle.ghost)])]))',
    ),
  },
];
export function libraryComponentTemplates(
  projects: StudioProject[],
  library: string[],
  draft: StudioProject,
): ComponentTemplate[] {
  const saved: ComponentTemplate[] = STUDIO_EXAMPLES.filter(
    (item) => library.includes(item.id) && !item.pages && item.id !== "blank",
  ).map((item) => ({
    id: "saved:" + item.id,
    title: item.name,
    description: item.description,
    author: "Saved example",
    kind: item.kind,
    origin: "library" as const,
    tags: item.tags,
    source: item.source,
  }));
  for (const project of [
    draft,
    ...projects.filter((item) => item.id !== draft.id),
  ]) {
    const sources = project.componentSources ?? {};
    if (!project.pages && project.id !== draft.id)
      saved.push({
        id: "project:" + project.id,
        title: project.name,
        description: project.description,
        author: "Your project / " + project.name,
        kind: "section",
        origin: "library",
        tags: ["project"],
        source: project.source,
        components: sources,
      } as ComponentTemplate);
    for (const [name, source] of Object.entries(sources)) {
      const root = parseSource(source).root;
      saved.push({
        id: `component:${project.id}:${name}`,
        title: name,
        description: String(
          literalValue(root?.args.description) ?? "Reusable project component",
        ),
        author:
          project.id === draft.id
            ? "This project"
            : "Your project / " + project.name,
        kind: "section",
        origin: "library",
        tags: ["component", project.name],
        source,
        components: sources,
        primaryName: name,
      } as ComponentTemplate);
    }
  }
  return saved.slice(0, 200);
}
export function suggestedTemplateName(
  title: string,
  sources: Record<string, string> = {},
): string {
  const base = (
    title
      .match(/[A-Za-z0-9]+/g)
      ?.map((word) => word[0].toUpperCase() + word.slice(1))
      .join("") || "NewComponent"
  )
    .replace(/^[^A-Z]+/, "Component")
    .slice(0, 50);
  let name = base,
    count = 2;
  while (
    constructorRegistry.has(name) ||
    functionRegistry.has(name) ||
    Object.hasOwn(sources, name)
  )
    name = base + count++;
  return name;
}
/** Import a dependency closure without replacing existing project definitions. */
export function instantiateComponentTemplate(
  template: ComponentTemplate,
  name: string,
  description: string,
  existing: Record<string, string> = {},
): Record<string, string> {
  const problem = validateComponentName(name, existing);
  if (problem) throw new Error(problem);
  if (template.blank) return { [name]: newComponentSource(name, description) };
  const dependencies = template.components ?? {},
    primary = template.primaryName ?? "#primary";
  const sources = new Map<string, string>(),
    visiting = new Set<string>();
  function collect(key: string, source: string) {
    if (visiting.has(key))
      throw new Error("This template has a cyclic component dependency.");
    if (sources.has(key)) return;
    const parsed = parseSource(source);
    if (!parsed.root || parsed.diagnostics.length)
      throw new Error("Fix this template's source before adding it.");
    visiting.add(key);
    function visit(node: Expr) {
      if (node.type === "call") {
        const nativeSelf = node.name === key && constructorRegistry.has(key);
        if (nativeSelf && Object.hasOwn(existing, key))
          throw new Error(
            `This template calls the built-in ${key}, which this project overrides.`,
          );
        if (!nativeSelf && Object.hasOwn(dependencies, node.name))
          collect(node.name, dependencies[node.name]);
      }
      childrenOf(node).forEach(visit);
    }
    visit(parsed.root);
    visiting.delete(key);
    sources.set(key, source);
  }
  collect(primary, template.source);
  const reserved = { ...existing, [name]: "" },
    names = new Map([[primary, name]]);
  for (const [key, source] of sources) {
    if (key === primary) continue;
    const mapped =
      existing[key] === source ? key : suggestedTemplateName(key, reserved);
    names.set(key, mapped);
    reserved[mapped] = source;
  }
  const created: Record<string, string> = {};
  for (const [key, source] of sources) {
    const mapped = names.get(key)!;
    if (key !== primary && existing[mapped] === source) continue;
    const root = parseSource(source).root!;
    const changes: { from: number; to: number; text: string }[] = [],
      missing: string[] = [];
    for (const [arg, value] of [
      ["id", "custom/" + mapped.toLowerCase()],
      ["name", mapped],
      ...(key === primary ? [["description", description]] : []),
    ]) {
      const expr = root.args[arg];
      if (expr) changes.push({ ...expr, text: JSON.stringify(value) });
      else missing.push(arg + ": " + JSON.stringify(value));
    }
    if (missing.length) {
      const from = lex(source).find(
        (token) => token.from > root.from && token.text === "(",
      )!.to;
      changes.push({ from, to: from, text: missing.join(", ") + ", " });
    }
    function rename(node: Expr) {
      if (
        node === root.args.id ||
        node === root.args.name ||
        (key === primary && node === root.args.description)
      )
        return;
      if (
        node.type === "call" &&
        names.has(node.name) &&
        !(node.name === key && constructorRegistry.has(key))
      )
        changes.push({
          from: node.from,
          to: node.from + node.name.length,
          text: names.get(node.name)!,
        });
      childrenOf(node).forEach(rename);
    }
    rename(root);
    let copy = source;
    for (const change of changes.sort((a, b) => b.from - a.from))
      copy = copy.slice(0, change.from) + change.text + copy.slice(change.to);
    if (sourceBytes(copy) > MAX_SOURCE_BYTES)
      throw new Error(
        "This template exceeds the 64 KB component source limit.",
      );
    created[mapped] = copy;
  }
  if (Object.keys({ ...existing, ...created }).length > 20)
    throw new Error("This project can have up to 20 components.");
  return created;
}
