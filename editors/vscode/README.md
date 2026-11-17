# Flux for VS Code

Support for [Flux](https://flux.upskalelabs.dev) `.flx` files:

- **Highlighting**: blocks, widgets, parameters, typed data (`dish<Product>`),
  tokens (`Space.md`) and `${…}` interpolation.
- **Checks as you type**: the same diagnostics `flux check` gives, across
  the whole project (a component's change is checked in the pages that use
  it).
- **Completion**: widgets, actions and functions; a call's parameters,
  required ones first; and a token family's values after `Color.`.
- **Hover**: a widget's or function's parameters and their types.
- **Snippets**: `page`, `component`, `server`, `client`, `state` and
  `foreach`.
- **Commands**: Flux: Check, Build, Run the dev server, and Migrate from
  CDSL.
- **`flux.json`** is validated as you edit it.

The extension runs `flux lsp`. It looks for `flux` in this order: the
`flux.path` setting, the project's own `@upskale/flux` in `node_modules`
(so the editor and the build agree), the copy bundled with the extension,
and finally your PATH.

## Developing

```sh
npm install
npm run check     # types, the grammar's patterns, the JSON files
npm run build     # dist/extension.js
npm run package   # flux-<version>.vsix
```

To try it, open this folder in VS Code and press F5. To bundle a `flux`
binary, put it in `bin/` before running `npm run package`. The release
workflow builds one `.vsix` per platform (`vsce package --target`), each
with its own binary.
