import { defineConfig } from "vitest/config";
import { testEnv } from "./test/env.js";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Test files share one database and truncate it, so run them one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: testEnv,
  },
});
