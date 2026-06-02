import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.ts"],
  },
  resolve: {
    alias: {
      "@tyvera/database": path.resolve(__dirname, "../../packages/database/src/index.ts"),
      "@tyvera/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
    },
  },
});
