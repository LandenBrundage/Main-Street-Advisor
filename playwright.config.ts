import { defineConfig } from "@playwright/test";

const port = 3100;
const nodeExecutable = JSON.stringify(process.execPath);
const externalBaseURL = process.env.E2E_BASE_URL;
const readinessPath =
  process.env.ENABLE_DEMO_MODE === "true" ? "/app/tasks" : "/";
export default defineConfig({
  testDir: "./e2e",
  timeout: 600_000,
  expect: { timeout: 120_000 },
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: `${nodeExecutable} node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
          // In demo tests, wait for the largest critical route to compile
          // before the browser-test timeout starts.
          url: `http://127.0.0.1:${port}${readinessPath}`,
          reuseExistingServer: false,
          timeout: 300_000,
          env: {
            ...process.env,
            NEXT_DIST_DIR: ".next-e2e",
          },
        },
      }),
  use: {
    baseURL: externalBaseURL || `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
    storageState: process.env.E2E_AUTH_STORAGE || undefined,
  },
});
