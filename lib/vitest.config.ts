import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/__tests__/setupTests.ts",
    include: [
      "src/__tests__/esm/**/*.test.tsx",
      "src/__tests__/esm/**/*.test.ts",
    ],
  },
});
