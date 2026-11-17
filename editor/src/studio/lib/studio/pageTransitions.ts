// Synced from Upskale Studio (upskaleapp/src/lib/studio/pageTransitions.ts). Edit it there, then npm run sync.
/**
 * How a page is entered: Config's default for the whole app, or a page's
 * own. The preview (PreviewPane) and the generated app's routes
 * (flutterProject.ts) both follow enterTransition, so they agree.
 */
export const pageTransitions = ["platform", "none", "fade", "slideUp", "slideLeft"] as const;
export type PageTransition = (typeof pageTransitions)[number];

export const pageTransitionLabels: Record<PageTransition, string> = {
  platform: "Platform default",
  none: "None",
  fade: "Fade",
  slideUp: "Slide up",
  slideLeft: "Slide in from the side",
};

export const validPageTransition = (value: unknown): value is PageTransition =>
  typeof value === "string" && (pageTransitions as readonly string[]).includes(value);

/** A page's app bar and bottom navigation: the components its Scaffold places. */
export function pageBars(source: string | undefined): [appBar: string, bottom: string] {
  return [
    /Scaffold\(\s*appBar:\s*([A-Za-z_]\w*)\(/.exec(source ?? "")?.[1] ?? "",
    /bottomNavigationBar:\s*([A-Za-z_]\w*)\(/.exec(source ?? "")?.[1] ?? "",
  ];
}

/** Whether two pages share their app bar or bottom navigation. */
export function sharesBar(from: string | undefined, to: string | undefined): boolean {
  const [a, b] = [pageBars(from), pageBars(to)];
  return (!!a[0] && a[0] === b[0]) || (!!a[1] && a[1] === b[1]);
}

/**
 * The transition into `to` from `from`. Between pages sharing a bar there
 * is none, so the bar stays still, unless the page sets its own.
 */
export function enterTransition(
  defaultTransition: PageTransition | undefined,
  from: { source?: string } | undefined,
  to: { source?: string; transition?: PageTransition },
): PageTransition {
  if (!to.transition && from && sharesBar(from.source, to.source)) return "none";
  return to.transition ?? defaultTransition ?? "platform";
}
