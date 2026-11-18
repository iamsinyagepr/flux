// Synced from Upskale Studio (upskaleapp/src/constants/studio/studio-context/index.ts). Edit it there, then npm run sync.
import { createContext } from "react";
import type { StudioContextValue } from "../../../components/studio/studioContext";

export const StudioContext = createContext<StudioContextValue | null>(null);
