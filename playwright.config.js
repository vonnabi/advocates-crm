import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8001",
    trace: "on-first-retry"
  },
  webServer: {
    command: "cd backend && ../.venv/bin/python manage.py runserver 127.0.0.1:8001",
    url: "http://127.0.0.1:8001",
    reuseExistingServer: true,
    timeout: 10_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
