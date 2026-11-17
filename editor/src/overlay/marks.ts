// The website flux dev builds marks each widget with where it's written:
//
//   <span data-flx="home:120:188" style="display: contents">…the widget…</span>
//
// (web compiler, Marks). The span has no box of its own (display: contents),
// so a mark's box is the union of what it draws.
export interface Mark {
  documentId: string;
  from: number;
  to: number;
}

export const ATTRIBUTE = "data-flx";

export function parseMark(value: string | null): Mark | undefined {
  const match = value && /^(.*):(\d+):(\d+)$/.exec(value);
  if (!match) return undefined;
  return { documentId: match[1], from: Number(match[2]), to: Number(match[3]) };
}

export function markValue(mark: Mark): string {
  return `${mark.documentId}:${mark.from}:${mark.to}`;
}

/** The innermost marked element an event happened in, outside the overlay. */
export function markedElementAt(target: EventTarget | null): HTMLElement | undefined {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return (element?.closest(`[${ATTRIBUTE}]`) as HTMLElement | null) ?? undefined;
}

/** The marked element of the widget at mark, if it's on the page. */
export function elementFor(mark: Mark): HTMLElement | undefined {
  return (document.querySelector(`[${ATTRIBUTE}="${CSS.escape(markValue(mark))}"]`) as HTMLElement | null) ?? undefined;
}

/** The marked element around this one: the widget it's in. */
export function parentMarked(element: HTMLElement): HTMLElement | undefined {
  return markedElementAt(element.parentElement);
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** What a mark draws, on screen: the union of its contents' boxes. */
export function boxOf(element: HTMLElement): Box | undefined {
  const rects: DOMRect[] = [];
  const range = document.createRange();
  range.selectNodeContents(element);
  for (const rect of Array.from(range.getClientRects())) if (rect.width > 0 || rect.height > 0) rects.push(rect);
  if (!rects.length) return undefined;
  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const right = Math.max(...rects.map((r) => r.right));
  return { top, left, width: right - left, height: bottom - top };
}
