// Synced from Upskale Studio (upskaleapp/src/lib/studio/editorNonce.ts). Edit it there, then npm run sync.
import { EditorView } from "@codemirror/view";

/**
 * CodeMirror adds its own styles as <style> elements. In the desktop app,
 * Tauri stamps a nonce on the page's own scripts and styles and adds it to the
 * CSP (tauri.conf.json), which turns 'unsafe-inline' off: the editor's styles
 * need the same nonce or they're blocked and the editor draws unstyled. On the
 * web there's no nonce, and nothing to add.
 */
const nonce =
  typeof document === "undefined"
    ? ""
    : (document.querySelector<HTMLElement>("style[nonce], script[nonce]")?.nonce ?? "");

export const editorNonce = nonce ? [EditorView.cspNonce.of(nonce)] : [];
