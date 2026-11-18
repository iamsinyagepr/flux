// Copies Upskale Studio's editors into src/studio: the context menu and the
// property fields (one property's card), with every file they import, at
// the same paths they have in upskaleapp/src (so their imports stay as
// they are). Two things stay behind, each replaced by a file of ours:
//
//   platform/index.ts   the desktop app's bridge → src/studio/platform/index.ts
//   api/client.ts       Upskale's console API    → src/studio/api/client.ts
//   console/functions/shell  the console's own navigation, which reaches
//                       into its API → src/studio/console/functions/shell
//
// Menus that portal to document.body portal to the overlay's root instead,
// so they live in its shadow DOM with its styles (src/host/portal.ts).
//
// usage: node scripts/sync-from-studio.mjs [path/to/upskaleapp]
//
// Studio is the source of truth until it imports this package itself
// (PLAN.md, Phase 7): change these files there, then sync.
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const studio = resolve(process.argv[2] ?? join(here, "../../upskaleapp"));
const src = join(studio, "src");
const out = join(here, "src/studio");
if (!existsSync(join(src, "lib/studio/parser.ts"))) throw new Error(`no Upskale Studio at ${studio}`);

const ENTRIES = [
  "console/components/studio/code-context-menu/CodeContextMenu.tsx",
  "components/studio/VisualFields.tsx",
  "components/studio/StudioContextMenu.tsx",
  "components/studio/CodeContextMenu.tsx",
  "lib/studio/componentTemplates.ts",
  "lib/studio/languageService.ts",
  "lib/studio/projectComponents.ts",
  "lib/studio/projectConfig.ts",
  "lib/studio/sourceEdits.ts",
  "lib/studio/visualModel.ts",
  "lib/studio/sourceTree.ts",
  "lib/studio/sourceMoves.ts",
  "lib/studio/migrateImports.ts",
  "console/components/studio/config-dialog/ConfigDialog.tsx",
  "constants/ui/index.ts",
];
// Ours, never copied over.
const OWN = /[\\/](platform([\\/]index)?|api[\\/](client|types)|console[\\/]functions[\\/]shell([\\/]index)?|components[\\/]ui|config-dialog[\\/]AppIdentity)(\.tsx?)?$/;

const result = await build({
  entryPoints: ENTRIES.map((entry) => join(src, entry)),
  bundle: true,
  write: false,
  metafile: true,
  outdir: "unused",
  format: "esm",
  jsx: "automatic",
  logLevel: "error",
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "externals",
      setup(b) {
        // Packages are the package's own dependencies.
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.kind === "entry-point" || /^[A-Za-z]:[\\/]/.test(args.path) ? undefined : { path: args.path, external: true },
        );
        // Ours, by where the import leads (./AppIdentity from config-dialog
        // is config-dialog/AppIdentity), not only by how it's written.
        b.onResolve({ filter: /^\./ }, (args) =>
          OWN.test(resolve(args.resolveDir, args.path)) ? { path: args.path, external: true } : undefined,
        );
      },
    },
  ],
});

const files = Object.keys(result.metafile.inputs)
  .map((file) => resolve(file))
  .filter((file) => file.startsWith(src))
  .map((file) => relative(src, file).replace(/\\/g, "/"));

// The bundle drops type-only imports (import type …), so the files they
// name aren't among its inputs: they're followed here, until none is missing.
const typeOnly = (from) => {
  const text = readFileSync(join(src, from), "utf8");
  const found = [];
  for (const [, specifier] of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const base = resolve(dirname(join(src, from)), specifier);
    if (OWN.test(base)) continue;
    const file = [base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx")].find((candidate) => existsSync(candidate));
    if (file && file.startsWith(src)) found.push(relative(src, file).replace(/\\/g, "/"));
  }
  return found;
};
for (let i = 0; i < files.length; i++) for (const file of typeOnly(files[i])) if (!files.includes(file)) files.push(file);
files.sort();

rmSync(out, { recursive: true, force: true });
const header = (file) =>
  file.endsWith(".css") ? `/* Synced from Upskale Studio (upskaleapp/src/${file}). Edit it there, then npm run sync. */\n` : `// Synced from Upskale Studio (upskaleapp/src/${file}). Edit it there, then npm run sync.\n`;

let portals = 0;
for (const file of files) {
  let text = readFileSync(join(src, file), "utf8");
  if (text.includes("createPortal")) {
    const before = text;
    // createPortal(<…/>, document.body) → into the overlay's root.
    // createPortal's second argument, alone on its line or after a `??`.
    text = text.replace(/document\.body,(\s*)$/gm, (_, tail) => `portalRoot(),${tail}`);
    if (text !== before) {
      const depth = file.split("/").length - 1;
      const host = "../".repeat(depth + 1) + "host/portal";
      text = `import { portalRoot } from "${host}";\n` + text;
      portals++;
    }
  }
  mkdirSync(dirname(join(out, file)), { recursive: true });
  writeFileSync(join(out, file), header(file) + text);
}

// Studio's styles: its own, and the tokens they're written in.
mkdirSync(join(out, "styles"), { recursive: true });
copyFileSync(join(src, "styles/studio.css"), join(out, "styles/studio.css"));
copyFileSync(join(src, "styles/tokens.css"), join(out, "styles/tokens.css"));

// Our replacements for what stays in Studio.
writeFileSync(join(here, "src/studio/SYNCED.md"), `# Synced from Upskale Studio

Everything in this folder except \`platform/\` and \`api/\` is copied from
upskaleapp/src by \`npm run sync\`, at the same paths. Don't edit it here.
Edit it in Studio, then sync.

${files.length} files, ${portals} of them portalling into the overlay.
`);
for (const own of [
  "platform/index.ts",
  "api/client.ts",
  "console/functions/shell/index.ts",
  "components/ui.tsx",
  "console/components/studio/config-dialog/AppIdentity.tsx",
  "api/types.ts",
]) {
  if (!existsSync(join(here, "src/own", own))) throw new Error(`src/own/${own} is missing`);
  mkdirSync(dirname(join(out, own)), { recursive: true });
  copyFileSync(join(here, "src/own", own), join(out, own));
}
console.log(`synced ${files.length} files from ${studio} (${portals} portalling into the overlay)`);
