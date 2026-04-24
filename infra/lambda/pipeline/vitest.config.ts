import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    globals: false,
  },
  resolve: {
    // The source files use `./foo.js` ESM-style relative imports so the
    // esbuild-bundled output resolves cleanly under Node 20 ESM. Vitest
    // normally handles this, but we make it explicit.
    extensions: [".ts", ".js"],
  },
});
