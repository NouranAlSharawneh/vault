import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve("src/shared"),
      "@main": resolve("src/main"),
      "@": resolve("src/renderer"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
