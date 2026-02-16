import { skipWhenNoClerk } from "../support/commands";

describe("Promos flow", () => {
  it("loads promos page when Clerk configured", function () {
    skipWhenNoClerk(this);
    cy.visit("/promos");
    cy.get("body").should("be.visible");
  });
});
