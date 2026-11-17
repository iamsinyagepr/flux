// Builds flux for every platform and lays out what a release publishes:
//
//   release/bin/flux-<os>-<cpu>[.exe]   the binaries, attached to the GitHub release
//   release/npm/flux-<os>-<cpu>/        @upskale/flux-<os>-<cpu>: one binary each
//   release/npm/flux/                   @upskale/flux: the launcher
//   release/npm/create-flux/            @upskale/create-flux
//
// usage: node scripts/release.mjs <version> [--publish]
//
// --publish runs npm publish for each package (platform packages first, so
// @upskale/flux's optionalDependencies resolve), with provenance in CI.
// Flux is pure Go: every platform cross-compiles from any machine.
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [version, ...flags] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(version ?? "")) {
  console.error("usage: node scripts/release.mjs <version> [--publish]   (version like 0.1.0)");
  process.exit(2);
}
const publish = flags.includes("--publish");

// npm's names for the platform → Go's.
const platforms = [
  { os: "win32", cpu: "x64", goos: "windows", goarch: "amd64" },
  { os: "win32", cpu: "arm64", goos: "windows", goarch: "arm64" },
  { os: "darwin", cpu: "x64", goos: "darwin", goarch: "amd64" },
  { os: "darwin", cpu: "arm64", goos: "darwin", goarch: "arm64" },
  { os: "linux", cpu: "x64", goos: "linux", goarch: "amd64" },
  { os: "linux", cpu: "arm64", goos: "linux", goarch: "arm64" },
];

const out = "release";
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "bin"), { recursive: true });

const meta = {
  license: "MIT",
  homepage: "https://flux.upskalelabs.dev",
  repository: { type: "git", url: "git+https://github.com/iamsinyagepr/flux.git" },
};

for (const p of platforms) {
  const exe = p.os === "win32" ? "flux.exe" : "flux";
  const name = `flux-${p.os}-${p.cpu}`;
  const dir = join(out, "npm", name);
  mkdirSync(join(dir, "bin"), { recursive: true });
  console.log(`building ${name}`);
  execFileSync(
    "go",
    ["build", "-trimpath", "-ldflags", `-s -w -X main.version=${version}`, "-o", join(dir, "bin", exe), "./cmd/flux"],
    { stdio: "inherit", env: { ...process.env, CGO_ENABLED: "0", GOOS: p.goos, GOARCH: p.goarch } },
  );
  if (p.os !== "win32") chmodSync(join(dir, "bin", exe), 0o755);
  cpSync(join(dir, "bin", exe), join(out, "bin", name + (p.os === "win32" ? ".exe" : "")));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: `@upskale/${name}`,
        version,
        description: `The flux CLI for ${p.os} ${p.cpu}. Install @upskale/flux instead: it picks this one for you.`,
        ...meta,
        os: [p.os],
        cpu: [p.cpu],
        files: [`bin/${exe}`],
        preferUnplugged: true,
      },
      null,
      2,
    ) + "\n",
  );
}

/** A package from npm/<name>, its version and its own @upskale dependencies set to this release. */
function stage(name) {
  const dir = join(out, "npm", name);
  cpSync(join("npm", name), dir, { recursive: true });
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  pkg.version = version;
  for (const field of ["dependencies", "optionalDependencies"])
    for (const dep of Object.keys(pkg[field] ?? {})) if (dep.startsWith("@upskale/")) pkg[field][dep] = version;
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  return dir;
}
stage("flux");
cpSync("LICENSE", join(out, "npm", "flux", "LICENSE"));
stage("create-flux");

if (publish) {
  const args = ["publish", "--access", "public"];
  if (process.env.CI) args.push("--provenance");
  if (version.includes("-")) args.push("--tag", "next");
  for (const p of platforms) execFileSync("npm", args, { cwd: join(out, "npm", `flux-${p.os}-${p.cpu}`), stdio: "inherit", shell: true });
  execFileSync("npm", args, { cwd: join(out, "npm", "flux"), stdio: "inherit", shell: true });
  execFileSync("npm", args, { cwd: join(out, "npm", "create-flux"), stdio: "inherit", shell: true });
}
console.log(`\n${out}/ ready for ${version}${publish ? " (published)" : ""}`);
