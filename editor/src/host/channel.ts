// The overlay's line to flux dev: the project's sources and their problems,
// saving an edited source, uploading an image, and word when anything
// changed on disk (an edit in another editor, a rebuild).
//
// flux dev serves this script from its own address with a session token
// (…/__flux/overlay.js?t=…): every request carries it, so no other site
// open in the browser can read or write the project.
import type { StudioDiagnostic } from "../studio/lib/studio/languageService";
import type { StudioConfig } from "../studio/lib/studio/projectConfig";

const script = new URL(import.meta.url);
const base = script.origin + "/__flux";
const token = script.searchParams.get("t") ?? "";

export interface ProjectFile {
  /** Inside the project: pages/home.flx. */
  path: string;
  /** How the compilers name it: a page's id, component:Name, shared-shell, or "" for main.flx. */
  documentId: string;
  source: string;
}

export interface ProjectPage {
  id: string;
  name: string;
  path: string;
}

export interface ProjectState {
  name: string;
  files: ProjectFile[];
  pages: ProjectPage[];
  config?: StudioConfig;
  diagnostics: Record<string, StudioDiagnostic[]>;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(base + path, {
    ...init,
    headers: { ...(init.headers ?? {}), "X-Flux-Token": token },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error ?? `flux dev answered ${response.status}`);
  return body as T;
}

export function getProject(): Promise<ProjectState> {
  return call<ProjectState>("/project");
}

export class Conflict extends Error {}

/**
 * Saves a source. `before` is what the edit was made on: if the file has
 * changed on disk since (saved from another editor), nothing is written and
 * it throws a Conflict, so the edit can be made again on the new text.
 */
export async function saveSource(documentId: string, source: string, before: string): Promise<void> {
  try {
    await call("/source", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, source, before }),
    });
  } catch (problem) {
    if (problem instanceof Error && /changed on disk/.test(problem.message)) throw new Conflict(problem.message);
    throw problem;
  }
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  return call<{ url: string }>("/upload", {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "X-Flux-Name": encodeURIComponent(file.name) },
    body: file,
  });
}

/** Calls back whenever the project changes on disk or is rebuilt. */
export function subscribe(onChange: () => void): () => void {
  const events = new EventSource(`${base}/events?t=${encodeURIComponent(token)}`);
  events.addEventListener("changed", onChange);
  return () => events.close();
}
