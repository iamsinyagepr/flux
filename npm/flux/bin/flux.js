#!/usr/bin/env node
// Runs the flux binary npm installed for this machine: one of the
// @upskale/flux-<os>-<cpu> packages, each holding that platform's build.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const platform = `${process.platform}-${process.arch}`;
const exe = process.platform === "win32" ? "flux.exe" : "flux";
let binary = process.env.FLUX_BINARY;
if (!binary) {
  try {
    binary = require.resolve(`@upskale/flux-${platform}/bin/${exe}`);
  } catch {
    console.error(
      `flux: no build for ${platform} was installed.\n` +
        `Reinstall without --no-optional (npm install @upskale/flux), or install the binary\n` +
        `from https://github.com/iamsinyagepr/flux/releases and put it on your PATH.`,
    );
    process.exit(1);
  }
}
const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  console.error(`flux: couldn't run ${path.basename(binary)}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
