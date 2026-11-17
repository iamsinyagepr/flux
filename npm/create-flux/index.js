#!/usr/bin/env node
// npm create @upskale/flux@latest [name] [-- --template site|app|store]
//
// Asks for what isn't given, makes the project with `flux new`, and adds
// @upskale/flux to it so `npx flux dev` runs the same version.
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const templates = {
  site: "a website",
  app: "a Flutter app",
  store: "a storefront on an Upskale business's API",
};

async function main() {
  const args = process.argv.slice(2);
  let name = args.find((arg) => !arg.startsWith("-"));
  const flag = args.findIndex((arg) => arg === "--template" || arg === "-t");
  let template = flag >= 0 ? args[flag + 1] : args.find((arg) => arg.startsWith("--template="))?.split("=")[1];
  if (template === name) name = args.filter((arg) => !arg.startsWith("-") && arg !== template)[0];

  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  if (interactive && (!name || !template)) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!name) name = (await rl.question("Project name: (my-flux-app) ")).trim() || "my-flux-app";
    if (!template) {
      const keys = Object.keys(templates);
      keys.forEach((key, i) => console.log(`  ${i + 1}. ${key}: ${templates[key]}`));
      const answer = (await rl.question("Template: (1) ")).trim() || "1";
      template = keys[Number(answer) - 1] ?? (keys.includes(answer) ? answer : "site");
    }
    rl.close();
  }
  name ??= "my-flux-app";
  template ??= "site";
  if (!templates[template]) {
    console.error(`Unknown template ${template}: ${Object.keys(templates).join(", ")}`);
    process.exit(1);
  }

  const cli = require.resolve("@upskale/flux/bin/flux.js");
  const made = spawnSync(process.execPath, [cli, "new", name, "--template", template], {
    stdio: "inherit",
    env: { ...process.env, FLUX_CREATE: "1" },
  });
  if (made.status !== 0) process.exit(made.status ?? 1);

  // The project pins the CLI it was made with.
  const own = require("@upskale/flux/package.json").version;
  const pkgPath = path.join(name, "package.json");
  if (!existsSync(pkgPath)) {
    const pkg = {
      name: path.basename(path.resolve(name)),
      private: true,
      scripts: { dev: "flux dev", build: "flux build", check: "flux check" },
      devDependencies: { "@upskale/flux": "^" + own },
    };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  } else {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.devDependencies = { ...pkg.devDependencies, "@upskale/flux": "^" + own };
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
  const steps = [`cd ${name}`, "npm install", template === "app" ? "npx flux build --target flutter" : "npm run dev"];
  console.log(`\nNext:\n\n${steps.map((step) => "  " + step).join("\n")}\n`);
  if (template === "app") console.log("Then run the app from dist/flutter: flutter run.\n");
  else console.log("On the page, press E to edit it in place.\n");
  if (template === "store")
    console.log("It runs on sample data until flux.json has your business's API address (providers.upskale.api).\n");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
