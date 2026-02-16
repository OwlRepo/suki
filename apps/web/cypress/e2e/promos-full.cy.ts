describe("Promos full flow", () => {
  it("loads promos page", () => {
    cy.visit("/promos");
    cy.get("body").should("be.visible");
    cy.contains("Promos").should("be.visible");
  });
});
