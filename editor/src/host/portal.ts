// Where the editors' menus and cards portal to: the overlay's own root in its
// shadow DOM, so they get its styles and the page's styles don't reach them.
let root: HTMLElement | undefined;

export function setPortalRoot(element: HTMLElement): void {
  root = element;
}

export function portalRoot(): HTMLElement {
  return root ?? document.body;
}
