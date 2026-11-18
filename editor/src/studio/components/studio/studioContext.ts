// Synced from Upskale Studio (upskaleapp/src/components/studio/studioContext.ts). Edit it there, then npm run sync.
import { type StudioProject, type StorageMode, type ProjectType } from "../../lib/studio/types";


export interface StudioContextValue {
  projects: StudioProject[];
  loading: boolean;
  mode: StorageMode;
  /** From a starter example, the blank website, or a store template (templates.ts). */
  createProject(exampleId: string, name: string, type?: ProjectType): Promise<StudioProject>;
  saveProject(draft: StudioProject, label?: string): Promise<StudioProject>;
  renameProject(id: string, name: string): Promise<void>;
  duplicateProject(id: string): Promise<StudioProject>;
  /** A project from a `.upskale.json` file (src/lib/studio/projectFile.ts), added as a new one. */
  importProject(fileText: string): Promise<StudioProject>;
  deleteProject(id: string): Promise<void>;
  restoreRevision(
    projectId: string,
    revisionId: string,
  ): Promise<StudioProject>;
}

export { useStudio } from "../../functions/studio/studio-context/index";
export { StudioContext } from "../../constants/studio/studio-context/index";
