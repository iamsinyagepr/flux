// Synced from Upskale Studio (upskaleapp/src/lib/studio/formRuntime.ts). Edit it there, then npm run sync.
export type InputValue = string | number | boolean | null;
export interface FieldRules {
  label: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}
export function validInputName(name: string): boolean {
  return (
    /^[A-Za-z_][A-Za-z0-9_]{0,59}$/.test(name) &&
    !["__proto__", "constructor", "prototype"].includes(name)
  );
}
export function validateField(
  value: InputValue,
  rules: FieldRules,
): string | undefined {
  if (rules.disabled) return;
  const empty =
    value === null ||
    value === "" ||
    (typeof value === "string" && !value.trim());
  if (rules.required && (empty || value === false))
    return `${rules.label} is required.`;
  if (empty) return;
  if (
    rules.type === "number" &&
    (typeof value !== "number" || !Number.isFinite(value))
  )
    return `Enter a number for ${rules.label}.`;
  if (typeof value === "number") {
    if (rules.min !== undefined && value < rules.min)
      return `${rules.label} must be at least ${rules.min}.`;
    if (rules.max !== undefined && value > rules.max)
      return `${rules.label} must be at most ${rules.max}.`;
  }
  if (typeof value === "string") {
    if (rules.minLength !== undefined && value.length < rules.minLength)
      return `${rules.label} needs at least ${rules.minLength} characters.`;
    if (rules.maxLength !== undefined && value.length > rules.maxLength)
      return `${rules.label} allows at most ${rules.maxLength} characters.`;
    if (rules.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "Enter a valid email address.";
    if (rules.type === "url") {
      try {
        const url = new URL(value);
        if (!["http:", "https:"].includes(url.protocol))
          return "Enter an HTTP(S) URL.";
      } catch {
        return "Enter a valid URL.";
      }
    }
  }
}
function fieldValue(item: unknown, field: string): unknown {
  let value = item;
  for (const part of field.split(".").slice(0, 6)) {
    if (
      ["__proto__", "constructor", "prototype"].includes(part) ||
      !value ||
      typeof value !== "object" ||
      !Object.hasOwn(value, part)
    )
      return null;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
const normalise = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function searchRecords<T>(
  items: T[],
  query: unknown,
  fields: unknown,
): T[] {
  if (!Array.isArray(items)) return [];
  const terms = normalise(String(query ?? "").slice(0, 500))
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const keys = Array.isArray(fields)
    ? fields
        .filter((field): field is string => typeof field === "string")
        .slice(0, 10)
    : [];
  return items.slice(0, 200).filter((item) => {
    if (!terms.length) return true;
    const values =
      typeof item === "string"
        ? [item]
        : keys.map((key) => fieldValue(item, key));
    const text = normalise(
      values
        .flatMap((value) =>
          Array.isArray(value)
            ? value.filter((part) => typeof part === "string")
            : typeof value === "string" || typeof value === "number"
              ? [String(value)]
              : [],
        )
        .join(" ")
        .slice(0, 16000),
    );
    return terms.every((term) => text.includes(term));
  });
}
export function filterRecords<T>(
  items: T[],
  field: unknown,
  value: unknown,
): T[] {
  return Array.isArray(items) && typeof field === "string"
    ? items.slice(0, 200).filter((item) => fieldValue(item, field) === value)
    : [];
}
