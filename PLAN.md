# Flux: the plan

Flux is the language Upskale Studio is written in. Until now it was called
CDSL and lived inside two private repos. This plan takes it out into its own
open-source project, with its own name, file extension, website, CLI and
editor support. Upskale then becomes one user of Flux instead of its owner.

| | |
|---|---|
| Language | **Flux** (was CDSL) |
| Files | **`.flx`** (was `.cdsl`) |
| Repo | `github.com/iamsinyagepr/flux` (public), this directory |
| Go module | `github.com/iamsinyagepr/flux` |
| npm | **`@upskale/flux`** (the CLI), `@upskale/create-flux` (`npm create @upskale/flux`) |
| CLI | `flux` |
| License | MIT |
| Site | **flux.upskalelabs.dev**, from `site/` in this repo, on its own Vercel project |
| Compiler | **Go**, one native binary (the code that is `upskale-backend/internal/studio` today) |

## Status (2026-11-17)

**Done, and checked:**
- **Phase 1, the move.** The compiler is here as module
  `github.com/iamsinyagepr/flux`, copied as files without the backend's
  history and scanned for secrets (none found; the only key-like string is
  a test's fake one). All 360 golden cases pass. New in Go:
  `pagedata.FromSource`, a port of Studio's `readPageFields`. It reads a
  page's route, data and SEO from its own source, and matches Studio on all
  409 Page-form golden pages.
- **Phase 2, the rename.** CDSL became Flux and `.cdsl` became `.flx` in
  Studio (`upskaleapp`): the editor's text, Claude's brief and tools, the
  docs, the desktop app's session files (which still accept `.cdsl`, so an
  older session's files get cleared) and the generated code's headers. The
  TypeScript compiler regenerated the golden cases into this repo
  (`export-studio-compiler.mjs` and `export-web-runtime.mjs` now write
  here), and Go still matches them byte for byte. `CDSL.md` is now
  `FLUX.md`.
- **Phase 3, the CLI.** `cmd/flux` provides `new` (templates `site`, `app` and
  `store`), `check`, `build --target web|flutter`, `dev` (watch, rebuild
  only what changed, Vite serving it), `migrate` (renames `.cdsl` files, or
  lays out a Studio `.upskale.json` export), `lsp` and `version`.
  `project/` reads `flux.json`, merging a partial theme over Studio's
  defaults, along with the `.flx` sources. The npm packages work the way
  esbuild's do (`npm/`, `scripts/release.mjs`): one launcher plus six platform
  packages, tested by installing the packed tarballs. CI and release
  workflows are in `.github/workflows`.
- **Phase 4, the site** (`site/`). It has a landing page and 14 docs pages,
  prerendered. The widget reference is generated from `registry/registry.json`,
  and every Flux sample on the site passes `flux check`. It builds, but
  isn't deployed: that's the owner's.
- **Phase 5.** The Upskale site's Studio pages say Flux and link to
  flux.upskalelabs.dev.
- **Phase 6, the VS Code extension** (`editors/vscode`). It has the grammar,
  language configuration, snippets, `flux.json` schema, the language client
  for `flux lsp`, and commands. A packaged `.vsix` (3.5 MB, with `flux.exe`
  inside) builds, and a release workflow publishes per platform to the
  Marketplace and Open VSX.

**Found and fixed on the way:** the generated website's `npm run dev`
always failed (`ssr.noExternal: true` made Vite's module runner evaluate
React's CommonJS). It now applies to `vite build` only. Builds were never
affected.

**Still to do:**
- Create `github.com/iamsinyagepr/flux` (public) and push, then tag
  `v0.1.0`. Add the `NPM_TOKEN`, `VSCE_PAT` and `OVSX_PAT` secrets, the
  `@upskale` npm scope, and the `upskale` Marketplace publisher.
- **`upskale-backend` switches to the module.** This needs the public repo
  first: `go get github.com/iamsinyagepr/flux@v0.1.0`, change the imports in
  `internal/server/studio.go` and `storefront_builds.go`
  (`studio.` → `flux.`), then delete `internal/studio`. Until then the
  backend's copy still writes "Edit the CDSL source" in generated headers,
  while Studio's preview writes "Flux". That's cosmetic, and the TypeScript
  compiler is the source of truth.
- **`flux fmt`**: port `formatter.ts`, with golden cases from it.
- **Internal names**: the Go package `cdsl`, Studio's `cdslString` and
  `CdslEditor`, and CSS classes still say cdsl. Renaming them is a
  mechanical pass that nobody sees, so it's left for its own change.
- **Language server**: go to definition, document symbols, folding and
  format on save (after `flux fmt`), plus richer hovers once the registry
  exports its descriptions.
- **Providers as a real boundary**: `Tenant.*` is still built into the
  checker rather than turned on by `flux.json`. The config shape is ready
  (`providers.upskale`), but the checker doesn't yet refuse `Tenant`
  without it.
- **Phase 7**, Studio on the Wasm build, is unchanged.

## Where things are today

Flux has two implementations, kept identical by golden tests:

- **Go**: `upskale-backend/internal/studio` (~11k lines). It has the parser
  and checker (`cdsl/`), the registry, page data, the Dart/Flutter compiler
  (`dart/`, `flutter/`) and the website compiler with its React runtime
  (`web/`). It imports nothing from the rest of the backend. Only
  `internal/server/studio.go` and `storefront_builds.go` call it, through
  `studio.Compile`, `CompileWeb`, `Validate`, `Project` and `Result`. It
  holds 360 golden cases in `testdata/golden`.
- **TypeScript**: `upskaleapp/src/lib/studio` (~10k lines of language code).
  It has the parser, language service (completion, hover, diagnostics),
  formatter, evaluator, registry and Dart compiler, all running in Studio's
  browser editor. `scripts/export-studio-compiler.mjs` writes the golden
  cases the Go tests check against.

Some of it is Upskale's own and gets in the way of a general-purpose
language:

- `Tenant.*` data sources (`Tenant.product(id:)`, `Tenant.history()`), with
  their types (`Store`, `Product`, `Order`, …) from the tenant API's schema;
- the storefront components and the storefront SDK (`flutter/sdk.json`,
  `web/runtime/src/studio/storefront.ts`);
- the compile entry points taking an Upskale `apiURL` and store ID.

## Shape of the open-source project

```
flux/
  cmd/flux/            the CLI (one binary)
  syntax/              lexer, parser, AST            (was cdsl/parser.go, ast.go)
  check/               the checker, diagnostics      (was cdsl/analysis.go, blocks.go, …)
  registry/            built-in widgets, functions, tokens
  format/              the formatter                 (new in Go: port of formatter.ts)
  lsp/                 language server               (new in Go: port of languageService.ts)
  data/                data sources: Http, plus providers
  providers/upskale/   the Tenant.* provider (Upskale's public tenant API)
  compile/flutter/     .flx → Flutter project        (was dart/, flutter/)
  compile/web/         .flx → React website          (was web/)
  runtime/             the Dart and web runtimes the output uses
  testdata/golden/     the parity cases
  npm/                 @upskale/flux and its per-platform binary packages
  create-flux/         npm create @upskale/flux
  editors/vscode/      the VS Code extension
  site/                flux.upskalelabs.dev
```

**Providers** are how Flux stays general and Upskale stays first-class.
Core Flux knows `Http(...)`. A provider adds a named source with its types,
and `flux.json` turns it on:

```json
{ "name": "my-shop", "targets": ["web", "flutter"], "providers": { "upskale": { "api": "https://api.example.com" } } }
```

With the `upskale` provider turned on, `Tenant.product(id:)` and its types
work exactly as they do in Studio today. Without it, the checker says
`Tenant` is unknown and suggests turning the provider on. The storefront
components belong to the same provider, so a plain Flux project doesn't ship
them.

## The CLI

Install it the way people install React tooling:

```sh
npm create @upskale/flux@latest my-app     # scaffold a project
npm install -D @upskale/flux               # or: npm i -g @upskale/flux
go install github.com/iamsinyagepr/flux/cmd/flux@latest   # Go users
```

The npm package works like esbuild's. `@upskale/flux` is a small JS shim,
and `optionalDependencies` pull in the one native binary that fits the
machine: `@upskale/flux-win32-x64`, `-darwin-arm64`, `-darwin-x64`,
`-linux-x64` and `-linux-arm64`. Nothing compiles on install, and Go isn't
needed. A GitHub release also attaches the bare binaries. Scoop and Homebrew
come later.

| Command | Does |
|---|---|
| `flux new <name> [--template app\|site\|store]` | scaffold (what `create-flux` runs) |
| `flux check` | parse and check every `.flx`, with diagnostics as `file:line:col` |
| `flux fmt [--check]` | format in place, or fail CI when files aren't formatted |
| `flux build --target web\|flutter` | compile to `dist/web` (a React site) or `dist/flutter` (a Flutter project) |
| `flux dev` | watch, rebuild and serve the web target with live reload |
| `flux lsp` | the language server, over stdio (the VS Code extension uses it) |
| `flux migrate` | rename `.cdsl` → `.flx` and rewrite old syntax |
| `flux version` | the compiler version, which is stamped into every build |

A project:

```
my-app/
  flux.json
  pages/home.flx
  components/Header.flx
  shell.flx
```

## Phases

Each phase ends with something working and committed. No phase leaves Studio
or the storefront builds broken.

### Phase 0: repo and identity (this commit)
- [x] This directory, `LICENSE` (MIT), `README.md` and this plan.
- [ ] Create `github.com/iamsinyagepr/flux` (public) and push it. **Needs
      your go-ahead: it's public from the first push.**
- [ ] Claim the `@upskale` npm scope and add the `flux.upskalelabs.dev`
      DNS record.

### Phase 1: move the Go compiler out
- Copy `upskale-backend/internal/studio` here as fresh files with no backend
  history (that history may name tenants, URLs or secrets). Change the
  module path. Rename the `cdsl` package to `syntax`/`check`.
- Bring the golden cases with it. `upskaleapp/scripts/export-studio-compiler.mjs`
  now writes them into `flux/testdata/golden`.
- Remove the Upskale-specific parameters from the compile API: replace
  `apiURL`/`storeID` with provider config. The `Tenant.*` resolution moves
  to `providers/upskale`.
- Scan the code for secrets and internal URLs before going public
  (gitleaks, plus a manual read of `testdata`).
- `upskale-backend` requires `github.com/iamsinyagepr/flux` and deletes
  `internal/studio`. The `internal/server` changes are import paths plus
  turning on the `upskale` provider. Done when the golden tests pass in both
  repos and a storefront build gives byte-identical output before and after.

### Phase 2: rename CDSL → Flux, `.cdsl` → `.flx`
- Rename the language everywhere: identifiers, messages, docs, `CDSL.md` →
  the Flux language reference.
- Studio (`upskaleapp`): file names become `pages/<id>.flx`,
  `components/<Name>.flx`, `shell.flx` and `main.flx`. A saved project
  with `.cdsl` paths is renamed as it opens, the way `storeRoutes.ts` moves
  store pages. The desktop CLI (`upskale-studio.mjs`) and Studio's MCP tools
  accept both extensions for one release, then only `.flx`.
- Update `StudioDocs.tsx`, the registry's descriptions and Claude's brief in
  the same change (see "Document CDSL changes").
- Check the syntax for anything that only made sense under the old name.
- The TypeScript implementation stays in `upskaleapp` for now, because
  Studio's editor needs it in the browser. Golden parity keeps it identical
  to the Go one. Phase 7 replaces it.

### Phase 3: the CLI
- `cmd/flux`: `check`, `fmt`, `build`, `dev`, `new`, `migrate`, `version`.
- Port the formatter from `formatter.ts` to Go, with golden cases from the
  TS one so `flux fmt` and Studio's formatter agree byte for byte.
- `flux.json`: its schema, published for editors.
- The templates `create-flux` offers: `app` (Flutter), `site` (web) and
  `store` (with the `upskale` provider).
- The release workflow: tag `v*`, then GoReleaser cross-compiles five
  binaries, attaches them to the GitHub release and publishes the six npm
  packages with provenance.
- Done when `npm create @upskale/flux@latest demo && cd demo && npx flux dev`
  works on a clean Windows, macOS and Linux machine.

### Phase 4: the site, flux.upskalelabs.dev
A Vite + React site in `site/`, prerendered like the Upskale site. It uses
Flux's own visual identity, derived from Upskale's tokens but not
Upskale-branded. One `tokens.css` is its single source for colours and type.
- **Landing**: what Flux is in one line, a side-by-side `.flx` and its
  rendered output, the install command, and the three things that set it
  apart (one source compiles to a website and a Flutter app; a checker that
  says what's wrong and where; typed data from any API). Then links to the
  docs and GitHub, and "Used by Upskale Studio".
- **Docs**: Getting started; the language (from `CDSL.md`: files, pages,
  components, data, state, parts, build, expressions); the widget and
  function reference, generated from the registry so it can't drift; the
  CLI; targets (web, Flutter); providers (Http, Upskale, writing one);
  editor setup; contributing.
- **Playground** (later): the Go compiler built to WebAssembly, in the
  browser, like the Studio playground on the Upskale site.

### Phase 5: the Upskale site lets go
- `docs.studio.tsx`, `products.studio.tsx`, `products.index.tsx` and
  `StudioPlayground.tsx` say "written in **Flux**" and link to
  flux.upskalelabs.dev for the language. The Upskale site stops documenting
  the language itself and only covers Studio.
- The `Welcome.cdsl` labels become `Welcome.flx`.

### Phase 6: the VS Code extension
In `editors/vscode`, published as `upskale.flux` to the VS Code Marketplace
and Open VSX (for Cursor, VSCodium and others).
- **Grammar**: a TextMate grammar for `.flx` (blocks, constructors, named
  arguments, `${…}` interpolation, tokens like `Space.md`, types in
  `name<Type>`) and `language-configuration.json` (brackets, comments,
  auto-close, folding).
- **Language server**: `flux lsp` in Go, ported from Studio's
  `languageService.ts`, `editorHover.ts`, `completionContext.ts` and
  `folding.ts`. It gives diagnostics as you type, completion (widgets,
  parameters, tokens, data fields from declared types), hover docs from the
  registry, format on save, go to definition (a `Use(part:)`, a component,
  a data entry), document symbols and folding.
- **Binary**: the extension ships per-platform builds (`vsce --target`),
  each with its `flux` binary inside. If the project has a `flux` in
  `node_modules`, the extension uses that instead, so the editor and the
  build always agree.
- **Commands**: Flux: Build, Flux: Preview (`flux dev` in a webview), Flux:
  Migrate from CDSL.
- **Snippets** for `Page`, `Component`, `usingServer` and `State`.
- **Release**: a tag `vscode-v*` triggers CI, which publishes with
  `VSCE_PAT` and `OVSX_PAT`.
- Done when a `.flx` file opened in VS Code gets highlighting, the same
  diagnostics `flux check` gives, completion and format on save.

### Phase 7: Studio on Flux
- Build the Go compiler to WebAssembly and make it an npm package
  (`@upskale/flux-wasm`). Studio's browser editor moves to it piece by
  piece (checker, then formatter, then language service), each step
  covered by the golden cases. Once nothing in `upskaleapp/src/lib/studio`
  duplicates Flux, the TypeScript copy is deleted and Flux has one
  implementation.
- If the Wasm build turns out too heavy for the browser (size, start-up
  time), keep the TypeScript copy and keep parity through the published
  golden cases. Decide after measuring, not before.

## Open questions

- **The storefront components.** Product cards, cart, checkout: do they
  stay open in `providers/upskale`, or become a private Upskale package?
  Recommended: open. They only call the tenant API, which is documented
  publicly, and an open storefront kit is good marketing for the platform.
- **Name collisions.** InfluxDB also has a query language called Flux (files
  `.flux`), and npm's `flux` is Facebook's. Using `.flx`, the `@upskale`
  scope and "Flux UI language" on the site keep them apart. Check the
  trademark question before the 1.0 announcement.
- **Versioning.** Start at `0.x`. A `.flx` that checks under 0.N should
  keep checking under 0.N+1, or `flux migrate` rewrites it.
- **Governance.** Contributions are under MIT with a DCO sign-off and no
  CLA. Upskale holds the repo.

## Risks

- **Drift between Go and TypeScript** until Phase 7. The golden tests
  already catch it. Each repo's CI runs them against the other's published
  cases.
- **Publishing private history.** Phase 1 copies files into a fresh history
  and never moves the backend's git history. Scan everything before the
  first public push.
- **Breaking saved Studio projects.** The `.cdsl` → `.flx` rename has to
  happen as a project opens and must never require a manual step. Test it
  against the sandbox business's projects and a desktop project folder.
