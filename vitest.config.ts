import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: "test", PGLITE_DIR: "memory", STORAGE_DRIVER: "local", LOCAL_UPLOAD_DIR: ".data/test-uploads" },
  },
});
