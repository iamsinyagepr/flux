// Builds the overlay flux dev injects into the site it serves:
//
//   dist/overlay.js                one script, its styles inside it
//   ../cmd/flux/overlay/overlay.js the same, embedded in the flux binary
//
// Its styles are Studio's tokens (the custom properties studio.css is written
// in) set on :host, studio.css, and the overlay's own: all inside the shadow
// root main.tsx makes, where :root means nothing, so :root becomes :host.
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(join(here, file), "utf8");

/** The custom properties a stylesheet declares at its top level (@theme, :root). */
function tokensOf(css) {
  const declarations = new Map();
  for (const block of css.matchAll(/(?:@theme|:root)\s*\{([^{}]*)\}/g))
    for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) declarations.set(name, value.trim());
  return [...declarations].map(([name, value]) => `  ${name}: ${value};`).join("\n");
}

const styles = [
  read("src/studio/styles/preflight.css"),
  `:host {\n${tokensOf(read("src/studio/styles/tokens.css"))}\n}`,
  read("src/studio/styles/studio.css").replace(/:root\b/g, ":host"),
  read("src/overlay/overlay.css"),
].join("\n");

await build({
  entryPoints: [join(here, "src/overlay/main.tsx")],
  outfile: join(here, "dist/overlay.js"),
  bundle: true,
  format: "esm",
  target: "es2022",
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".css": "empty", ".svg": "dataurl", ".png": "dataurl" },
  banner: { js: "// flux dev's editor: Upskale Studio's context menu and properties panel. Built by editor/scripts/build.mjs. MIT." },
  logLevel: "warning",
  plugins: [
    {
      name: "overlay-styles",
      setup(b) {
        b.onResolve({ filter: /^virtual:overlay-styles$/ }, () => ({ path: "overlay-styles", namespace: "virtual" }));
        b.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({ contents: styles, loader: "text" }));
      },
    },
  ],
});

mkdirSync(join(here, "../cmd/flux/overlay"), { recursive: true });
copyFileSync(join(here, "dist/overlay.js"), join(here, "../cmd/flux/overlay/overlay.js"));
const size = readFileSync(join(here, "dist/overlay.js")).length;
console.log(`built dist/overlay.js (${Math.round(size / 1024)} KB) and cmd/flux/overlay/overlay.js`);
