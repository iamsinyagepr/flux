// After `vite build` (the browser bundle, dist/) and `vite build --ssr`
// (the same pages for Node, dist-ssr/), writes every page as real HTML:
//
//   /                 → dist/index.html
//   /docs/cli         → dist/docs/cli.html    (Vercel's cleanUrls serves it at /docs/cli)
//
// plus 404.html, sitemap.xml and robots.txt. Then it checks what it wrote
// and fails the build on a page without exactly one <h1>, or a link to a
// page that doesn't exist.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const out = join(root, "dist");
const { render, PAGES, headTags } = await import(pathToFileURL(join(root, "dist-ssr/entry-server.js")).href);
const SITE = "https://flux.upskalelabs.dev";

const template = readFileSync(join(out, "index.html"), "utf8");
if (!template.includes("<!--head-->") || !template.includes("<!--app-->")) throw new Error("index.html lost its placeholders");
const html = (head, body) => template.replace("<!--head-->", () => head).replace("<!--app-->", () => body);
const fileFor = (path) => (path === "/" ? "index.html" : path.slice(1) + ".html");

const known = new Set(PAGES.map((p) => p.path));
const problems = [];
for (const page of PAGES) {
  const body = render(page.path);
  const h1s = body.match(/<h1[\s>]/g)?.length ?? 0;
  if (h1s !== 1) problems.push(`${page.path}: ${h1s} <h1>s`);
  for (const [, href] of body.matchAll(/href="(\/[^"#?]*)/g))
    if (!known.has(href.replace(/\/$/, "") || "/") && !/\.\w+$/.test(href)) problems.push(`${page.path}: a link to ${href}, which isn't a page`);
  const file = join(out, fileFor(page.path));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html(headTags(page), body));
}
const missing = { path: "/404", title: "Not found | Flux", description: "There's no page at this address." };
writeFileSync(join(out, "404.html"), html(headTags(missing) + '\n    <meta name="robots" content="noindex" />', render("/404")));

writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map(
    (p) => `  <url><loc>${SITE}${p.path === "/" ? "/" : p.path}</loc></url>`,
  ).join("\n")}\n</urlset>\n`,
);
writeFileSync(join(out, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
rmSync(join(root, "dist-ssr"), { recursive: true, force: true });

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`prerendered ${PAGES.length} pages`);
