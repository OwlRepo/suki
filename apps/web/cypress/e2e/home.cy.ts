describe("Home page", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("shows Suki branding and CTA", () => {
    cy.contains("h1", "Suki").should("be.visible");
    cy.contains("Customer engagement for Philippine small business").should("be.visible");
  });
});
