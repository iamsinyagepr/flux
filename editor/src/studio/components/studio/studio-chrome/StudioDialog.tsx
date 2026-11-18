// Synced from Upskale Studio (upskaleapp/src/components/studio/studio-chrome/StudioDialog.tsx). Edit it there, then npm run sync.
import { portalRoot } from "../../../../host/portal";
import { type ReactNode, useRef, useId, useEffect } from "react";
import { createPortal } from "react-dom";
import { MdClose } from "react-icons/md";

/** Native dialog provides focus trapping, Escape and focus restoration. */
export function StudioDialog({
  title,
  description,
  onClose,
  children,
  wide = false,
  drawer = false,
  className = "",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Slides in from the right, the screen's full height: settings beside the work. */
  drawer?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={`studio-dialog${wide ? " studio-dialog-wide" : ""}${drawer ? " studio-dialog-drawer" : ""} ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="studio-dialog-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          className="studio-icon-button"
          type="button"
          aria-label={drawer ? "Close" : "Close dialog"}
          onClick={onClose}
        >
          <MdClose />
        </button>
      </div>
      {children}
    </dialog>,
    portalRoot(),
  );
}
