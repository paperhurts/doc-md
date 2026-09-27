import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  clearScreen: false,
  // Pre-bundle every lazily-imported Tauri module. Without this, Vite
  // discovers them mid-session (first capture / sticky note), re-optimizes,
  // and force-reloads the app — closing all open tabs.
  optimizeDeps: {
    include: [
      "@tauri-apps/api/core",
      "@tauri-apps/api/event",
      "@tauri-apps/api/window",
      "@tauri-apps/api/webviewWindow",
      "@tauri-apps/plugin-dialog",
    ],
  },
  server: {
    port: 5420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          // Not Tauri's template default (1421): other Tauri projects on the
          // dev machine use it. 5420-5429 is doc-md's block in the machine
          // port registry (server-start's config.toml).
          port: 5422,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Unpinned, `vite preview` would take 4173, which another project on the
  // dev machine uses. 4420 mirrors the dev port (the 5xxx dev / 4xxx preview
  // convention); strictPort makes a clash an error instead of a silent hop.
  preview: {
    port: 4420,
    strictPort: true,
  },
});
