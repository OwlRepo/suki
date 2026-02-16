describe("Insights flow", () => {
  it("loads insights page", () => {
    cy.visit("/insights");
    cy.get("body").should("be.visible");
    cy.contains("Insights").should("be.visible");
  });
});
