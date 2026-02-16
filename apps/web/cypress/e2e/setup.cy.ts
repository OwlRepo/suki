import { skipWhenNoClerk } from "../support/commands";

describe("Business setup flow", () => {
  it("shows setup page structure when Clerk not configured", function () {
    if (Cypress.env("hasClerk")) {
      this.skip();
    }
    cy.visit("/setup");
    cy.contains("Clerk authentication is not configured").should("be.visible");
  });

  it("shows setup form when Clerk configured", function () {
    skipWhenNoClerk(this);
    cy.visit("/setup");
    cy.contains("Business setup").should("be.visible");
    cy.contains("Business name").should("be.visible");
    cy.contains("Business type").should("be.visible");
    cy.get('button[type="submit"]').should("exist");
  });
});
