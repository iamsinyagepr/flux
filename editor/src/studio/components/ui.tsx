// flux dev's stand-in for Studio's UI barrel (upskaleapp/src/components/ui):
// the four pieces its synced dialogs use, with the same classes (Tailwind
// builds them from these files too), and plain links where Studio routes.
// The real barrel re-exports the console's routed pieces, which stay there.
import type { MouseEventHandler, ReactNode } from "react";

export interface ButtonProps {
  children: ReactNode;
  to?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "quiet" | "danger";
  disabled?: boolean;
  className?: string;
}

export function Button({ children, to, href, onClick, type = "button", variant = "primary", disabled, className = "" }: ButtonProps) {
  const base =
    "lift inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 " +
    "text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";
  const look = {
    primary: "bg-ink text-on-ink hover:bg-ink-hover",
    secondary: "border border-hairline bg-surface text-ink hover:border-steel",
    quiet: "text-steel hover:text-ink",
    danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15",
  }[variant];
  const cls = `${base} ${look} ${className}`;
  const link = to ?? href;
  if (link)
    return (
      <a href={link} className={cls}>
        {children}
      </a>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-hairline bg-surface p-6 ${className}`}>{children}</div>;
}

/** The upward vector from the logo. */
export function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`inline-block h-[1em] w-[1em] ${className}`}>
      <path d="M5 19 19 5M19 5h-9M19 5v9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BackLink({ children, to, onClick, className = "" }: { children: ReactNode; to?: string; onClick?: () => void; className?: string }) {
  const cls = `inline-flex items-center gap-1.5 text-sm font-medium text-steel hover:text-ink ${className}`;
  return to ? (
    <a href={to} className={cls}>
      ← {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      ← {children}
    </button>
  );
}
