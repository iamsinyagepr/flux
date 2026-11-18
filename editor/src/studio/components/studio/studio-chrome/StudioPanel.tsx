// Synced from Upskale Studio (upskaleapp/src/components/studio/studio-chrome/StudioPanel.tsx). Edit it there, then npm run sync.
import { type ReactNode, useId, useRef, useEffect } from "react";

/**
 * A workspace view that replaces the editor body rather than floating over
 * it — the same frame the Flutter code review uses, so every view reached from
 * the workspace navigation reads as a tab of the editor, not a popup.
 */
export function StudioPanel({
  title,
  description,
  onClose,
  children,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    // Keep what the modals gave keyboard users: focus moves into the view,
    // Escape leaves it, and focus returns to whatever opened it.
    const previous = document.activeElement as HTMLElement | null;
    const panel = heading.current?.closest("section");
    // Unless the view has already put focus somewhere more useful (Docs
    // focuses its search).
    if (!panel?.contains(document.activeElement)) heading.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // A real dialog opened from inside the view handles its own Escape.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas text-ink"
    >
      {/* The store page's head (SectionHead): title and description on the
          left, actions and the way back on the right — on the same canvas. */}
      <header className="studio-panel-head flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <h1
            ref={heading}
            id={titleId}
            tabIndex={-1}
            className="text-2xl font-semibold outline-none"
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-steel">
              {description}
            </p>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-4">
          {actions}
        </div>
      </header>
      <div className={`studio-panel ${className}`}>{children}</div>
    </section>
  );
}
