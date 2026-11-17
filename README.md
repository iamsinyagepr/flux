# Flux

A small, readable language for interfaces. Write a page once in `.flx`, then
compile it to a server-rendered React website, a Flutter app, or both.

```
Page(name: "Home", route: Route(path: "/"), seo: Seo(title: "Hello"))

State(
  count: Number(default: 0),
)

Build(
  Column(gap: Space.md, padding: Insets(x: 24, y: 48), children: [
    Text(child: "Hello from Flux", size: FontSize.display, weight: FontWeight.bold),
    Button(label: "Clicked ${state.count} times", onTap: SetState(state: "count", value: state.count + 1)),
  ])
)
```

```sh
npm create @upskale/flux@latest my-app
cd my-app
npm install
npx flux dev
```

| Command | Does |
|---|---|
| `flux new <name> [--template site\|app\|store]` | start a project |
| `flux check` | check every `.flx`, as `file:line:col: severity: message` |
| `flux build [--target web\|flutter]` | compile to `dist/web` (React) or `dist/flutter` |
| `flux dev` | serve the website, rebuilding as you save |
| `flux migrate` | `.cdsl` → `.flx`, or an Upskale Studio export into a folder |
| `flux lsp` | the language server, for editors |

Docs: <https://flux.upskalelabs.dev>. The VS Code extension is in
[editors/vscode](editors/vscode).

Flux was CDSL, the language [Upskale Studio](https://upskalelabs.dev) is
written in, and Studio still runs on it. [PLAN.md](PLAN.md) covers how it
got here and what's next.

## Developing

```sh
go test ./...                  # includes the 360 golden cases
go run ./cmd/flux check        # in a project
node scripts/release.mjs 0.1.0 # every platform's binary and npm package, in release/
```

## License

[MIT](LICENSE)
