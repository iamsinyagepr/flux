// Checks the grammar's every regex compiles (as Oniguruma-compatible JS
// regexes) and the JSON files parse: a broken pattern otherwise fails
// silently in the editor, leaving the file uncoloured.
import { readFileSync } from "node:fs";

let failed = 0;
const json = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    failed++;
    return {};
  }
};

const grammar = json("syntaxes/flux.tmLanguage.json");
json("snippets/flux.json");
json("language-configuration.json");
json("flux.schema.json");

let patterns = 0;
(function walk(node, at) {
  if (Array.isArray(node)) return node.forEach((child, i) => walk(child, `${at}[${i}]`));
  if (!node || typeof node !== "object") return;
  for (const key of ["match", "begin", "end"]) {
    if (typeof node[key] !== "string") continue;
    patterns++;
    try {
      new RegExp(node[key]);
    } catch (error) {
      console.error(`${at}.${key}: ${error.message}`);
      failed++;
    }
  }
  for (const [key, value] of Object.entries(node)) walk(value, `${at}.${key}`);
})(grammar, "grammar");

// The scopes a .flx line should get, by sample.
const sample = 'stores<Store[]>(src: Tenant.stores(city: query.city))';
const typed = new RegExp(grammar.repository["typed-entry"].match);
if (!typed.test(sample)) {
  console.error("typed-entry doesn't match " + sample);
  failed++;
}

if (failed) process.exit(1);
console.log(`grammar: ${patterns} patterns compile`);
