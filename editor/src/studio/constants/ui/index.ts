// Synced from Upskale Studio (upskaleapp/src/constants/ui/index.ts). Edit it there, then npm run sync.
/**
 * The logo's shapes, in images/brand/logo.png's own pixels (measured from it):
 * the U's body, the arrowhead over its right arm, and the shading that folds
 * the ribbon. console.html and index.html draw the same paths in their loading
 * animation — change one, change the other. scripts/generate-icons.mjs reads
 * them from here for the app icons.
 */
export const LOGO_VIEWBOX = '316 182 664 634';
export const LOGO_BODY =
  'M330 302H431A100 100 0 0 1 531 402V612A85.5 85.5 0 0 0 702 612V380H903V520A291.5 291.5 0 0 1 320 520V312A10 10 0 0 1 330 302Z';
export const LOGO_HEAD = 'M640 386H961Q975 386 967 375L833 195Q820 180 806 195L633 375Q622 386 640 386Z';
export const LOGO_FOLD = 'M320 455C360 640 470 760 560 806A291.5 291.5 0 0 1 320 520Z';
export const LOGO_BACK = 'M702 655C740 580 790 470 835 405Q850 386 880 386H702Z';

/** A text input's chrome, for a form field that isn't a `Field` (a select, a
 *  textarea, a password with a show button). Add one of the two below for the
 *  border. */
export const fieldInputClass =
  'mt-1.5 w-full rounded-xl border bg-canvas px-3 py-1.5 text-[13px] outline-none transition-colors placeholder:text-steel/70 focus:bg-surface focus:ring-4 disabled:opacity-60';
export const fieldOkClass = 'border-hairline focus:border-accent focus:ring-accent/10';
export const fieldErrorClass = 'border-danger focus:ring-danger/10';
/** A field's label text. */
export const fieldLabelClass = 'text-[13px] font-medium';
