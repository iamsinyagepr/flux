// Synced from Upskale Studio (upskaleapp/src/lib/studio/pageModel.ts). Edit it there, then npm run sync.
import { bindingFields } from "./dataBindings";
import { literalValue, type CallExpr } from "./parser";

/**
 * Pages and components, as Flux has them now:
 *
 *   Page(name: "Dish", route: Route(...), data: [...], seo: Seo(...),
 *        states: [...], build: Scaffold(...))
 *
 * is a page file's root: one build, no variants, options, description, kind
 * or dsl. A Component is a reusable piece: variants and options, never a
 * route or data of its own; what it shows of a page's data reaches it
 * through a typed option,
 *
 *   options: [DataOption(name: "product", type: Product, required: true)]
 *
 * read as options.product.name, and passed where it's used:
 * ProductCard(product: dish).
 */

/**
 * A Page's build as the one variant it has: what the preview and the
 * compilers read a component's variants for, so they read a page the same
 * way. It sits exactly where the build is in the source.
 */
export function pageVariant(root: CallExpr): CallExpr | undefined {
  const build = root.args.build;
  if (!build) return undefined;
  const at = { from: build.from, to: build.from };
  return {
    type: "call",
    name: "Variant",
    args: {
      id: { type: "literal", value: "page", ...at },
      label: { type: "literal", value: "Page", ...at },
      build,
    },
    positional: [],
    from: build.from,
    to: build.to,
  };
}

/**
 * A DataOption's type as the bindings name it ("Product", "Store[]" with
 * list: true), or undefined for any other option, or a type that isn't one
 * of the API's.
 */
export function dataOptionType(option: CallExpr): string | undefined {
  if (option.name !== "DataOption") return undefined;
  const type = option.args.type;
  if (type?.type !== "ref" || type.name.includes(".") || !/^[A-Z]/.test(type.name)) return undefined;
  if (!Object.keys(bindingFields(type.name)).length) return undefined;
  return literalValue(option.args.list) === true ? type.name + "[]" : type.name;
}
