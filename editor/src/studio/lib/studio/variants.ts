// Synced from Upskale Studio (upskaleapp/src/lib/studio/variants.ts). Edit it there, then npm run sync.
import { literalValue, parseSource, type CallExpr } from "./parser";

export interface VariantChoice {
  id: string;
  label: string;
}
export function variantChoices(variants: CallExpr[]): VariantChoice[] {
  return variants.map((variant) => ({
    id: String(literalValue(variant.args.id) ?? ""),
    label: String(
      literalValue(variant.args.label) ?? literalValue(variant.args.id) ?? "",
    ),
  }));
}
export function resolveVariant(
  variants: CallExpr[],
  requested: unknown,
): CallExpr | undefined {
  if (requested == null) return variants[0];
  const match = variants.find(
    (variant) => literalValue(variant.args.id) === requested,
  );
  if (!match) throw new Error("Unknown variant: " + String(requested));
  return match;
}
export function editingVariantAt(
  source: string,
  position: number,
): { id: string; variantCount: number } | undefined {
  const root = parseSource(source).root;
  const variants =
    root?.args.variants?.type === "list"
      ? root.args.variants.items.filter(
          (item): item is CallExpr =>
            item.type === "call" && item.name === "Variant",
        )
      : [];
  const variant = variants.find(
    (item) => position >= item.from && position <= item.to,
  );
  const id = literalValue(variant?.args.id);
  return typeof id === "string"
    ? { id, variantCount: variants.length }
    : undefined;
}
