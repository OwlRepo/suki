import { skipWhenNoClerk } from "../support/commands";

describe("Settings flow", () => {
  it("loads settings page", () => {
    cy.visit("/settings");
    cy.get("body").should("be.visible");
    cy.contains("Settings").should("be.visible");
  });

  it("hides CRM mode toggle when flag disabled", function () {
    skipWhenNoClerk(this);
    cy.intercept("POST", "**/auth/sync", {
      organization: { id: "org1", name: "Test Org" },
      user: { id: "u1", email: "test@test.com" },
    }).as("authSync");
    cy.intercept("GET", "**/users/me/workspace", {
      activeBusinessId: "b1",
      businesses: [
        { id: "b1", name: "Biz", businessType: "restaurant", crmMode: "lite", workflowProfile: "general" },
      ],
    }).as("workspace");
    cy.intercept("GET", "**/health/feature-flags", {
      workspace_global_enabled: true,
      crm_mode_toggle_enabled: false,
      ai_usage_transparency_enabled: true,
      onboarding_v2_enabled: true,
    }).as("flags");
    cy.intercept("GET", "**/organizations/me", {
      organization: { id: "org1", name: "Test Org" },
    }).as("org");
    cy.intercept("GET", "**/businesses", {
      businesses: [
        { id: "b1", name: "Biz", businessType: "restaurant", crmMode: "lite", workflowProfile: "general" },
      ],
    }).as("businesses");
    cy.intercept("GET", "**/billing/status", {
      status: "active",
      planType: "growth",
      readOnly: false,
      subscription: null,
    }).as("billing");
    cy.visit("/settings");
    cy.wait(["@workspace", "@flags", "@org", "@businesses", "@billing"], { timeout: 8000 });
    cy.contains("Businesses").should("be.visible");
    cy.contains("CRM Full").should("not.exist");
  });
});
