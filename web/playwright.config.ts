import { defineConfig, devices } from "@playwright/test";

function testUrl(value: string, name: string): URL {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      ["3000", "8000"].includes(url.port) || !url.port || url.protocol !== "http:") {
    throw new Error(`${name} must use a dedicated local HTTP port, excluding 3000/8000.`);
  }
  return url;
}

const frontend = testUrl(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3123", "PLAYWRIGHT_BASE_URL");
const api = testUrl(process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8123/api/v1", "API_BASE_URL");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  // Each run receives a fresh seed namespace. Retrying a mutable shared scenario
  // against the same records would hide failures or publish extra lesson versions.
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: "./e2e/.artifacts/results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "./e2e/.artifacts/report", open: "never" }],
    ["junit", { outputFile: "./e2e/.artifacts/junit.xml" }],
  ],
  use: {
    baseURL: frontend.origin,
    timezoneId: "Australia/Sydney",
    locale: "en-AU",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --hostname ${frontend.hostname} --port ${frontend.port}`,
    url: `${frontend.origin}/auth/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NEXT_PUBLIC_API_BASE_URL: api.href.replace(/\/$/, ""), NEXT_TELEMETRY_DISABLED: "1" },
  },
});
