describe("Imports flow", () => {
  it("loads imports page", () => {
    cy.visit("/imports");
    cy.get("body").should("be.visible");
    cy.contains("Import customers").should("be.visible");
  });
});
