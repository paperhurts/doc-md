import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    // Run Svelte in client (browser) mode under jsdom, not SSR mode
    conditions: ["browser"],
  },
});
