import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const env = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

const base =
  env?.VITE_BASE_PATH ??
  (env?.GITHUB_ACTIONS === "true" ? "/smart-attendance/" : "/");

export default defineConfig({
  plugins: [react()],
  base,
});
