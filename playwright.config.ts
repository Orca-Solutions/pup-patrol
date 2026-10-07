import { defineConfig, devices } from "@playwright/test";

/**
 * The browser tests run against the production build (vite preview) and the local creek,
 * one at a time: they share the creek, and one of them pauses its source.
 */
const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    // Everything the tests reach is on this machine.
    launchOptions: { args: ["--no-proxy-server"], ...(executablePath ? { executablePath } : {}) }
  },
  webServer: [
    {
      command: "node dev/creek.ts",
      url: "http://127.0.0.1:7502/api/config",
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000
    },
    {
      command: "npx vite build && npx vite preview",
      url: "http://127.0.0.1:4173",
      env: { VITE_FIELD_STATION_ORIGIN: "http://127.0.0.1:7502" },
      reuseExistingServer: !process.env["CI"],
      timeout: 120_000
    }
  ]
});
