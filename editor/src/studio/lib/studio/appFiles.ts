// Synced from Upskale Studio (upskaleapp/src/lib/studio/appFiles.ts). Edit it there, then npm run sync.
import { pageDataProblem } from "./pageData";
import { dartProjectProblem } from "./dartComponents";
import { validStudioConfig } from "./projectConfig";
import { validPageTransition } from "./pageTransitions";
import { MAX_SOURCE_BYTES, sourceBytes, type StudioAppFiles } from "./types";
export const SHELL_ID = "shared-shell";
export const COMPONENT_PREFIX = "component:";
export function documentSource(
  project: StudioAppFiles & { source: string },
  id?: string,
): string {
  if (id?.startsWith(COMPONENT_PREFIX))
    return project.componentSources?.[id.slice(COMPONENT_PREFIX.length)] ?? "";
  if (id === SHELL_ID)
    return project.componentSources?.SharedHeader ?? project.shellSource ?? "";
  return (
    project.pages?.find((page) => page.id === id)?.source ?? project.source
  );
}
export function appFiles(project: StudioAppFiles): StudioAppFiles {
  return {
    config: project.config ? structuredClone(project.config) : undefined,
    pages: project.pages ? structuredClone(project.pages) : undefined,
    shellSource: project.shellSource,
    entryPageId: project.entryPageId,
    componentSources: project.componentSources
      ? structuredClone(project.componentSources)
      : undefined,
    language: project.language,
    dartProject: project.dartProject ? { ...project.dartProject } : undefined,
  };
}
export function validAppFiles(value: StudioAppFiles): boolean {
  if (!validStudioConfig(value.config)) return false;
  if (value.language !== undefined && value.language !== "dart") return false;
  // A Dart project's source is its Flutter files (dartMode.ts): Studio checks their paths and sizes only.
  if (value.language === "dart") return !dartProjectProblem(value.dartProject) && validStudioConfig(value.config);
  const components = value.componentSources;
  if (
    components !== undefined &&
    (!components ||
      typeof components !== "object" ||
      Array.isArray(components) ||
      Object.keys(components).length > 20 ||
      !Object.entries(components).every(
        ([name, source]) =>
          /^[A-Z][A-Za-z0-9]{0,59}$/.test(name) &&
          typeof source === "string" &&
          sourceBytes(source) <= MAX_SOURCE_BYTES,
      ))
  )
    return false;
  const componentBytes = Object.values(components ?? {}).reduce(
    (bytes, source) => bytes + sourceBytes(source),
    0,
  );
  if (componentBytes > 524288) return false;
  if (value.pages === undefined)
    return value.shellSource === undefined && value.entryPageId === undefined;
  return (
    Array.isArray(value.pages) &&
    value.pages.length > 0 &&
    value.pages.length <= 20 &&
    new Set(value.pages.map((page) => page?.id)).size === value.pages.length &&
    new Set(value.pages.map((page) => page?.path)).size ===
      value.pages.length &&
    value.pages.every(
      (page) =>
        page &&
        typeof page.id === "string" &&
        /^[a-z][a-z0-9-]{0,59}$/.test(page.id) &&
        page.id !== SHELL_ID &&
        typeof page.name === "string" &&
        page.name.length <= 60 &&
        typeof page.path === "string" &&
        page.path.startsWith("/") &&
        page.path.length <= 200 &&
        typeof page.source === "string" &&
        sourceBytes(page.source) <= MAX_SOURCE_BYTES &&
        (page.transition === undefined || validPageTransition(page.transition)) &&
        (page.data === undefined || Array.isArray(page.data)) &&
        !pageDataProblem(page.data, page.seo, page.path),
    ) &&
    value.pages.some((page) => page.id === value.entryPageId) &&
    typeof value.shellSource === "string" &&
    sourceBytes(value.shellSource) <= MAX_SOURCE_BYTES &&
    value.pages.reduce(
      (bytes, page) => bytes + sourceBytes(page.source),
      sourceBytes(value.shellSource) + componentBytes,
    ) <= 524288
  );
}
