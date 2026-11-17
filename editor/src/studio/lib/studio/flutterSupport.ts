// Synced from Upskale Studio (upskaleapp/src/lib/studio/flutterSupport.ts). Edit it there, then npm run sync.
/**
 * What the exported Flutter app can't draw yet. Everything else in the
 * registry is compiled (dartCompiler.ts) or drawn by the runtime it ships
 * (dartRuntime.ts); one of these would show as a placeholder card in the
 * app, so Studio's local checks warn where it's used, with the reason. Kept
 * honest by studio-dart.test.mjs: a widget can't be neither supported nor
 * listed here. Empty now: every widget draws natively.
 */
export const FLUTTER_PLACEHOLDERS: ReadonlyMap<string, string> = new Map<string, string>();
