import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/mock-backend.mjs",
      url: "http://127.0.0.1:4311/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        BACKEND_URL: "http://127.0.0.1:4311",
        SITE_URL: "https://description.example",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        GOOGLE_REDIRECT_URI: "",
      },
    },
  ],
});
