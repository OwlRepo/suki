describe("Loyalty flow", () => {
  it("loads loyalty page", () => {
    cy.visit("/loyalty");
    cy.get("body").should("be.visible");
    cy.contains("Loyalty").should("be.visible");
  });
});
