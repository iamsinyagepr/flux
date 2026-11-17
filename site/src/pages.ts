/** Every page of the site, with its head. The prerender writes each one. */
export interface Page {
  path: string;
  title: string;
  description: string;
}

export interface DocPage extends Page {
  nav: string;
  group: string;
}

export const SITE = "https://flux.upskalelabs.dev";
export const GITHUB = "https://github.com/iamsinyagepr/flux";

export const HOME: Page = {
  path: "/",
  title: "Flux: one source, a website and an app",
  description:
    "Flux is a small, readable language for interfaces. Write a page once in .flx and compile it to a React website and a Flutter app, with a checker that says what's wrong and where.",
};

export const DOCS: DocPage[] = [
  { path: "/docs", nav: "Introduction", group: "Start", title: "Introduction | Flux", description: "What Flux is, what it compiles to, and how a project is laid out." },
  { path: "/docs/getting-started", nav: "Getting started", group: "Start", title: "Getting started | Flux", description: "Install the flux CLI, start a project, and run it." },
  { path: "/docs/language", nav: "Files and blocks", group: "Language", title: "Files and blocks | Flux", description: "A .flx file: its header, then usingServer, usingClient, State, Parts and Build." },
  { path: "/docs/data", nav: "Data", group: "Language", title: "Data | Flux", description: "Typed data from any API: usingServer, usingClient, Http(...) and providers." },
  { path: "/docs/routes", nav: "Routes and SEO", group: "Language", title: "Routes and SEO | Flux", description: "A page's route, its search params, and the head the website renders." },
  { path: "/docs/components", nav: "Components", group: "Language", title: "Components | Flux", description: "A project's own components: options, state, parts and variants." },
  { path: "/docs/expressions", nav: "Expressions", group: "Language", title: "Expressions | Flux", description: "Values, interpolation, conditions, lists and actions." },
  { path: "/docs/reference", nav: "Widget reference", group: "Language", title: "Widget reference | Flux", description: "Every widget, action, function and token family Flux knows, with its parameters." },
  { path: "/docs/cli", nav: "The CLI", group: "Tools", title: "The CLI | Flux", description: "flux new, check, build, dev, migrate and lsp." },
  { path: "/docs/targets", nav: "Targets", group: "Tools", title: "Targets | Flux", description: "What flux build makes: a React website, or a Flutter app." },
  { path: "/docs/providers", nav: "Providers", group: "Tools", title: "Providers | Flux", description: "Data sources beyond Http(...), and the Upskale provider." },
  { path: "/docs/editors", nav: "Editor support", group: "Tools", title: "Editor support | Flux", description: "The VS Code extension, and any editor that speaks LSP." },
  { path: "/docs/migrating", nav: "From CDSL", group: "More", title: "Migrating from CDSL | Flux", description: "Flux was CDSL: .cdsl files and Upskale Studio projects, moved over." },
  { path: "/docs/contributing", nav: "Contributing", group: "More", title: "Contributing | Flux", description: "How Flux is built and tested, and how to send a change." },
];

export const PAGES: Page[] = [HOME, ...DOCS];

export function pageFor(path: string): Page | undefined {
  const clean = path.replace(/\/+$/, "") || "/";
  return PAGES.find((p) => p.path === clean);
}
