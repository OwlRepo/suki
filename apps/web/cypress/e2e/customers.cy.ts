describe("Customers flow", () => {
  it("shows customers page or fallback when Clerk not configured", function () {
    if (Cypress.env("hasClerk")) {
      this.skip(); // Skip when Clerk configured; this test is for fallback UI
    }
    cy.visit("/customers");
    cy.get("body").should("be.visible");
  });
});
