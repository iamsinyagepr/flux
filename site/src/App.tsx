import { DocsShell, Layout } from "./components/Layout";
import { DOC_PAGES } from "./routes/Docs";
import { Home } from "./routes/Home";
import { Reference } from "./routes/Reference";
import { HOME, pageFor, type Page } from "./pages";

const NOT_FOUND: Page = { path: "/404", title: "Not found | Flux", description: "There's no page at this address." };

export function App({ path }: { path: string }) {
  const page = pageFor(path) ?? NOT_FOUND;
  let body;
  if (page === HOME) body = <Home />;
  else if (page.path === "/docs/reference")
    body = (
      <DocsShell page={page}>
        <Reference />
      </DocsShell>
    );
  else if (DOC_PAGES[page.path]) {
    const Doc = DOC_PAGES[page.path];
    body = (
      <DocsShell page={page}>
        <Doc />
      </DocsShell>
    );
  } else
    body = (
      <div className="wrap prose" style={{ paddingTop: 64 }}>
        <h1>Not found</h1>
        <p className="intro">There's no page at this address.</p>
        <p>
          <a href="/docs">Go to the docs</a>
        </p>
      </div>
    );
  return <Layout page={page}>{body}</Layout>;
}
