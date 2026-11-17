// Synced from Upskale Studio (upskaleapp/src/console/functions/select/index.ts). Edit it there, then npm run sync.
import { type ReactNode, Children, isValidElement, type ReactElement, Fragment } from "react";
import { type SelectOption } from "../../../components/studio/StudioSelect";

/** The options a select's children describe, groups flattened with their label. */
export function optionsOf(children: ReactNode, group?: string): SelectOption[] {
  const found: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{ children?: ReactNode; value?: string | number; label?: string; disabled?: boolean }>;
    if (element.type === Fragment) found.push(...optionsOf(element.props.children, group));
    else if (element.type === 'optgroup') found.push(...optionsOf(element.props.children, element.props.label));
    else if (element.type === 'option') {
      const label = textOf(element.props.children);
      found.push({ value: String(element.props.value ?? label), label, group, disabled: element.props.disabled });
    }
  });
  return found;
}

export function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}
