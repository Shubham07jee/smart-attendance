import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubActions =
  (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process?.env?.GITHUB_ACTIONS === "true";

export default defineConfig({
  plugins: [react()],
  base: isGitHubActions ? "/smart-attendance/" : "/",
});
