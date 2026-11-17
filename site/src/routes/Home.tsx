import { useState } from "react";
import { Code } from "../components/Code";
import { GITHUB } from "../pages";

const EXAMPLE = `
Page(name: "Menu", route: Route(path: "/menu"), seo: Seo(title: "Today's menu"))

usingServer(
  dishes<Json>(src: Http(url: "https://api.example.com/dishes")),
)

State(
  added: Number(default: 0),
)

Build(
  Column(gap: Space.sm, children: [
    Text(child: "Today's menu", size: FontSize.xl, weight: FontWeight.bold),
    ForEach(items: dishes, as: "dish", child: Row(justify: Justify.between, children: [
      Text(child: dish.name),
      Button(label: "Add", onTap: SetState(state: "added", value: state.added + 1)),
    ])),
    Text(child: "\${state.added} in your order", color: Color.textMuted),
  ])
)
`;

const DISHES = [
  { name: "Shakshuka", note: "Eggs, tomato, harissa" },
  { name: "Bunny chow", note: "Bean curry, quarter loaf" },
  { name: "Malva pudding", note: "With custard" },
];

/** The page above as it draws: the same three dishes, its button live. */
function Preview() {
  const [added, setAdded] = useState(0);
  return (
    <div className="preview" aria-label="The page, as Flux builds it">
      <div className="preview-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>localhost:5173/menu</span>
      </div>
      <div className="preview-body">
        <strong style={{ fontSize: 22, letterSpacing: "-0.01em" }}>Today's menu</strong>
        {DISHES.map((dish) => (
          <div className="dish" key={dish.name}>
            <span>
              <b>{dish.name}</b>
              <br />
              <small>{dish.note}</small>
            </span>
            <button type="button" className="mini-button" onClick={() => setAdded((n) => n + 1)}>
              Add
            </button>
          </div>
        ))}
        <small style={{ color: "var(--muted)" }} aria-live="polite">
          {added} in your order
        </small>
      </div>
    </div>
  );
}

export function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">.flx · open source · MIT</span>
            <h1>
              Write it once. Ship a <span className="hl">website</span> and an <span className="hl">app</span>.
            </h1>
            <p className="lede">
              Flux is a small, readable language for interfaces. One source compiles to a server-rendered React website and a
              Flutter app, and a checker tells you what's wrong, and where, before either is built.
            </p>
            <div className="actions">
              <a className="button primary" href="/docs/getting-started">
                Get started
              </a>
              <a className="button secondary" href={GITHUB}>
                View on GitHub
              </a>
            </div>
            <div className="install">
              <Code lang="sh">{`$ npm create @upskale/flux@latest my-app`}</Code>
            </div>
          </div>
          <div className="pair">
            <Code title="pages/menu.flx">{EXAMPLE}</Code>
            <Preview />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>A language with one job</h2>
          <p>
            Flux describes what a screen shows and what it does. It doesn't try to be a general-purpose language, so a page reads
            top to bottom: its route, its data, its state, then what it draws.
          </p>
          <div className="cards">
            <div className="card">
              <h3>Two targets, one source</h3>
              <p>
                <code>flux build --target web</code> writes a TanStack Start site, rendered on the server with its SEO in the HTML.{" "}
                <code>--target flutter</code> writes a Flutter app. Both come from the same files.
              </p>
            </div>
            <div className="card">
              <h3>Checked as you type</h3>
              <p>
                An unknown widget, a misspelt token, a parameter that's missing, data read before it's fetched: each comes with a
                message that says what to write instead, in the editor and in CI.
              </p>
              <Code lang="text">{`pages/home.flx:11:43: error: Unknown token: FontSize.huge`}</Code>
            </div>
            <div className="card">
              <h3>Typed data from any API</h3>
              <p>
                Declare what a page reads, <code>dish&lt;Product&gt;</code>, and where from. The website fetches it on its server and
                sends the browser only the fields the page reads.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>From nothing to a running site</h2>
          <div className="steps">
            <div className="step">
              <h3>Start a project</h3>
              <p>A website, a Flutter app, or a storefront.</p>
              <Code lang="sh">{`$ npm create @upskale/flux@latest my-app`}</Code>
            </div>
            <div className="step">
              <h3>Run it</h3>
              <p>Every save rebuilds only what changed.</p>
              <Code lang="sh">{`$ cd my-app
$ npx flux dev`}</Code>
            </div>
            <div className="step">
              <h3>Build it</h3>
              <p>A Node server for the web, or a Flutter project.</p>
              <Code lang="sh">{`$ npx flux build --target web`}</Code>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>Editors included</h2>
          <p>
            The VS Code extension adds highlighting, the checker's diagnostics as you type, completion and hover. It runs{" "}
            <code>flux lsp</code>, so any editor with a language client gets the same.
          </p>
          <div className="actions" style={{ marginTop: 20 }}>
            <a className="button secondary" href="/docs/editors">
              Editor support
            </a>
            <a className="button secondary" href="/docs/reference">
              Widget reference
            </a>
          </div>
        </div>
      </section>

      <div className="band">
        <div className="wrap">
          <p>
            <strong>Flux runs Upskale Studio.</strong> Every page and storefront built in Studio is written in Flux, and the same
            compiler builds them.
          </p>
          <a className="button secondary" href="https://upskalelabs.dev/products/studio">
            See Upskale Studio
          </a>
        </div>
      </div>
    </>
  );
}
