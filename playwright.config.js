// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173/unisch/",
    ...devices["Desktop Chrome"],
    // Local runs may point at a preinstalled Chromium (PW_CHROMIUM_PATH); CI
    // uses the browser installed by `npx playwright install chromium`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  webServer: {
    command: "node tests/server.js",
    url: "http://127.0.0.1:4173/unisch/",
    reuseExistingServer: !process.env.CI
  }
});
