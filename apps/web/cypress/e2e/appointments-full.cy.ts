describe("Appointments full flow", () => {
  it("loads appointments page", () => {
    cy.visit("/appointments");
    cy.get("body").should("be.visible");
    cy.contains("Appointments").should("be.visible");
  });
});
