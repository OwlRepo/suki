describe("Settings flow", () => {
  it("loads settings page", () => {
    cy.visit("/settings");
    cy.get("body").should("be.visible");
    cy.contains("Settings").should("be.visible");
  });
});
