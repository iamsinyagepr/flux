// Synced from Upskale Studio (upskaleapp/src/console/constants/studio/studio-select/index.ts). Edit it there, then npm run sync.
/**
 * The class names of each look. Studio's live in studio.css (only loaded on
 * Studio's pages); the console's are Tailwind, so they work everywhere.
 */
export const LOOKS = {
  studio: {
    button: "studio-select",
    value: "studio-select-value",
    list: "studio-select-list",
    search: "studio-context-menu-search",
    section: "studio-context-menu-section",
    empty: "studio-context-menu-empty",
    option: "studio-select-option",
    active: " is-active",
  },
  console: {
    button:
      "inline-flex min-w-0 items-center justify-between gap-2 text-left transition-colors hover:border-steel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 aria-expanded:border-accent disabled:cursor-default disabled:opacity-55",
    value: "min-w-0 truncate",
    list: "fixed z-[120] max-h-[300px] max-w-[min(360px,calc(100vw-16px))] overflow-y-auto rounded-xl border border-hairline bg-surface p-1.5 text-sm text-ink shadow-[0_12px_32px_color-mix(in_srgb,var(--color-slate)_20%,transparent)] [&_[role=listbox]]:outline-none",
    search:
      "mb-1.5 flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-steel focus-within:border-accent [&_input]:min-w-0 [&_input]:flex-1 [&_input]:bg-transparent [&_input]:text-sm [&_input]:text-ink [&_input]:outline-none",
    section: "px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-steel",
    empty: "px-2.5 py-2 text-steel",
    option:
      "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 aria-selected:font-semibold aria-disabled:cursor-default aria-disabled:opacity-45 [&_small]:ml-auto [&_small]:shrink-0 [&_small]:text-xs [&_small]:font-normal [&_small]:text-steel",
    active: " bg-canvas",
  },
};
