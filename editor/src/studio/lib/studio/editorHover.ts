// Synced from Upskale Studio (upskaleapp/src/lib/studio/editorHover.ts). Edit it there, then npm run sync.
import { hoverTooltip } from "@codemirror/view";
import type { ReferenceEntry } from "./registry";
import { referenceAt } from "./editorReference";
import { currentHoverPages, navigateAt, navigateSearchCard } from "./navigateCard";
export { setHoverPages } from "./navigateCard";
export function referenceCard(entry: ReferenceEntry, extra?: HTMLElement): HTMLElement {
  const card = document.createElement("div");
  card.className = "cdsl-hover-card";
  card.setAttribute("role", "tooltip");
  card.setAttribute("aria-label", `${entry.name} reference`);
  const add = (tag: string, text: string, parent: HTMLElement = card) => {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  };
  const heading = add("div", "");
  heading.className = "cdsl-hover-heading";
  add("h3", entry.name, heading);
  add("small", entry.group, heading);
  add("p", entry.description);
  add("h4", "Parameters");
  if (Object.keys(entry.parameters).length) {
    const table = add("table", "");
    const head = add("tr", "", add("thead", "", table));
    ["Parameter", "Type", "Required"].forEach((label) =>
      add("th", label, head),
    );
    const body = add("tbody", "", table);
    for (const [name, type] of Object.entries(entry.parameters)) {
      const row = add("tr", "", body);
      add("code", name, add("td", "", row));
      add("td", type, row);
      add("td", entry.required.includes(name) ? "Yes" : "Optional", row);
    }
  } else add("p", "No parameters.");
  if (extra) card.append(extra);
  add("h4", "Usage");
  add("code", entry.usage, add("pre", ""));
  return card;
}
export function referenceHover(
  registry: (
    view: import("@codemirror/view").EditorView,
  ) => ReadonlyMap<string, ReferenceEntry>,
  current: (view: import("@codemirror/view").EditorView) => string | undefined,
) {
  return hoverTooltip(
    (view, pos, side) => {
      const reference = referenceAt(
        view.state.doc.toString(),
        pos,
        side,
        registry(view),
        current(view),
      );
      return reference
        ? {
            pos: reference.from,
            end: reference.to,
            above: true,
            create: () => ({
              dom: referenceCard(
                reference.entry,
                reference.entry.name === "Navigate"
                  ? navigateSearchCard(navigateAt(view.state.doc.toString(), pos), currentHoverPages())
                  : undefined,
              ),
            }),
          }
        : null;
    },
    { hoverTime: 300, hideOnChange: true },
  );
}
