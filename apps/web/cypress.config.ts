import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || "http://localhost:3000",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 720,
    env: {
      hasClerk:
        !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        !String(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).includes("placeholder"),
    },
  },
});
