import { skipWhenNoClerk } from "../support/commands";

describe("Appointments flow", () => {
  it("loads appointments page when Clerk configured", function () {
    skipWhenNoClerk(this);
    cy.visit("/appointments");
    cy.get("body").should("be.visible");
  });
});
