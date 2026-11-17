# Releasing Flux

Two things get published, each started by pushing a tag:

| Tag | Publishes | Workflow |
|---|---|---|
| `v<version>` | `@upskale/flux`, its six platform packages and `@upskale/create-flux` to npm, then a GitHub release with the six binaries | [release.yml](.github/workflows/release.yml) |
| `vscode-v<version>` | the VS Code extension for six platforms, to the VS Code Marketplace and Open VSX | [vscode.yml](.github/workflows/vscode.yml) |

The site (`site/`) isn't released by a tag: Vercel deploys it (see the end).

## One-time setup

Nothing below has been done yet. Do it once, before the first tag.

### 1. npm: the `@upskale` scope and `NPM_TOKEN`

1. Sign in at npmjs.com, with two-factor authentication on.
2. In the profile menu, choose **Add Organization**. Name it `upskale` and pick the
   free plan (unlimited public packages). If the name is taken, the scope has to
   change everywhere: `npm/`, `scripts/release.mjs`, the docs and the extension.
3. Go to **Profile → Access Tokens → Generate New Token → Granular Access Token**:
   - name: `flux release`;
   - packages and scopes: **Read and write**, for the `@upskale` organization's
     scope (the packages don't exist before the first release, so choose the scope);
   - **Bypass two-factor authentication** on, if it's offered: CI can't type a code;
   - note the expiry date. npm limits how long write tokens last.

After the first release, npm's **Trusted Publishing** can replace the token: link
each package to this repo's `release.yml` on npmjs.com, then remove `NPM_TOKEN`
and `NODE_AUTH_TOKEN` from the workflow.

### 2. VS Code Marketplace: the `upskale` publisher and `VSCE_PAT`

1. At marketplace.visualstudio.com/manage, sign in with a Microsoft account and
   **Create publisher**: ID `upskale`, which must match `"publisher"` in
   `editors/vscode/package.json`, with the name Upskale Labs.
2. At dev.azure.com, create a free organization if asked (any name), then go to
   **User settings → Personal access tokens → New Token**:
   - organization: **All accessible organizations**;
   - scopes: **Custom defined → Marketplace → Manage** ("Show all scopes" finds it);
   - expiry: the longest it allows.

Microsoft is retiring "all organizations" tokens. If the option isn't offered,
switch `vscode.yml` to signing in with Microsoft Entra
(`vsce publish --azure-credential`, with `azure/login` in the job) instead of a token.

### 3. Open VSX: the `upskale` namespace and `OVSX_PAT`

1. Sign in at open-vsx.org with GitHub, and sign the Eclipse Foundation publisher
   agreement (a one-time step that needs an Eclipse account linked to the GitHub one).
2. Go to **Settings → Access Tokens → Generate New Token**.
3. Claim the namespace once: `npx ovsx create-namespace upskale -p <token>`.

### 4. The repo's secrets

Go to **github.com/iamsinyagepr/flux → Settings → Secrets and variables →
Actions → New repository secret**:

| Name | Value |
|---|---|
| `NPM_TOKEN` | the npm token |
| `VSCE_PAT` | the Azure DevOps token |
| `OVSX_PAT` | the Open VSX token |

## A release

### The CLI

```sh
git tag v0.1.0 && git push origin v0.1.0
```

The workflow runs the tests, builds the six binaries with the tag's version stamped in,
publishes the platform packages first (so `@upskale/flux`'s optionalDependencies
resolve), then `@upskale/flux` and `@upskale/create-flux`, all with provenance.
Then it creates the GitHub release. A version like `0.2.0-beta.1` publishes
under npm's `next` tag, so `latest` stays on the last stable version.

To try it locally first, without publishing anything:

```sh
node scripts/release.mjs 0.1.0            # everything in release/
cd release/npm/flux-win32-x64 && npm pack # or install the packed tarballs into a scratch folder
```

### The extension

Set `"version"` in `editors/vscode/package.json` (the Marketplace refuses a
version it already has), commit, then:

```sh
git tag vscode-v0.1.0 && git push origin vscode-v0.1.0
```

Each platform's `.vsix` carries the `flux` built from the same commit.

### Afterwards

- `npm create @upskale/flux@latest my-app` should make a project, and
  `npx flux version` should print the new version.
- Searching "Flux" in VS Code's extensions panel should find `upskale.flux`.

## The site

`site/` is a Vercel project with its root directory set to `site`. It builds with
`npm run build` and serves `dist`, using clean URLs. Every push to `main`
deploys it to production. The address is flux.upskalelabs.dev once that domain
is added to the project and its DNS points at Vercel.
