// Synced from Upskale Studio (upskaleapp/src/lib/studio/canvasPins.ts). Edit it there, then npm run sync.
/**
 * States and options just added from a menu, per document, so the canvas
 * shows them straight away rather than parking them in its dock (a new
 * declaration is linked to nothing yet). Ids are the canvas's: "state:x",
 * "option:x".
 */
const announced = new Map<string, Set<string>>();

export function announceDeclaration(document: string, list: "states" | "options" | "parts", name: string) {
  if (list === "parts") return;
  const ids = announced.get(document) ?? new Set<string>();
  ids.add((list === "states" ? "state:" : "option:") + name);
  announced.set(document, ids);
}

/** Of [present] ids, those just added in [document]; each is handed out once. */
export function takeAnnounced(document: string, present: Iterable<string>): string[] {
  const ids = announced.get(document);
  if (!ids) return [];
  const taken = [...present].filter((id) => ids.delete(id));
  if (!ids.size) announced.delete(document);
  return taken;
}
