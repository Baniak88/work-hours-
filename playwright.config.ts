import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8081",
    timezoneId: "Europe/London",
    // The app follows the device language; the suite checks the Polish UI.
    locale: "pl-PL",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: {
    command: "python scripts/serve-preview.py",
    url: "http://127.0.0.1:8081",
    reuseExistingServer: true,
  },
});
