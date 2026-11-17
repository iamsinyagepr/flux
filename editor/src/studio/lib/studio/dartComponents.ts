// Synced from Upskale Studio (upskaleapp/src/lib/studio/dartComponents.ts). Edit it there, then npm run sync.
/**
 * Dart mode (dartMode.ts): a project converted, for good, to the Flutter
 * code its Flux compiled to, built as its files are. What Studio checks of
 * those files: their paths and sizes, never their Dart.
 */

// --- Dart mode (dartMode.ts): a project converted to Dart, built as its files are ---

export const DART_CONFIG_PATH = "lib/upskale_config.dart";
export const MAX_DART_PROJECT_FILES = 400;
export const MAX_DART_PROJECT_FILE_BYTES = 524288;
/** A build or a run sends the whole project (the API takes up to 2 MB a request). */
export const MAX_DART_PROJECT_BYTES = 1536 * 1024;

/** A file a Dart project may hold: its pubspec and root files, and what's under lib/, assets/ and test/. */
export const DART_PROJECT_PATH =
  /^(?:pubspec\.yaml|analysis_options\.yaml|README\.md|\.gitignore|(?:lib|assets|test)\/(?:[A-Za-z0-9_][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_][A-Za-z0-9_.-]*)$/;

const bytes = (text: string) => new TextEncoder().encode(text).length;

/** Why a Dart project's files can't be built, or undefined. */
export function dartProjectProblem(files: Record<string, string> | undefined): string | undefined {
  const names = Object.keys(files ?? {});
  if (!names.length) return "A Dart project has no files.";
  if (names.length > MAX_DART_PROJECT_FILES) return `A Dart project can have up to ${MAX_DART_PROJECT_FILES} files.`;
  let total = 0;
  for (const name of names) {
    const source = files![name];
    if (typeof source !== "string") return `${name} must be text.`;
    if (!DART_PROJECT_PATH.test(name)) return `Studio can't build ${name}: files go in lib/, assets/ or test/, or are pubspec.yaml.`;
    if (name === DART_CONFIG_PATH) return `${DART_CONFIG_PATH} is Studio's: it's written on every build.`;
    if (bytes(source) > MAX_DART_PROJECT_FILE_BYTES) return `${name} is over 512 KB.`;
    total += bytes(source);
  }
  if (total > MAX_DART_PROJECT_BYTES) return "A Dart project is over 1.5 MB in total.";
  if (!files!["lib/main.dart"] || !files!["pubspec.yaml"]) return "A Dart project needs lib/main.dart and pubspec.yaml.";
  return undefined;
}

