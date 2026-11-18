// Builds the overlay flux dev injects into the site it serves:
//
//   dist/overlay.js                one script, its styles inside it
//   ../cmd/flux/overlay/overlay.js the same, embedded in the flux binary
//
// Its styles are Studio's own (Tailwind over the synced files, and
// studio.css) and the overlay's, all inside the shadow root main.tsx makes.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const read = (file) => readFileSync(join(here, file), "utf8");

/**
 * Studio's styles, as its app gets them: Tailwind run over the synced
 * files (tokens.css is Studio's Tailwind entry: its theme, and source('../')
 * scans src/studio for the utilities its components use), with the base
 * reset; then studio.css and the overlay's own. In the overlay's shadow
 * root :root matches nothing, so its rules are the host's.
 */
const tailwind = join(here, "dist", "tailwind.css");
mkdirSync(join(here, "dist"), { recursive: true });
execFileSync(process.execPath, [join(here, "node_modules/@tailwindcss/cli/dist/index.mjs"), "-i", join(here, "src/studio/styles/tokens.css"), "-o", tailwind, "--minify"], {
  cwd: here,
  stdio: ["ignore", "ignore", "inherit"],
});
const hostRoot = (css) => css.replace(/:root(?=\s*[{,])/g, ":host");

const styles = [
  hostRoot(readFileSync(tailwind, "utf8")),
  hostRoot(read("src/studio/styles/studio.css")),
  read("src/overlay/overlay.css"),
  read("src/overlay/launcher.css"),
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
