import { useEffect, useState, type ReactNode } from "react";
import { DOCS, GITHUB, type Page } from "../pages";

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M10 23V9h12M10 16h8" fill="none" stroke="var(--accent-strong)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Theme = "light" | "dark" | "system";

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("flux-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* storage off: the system's theme */
    }
  }, []);
  const next: Record<Theme, Theme> = { system: "dark", dark: "light", light: "system" };
  const choose = () => {
    const value = next[theme];
    setTheme(value);
    if (value === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    try {
      if (value === "system") localStorage.removeItem("flux-theme");
      else localStorage.setItem("flux-theme", value);
    } catch {
      /* not remembered */
    }
  };
  return (
    <button type="button" onClick={choose} aria-label={`Theme: ${theme}. Switch to ${next[theme]}`} title={`Theme: ${theme}`}>
      {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"}
    </button>
  );
}

export function Layout({ page, children }: { page: Page; children: ReactNode }) {
  const inDocs = page.path.startsWith("/docs");
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="top">
        <div className="wrap">
          <a className="brand" href="/" aria-label="Flux home">
            <Mark />
            Flux
          </a>
          <nav className="nav" aria-label="Site">
            <a href="/docs" aria-current={inDocs ? "page" : undefined}>
              Docs
            </a>
            <a className="wide" href="/docs/reference" aria-current={page.path === "/docs/reference" ? "page" : undefined}>
              Reference
            </a>
            <a href={GITHUB}>GitHub</a>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="foot">
        <div className="wrap">
          <span>Flux is open source, under the MIT license. Made by Upskale Labs.</span>
          <nav aria-label="Footer">
            <a href="/docs">Docs</a>
            <a href="/docs/cli">CLI</a>
            <a href="/docs/editors">VS Code</a>
            <a href={GITHUB}>GitHub</a>
            <a href="https://upskalelabs.dev/products/studio">Upskale Studio</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

/** The docs' sidebar and the previous and next pages. */
export function DocsShell({ page, children }: { page: Page; children: ReactNode }) {
  const groups = [...new Set(DOCS.map((d) => d.group))];
  const at = DOCS.findIndex((d) => d.path === page.path);
  const prev = DOCS[at - 1];
  const next = DOCS[at + 1];
  return (
    <div className="wrap docs">
      <nav className="side" aria-label="Docs">
        {groups.map((group) => (
          <div key={group}>
            <h2>{group}</h2>
            <ul>
              {DOCS.filter((d) => d.group === group).map((d) => (
                <li key={d.path}>
                  <a href={d.path} aria-current={d.path === page.path ? "page" : undefined}>
                    {d.nav}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <article className="prose">
        {children}
        <nav className="pager" aria-label="Previous and next">
          {prev && (
            <a href={prev.path}>
              <small>Previous</small>
              {prev.nav}
            </a>
          )}
          {next && (
            <a className="next" href={next.path}>
              <small>Next</small>
              {next.nav}
            </a>
          )}
        </nav>
      </article>
    </div>
  );
}
