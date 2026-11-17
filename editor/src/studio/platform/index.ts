// flux dev's stand-in for Studio's platform layer (upskaleapp/src/platform):
// the editors only remember UI choices (a collapsed section, a last tab), in
// the browser's storage. Blocked or full storage is never an error.
export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const prefix = "flux-editor:";

export const storage: KeyValue = {
  get(key) {
    try {
      return localStorage.getItem(prefix + key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(prefix + key, value);
    } catch {
      /* not remembered */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(prefix + key);
    } catch {
      /* nothing to forget */
    }
  },
};

export function isDesktop(): boolean {
  return false;
}
