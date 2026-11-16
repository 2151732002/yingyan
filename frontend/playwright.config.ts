import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.CI
    ? [
        {
          command:
            "java -jar target/yingyan-server-0.1.0.jar --spring.profiles.active=demo",
          cwd: "../backend",
          url: "http://127.0.0.1:18080/actuator/health",
          timeout: 60000,
        },
        {
          command: "npm run start",
          url: "http://127.0.0.1:3100",
          timeout: 60000,
        },
      ]
    : undefined,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.E2E_CHANNEL || "msedge",
      },
    },
  ],
});
