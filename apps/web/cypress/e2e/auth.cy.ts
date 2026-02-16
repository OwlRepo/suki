import { skipWhenNoClerk } from "../support/commands";

describe("Auth flows", () => {
  beforeEach(function () {
    skipWhenNoClerk(this);
  });

  it("redirects to sign-in when visiting sign-in route", () => {
    cy.visit("/sign-in");
    cy.url().should("include", "/sign-in");
    cy.get("body").should("be.visible");
  });

  it("redirects to sign-up when visiting sign-up route", () => {
    cy.visit("/sign-up");
    cy.url().should("include", "/sign-up");
    cy.get("body").should("be.visible");
  });
});
