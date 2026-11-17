// Synced from Upskale Studio (upskaleapp/src/lib/studio/navigateCard.ts). Edit it there, then npm run sync.
// A Navigate's info card section (editorHover.ts): the search params of the
// page it opens. On its own, so it's testable without the editor.
import { childrenOf, literalValue, parseSource, type CallExpr, type Expr } from "./parser";
import { resolvePreviewTarget } from "./previewRoute";
import type { StudioPage } from "./types";

type HoverPage = Pick<StudioPage, "id" | "name" | "path" | "search">;
/** The project's pages, for a Navigate's card: the search params of where it goes. */
let hoverPages: HoverPage[] = [];
export function setHoverPages(pages: HoverPage[] | undefined) {
  hoverPages = pages ?? [];
}
export const currentHoverPages = () => hoverPages;

/** The Navigate the cursor is in: the smallest one around it. */
export function navigateAt(source: string, pos: number): CallExpr | undefined {
  const root = parseSource(source).root;
  let found: CallExpr | undefined;
  const visit = (expr: Expr) => {
    if (pos < expr.from || pos > expr.to) return;
    if (expr.type === "call" && expr.name === "Navigate") found = expr;
    childrenOf(expr).forEach(visit);
  };
  if (root) visit(root);
  return found;
}

/**
 * A Navigate's search params, for its card: those of the page its to: opens
 * (each with its type and default, and whether this Navigate gives it), or,
 * while it opens none yet, every page's that has some.
 */
export function navigateSearchCard(
  call: CallExpr | undefined,
  pages: HoverPage[],
  /** What it's built with: the page's document. */
  doc: Pick<Document, "createElement"> = document,
): HTMLElement | undefined {
  const section = doc.createElement("div");
  section.className = "cdsl-hover-search";
  const add = (tag: string, text: string, parent: HTMLElement = section) => {
    const element = doc.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  };
  const to = call?.args.to;
  const target = to?.type === "ref" ? to.name : typeof literalValue(to) === "string" ? String(literalValue(to)) : "";
  const destination = target ? resolvePreviewTarget(target, pages) : null;
  const page = destination ? pages.find((item) => item.id === destination.pageId) : undefined;
  const given = call?.args.search?.type === "call" ? Object.keys(call.args.search.args) : [];
  if (page) {
    add("h4", `Search params of ${page.name} (${page.path})`);
    if (!page.search?.length) {
      add("p", `${page.name} declares none: add them to its Route(search: Search(…)).`);
      return section;
    }
    const table = add("table", "");
    const head = add("tr", "", add("thead", "", table));
    ["Param", "Type", "Default", "Given"].forEach((label) => add("th", label, head));
    const body = add("tbody", "", table);
    for (const param of page.search) {
      const row = add("tr", "", body);
      add("code", param.name, add("td", "", row));
      add("td", param.type, row);
      add("td", param.default === undefined ? "—" : JSON.stringify(param.default), row);
      add("td", given.includes(param.name) ? "Yes" : "No", row);
    }
    const unknown = given.filter((name) => !page.search!.some((param) => param.name === name));
    if (unknown.length) add("p", `Not ${page.name}'s: ${unknown.join(", ")}.`);
    return section;
  }
  const withSearch = pages.filter((item) => item.search?.length);
  if (!withSearch.length) return undefined;
  add("h4", "Pages' search params");
  const list = add("ul", "");
  for (const item of withSearch)
    add("li", `${item.path}: ${item.search!.map((param) => param.name + " (" + param.type + ")").join(", ")}`, list);
  return section;
}

