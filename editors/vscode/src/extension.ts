// The Flux extension: the grammar and snippets are static (package.json);
// everything else comes from `flux lsp`, the CLI's language server, so the
// editor reports exactly what `flux check` and `flux build` will.
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { LanguageClient, type LanguageClientOptions, type ServerOptions } from "vscode-languageclient/node";

let client: LanguageClient | undefined;

const exe = process.platform === "win32" ? "flux.exe" : "flux";

/**
 * The flux to run: the setting's, the project's own (so the editor and the
 * build agree on the version), the one bundled with this extension, or PATH's.
 */
function fluxBinary(context: vscode.ExtensionContext): string {
  const configured = vscode.workspace.getConfiguration("flux").get<string>("path");
  if (configured) return configured;
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const own = path.join(folder.uri.fsPath, "node_modules", `@upskale`, `flux-${process.platform}-${process.arch}`, "bin", exe);
    if (fs.existsSync(own)) return own;
  }
  const bundled = context.asAbsolutePath(path.join("bin", exe));
  if (fs.existsSync(bundled)) return bundled;
  return "flux";
}

async function start(context: vscode.ExtensionContext): Promise<void> {
  const command = fluxBinary(context);
  const server: ServerOptions = { command, args: ["lsp"] };
  const options: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "flux" }],
    synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher("**/{*.flx,flux.json}") },
  };
  client = new LanguageClient("flux", "Flux", server, options);
  try {
    await client.start();
  } catch (error) {
    client = undefined;
    const choice = await vscode.window.showErrorMessage(
      `Flux: couldn't start the language server (${command}). Install the CLI with npm install -g @upskale/flux, or set flux.path.`,
      "Open settings",
    );
    if (choice) vscode.commands.executeCommand("workbench.action.openSettings", "flux.path");
    console.error(error);
  }
}

/** Runs a flux command in a terminal at the project's folder. */
function inTerminal(context: vscode.ExtensionContext, name: string, args: string): void {
  const folder =
    (vscode.window.activeTextEditor && vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)) ??
    vscode.workspace.workspaceFolders?.[0];
  const terminal = vscode.window.createTerminal({ name: `Flux: ${name}`, cwd: folder?.uri.fsPath });
  const binary = fluxBinary(context);
  terminal.sendText(`${binary.includes(" ") ? `& "${binary}"` : binary} ${args}`);
  terminal.show();
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand("flux.restart", async () => {
      await client?.stop();
      await start(context);
    }),
    vscode.commands.registerCommand("flux.check", () => inTerminal(context, "check", "check")),
    vscode.commands.registerCommand("flux.build", async () => {
      const target = await vscode.window.showQuickPick(["web", "flutter"], { placeHolder: "Build for" });
      if (target) inTerminal(context, "build", `build --target ${target}`);
    }),
    vscode.commands.registerCommand("flux.dev", () => inTerminal(context, "dev", "dev")),
    vscode.commands.registerCommand("flux.migrate", () => inTerminal(context, "migrate", "migrate")),
  );
  await start(context);
}

export async function deactivate(): Promise<void> {
  await client?.stop();
}
