import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/shims/server-only.ts") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/quotecue_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123456789",
      APP_URL: "http://localhost:3000",
      STORAGE_PROVIDER: "memory",
      DEMO_MODE: "false",
      ALLOW_MOCK_PROVIDERS: "true",
    },
  },
});
