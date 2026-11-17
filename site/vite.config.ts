import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The widget reference reads the compiler's own registry (../registry).
  server: { fs: { allow: [".."] } },
});
