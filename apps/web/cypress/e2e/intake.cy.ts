describe("Intake public submission", () => {
  it("shows intake form for a business", () => {
    cy.visit("/intake/test-business-id");
    cy.contains("Customer intake").should("be.visible");
    cy.get('input[placeholder="Your name"]').should("be.visible");
    cy.get('button[type="submit"]').should("exist");
  });

  it("submits intake form and shows thank you when API succeeds", () => {
    cy.intercept("POST", "**/intake", { statusCode: 200, body: { success: true, customer: { id: "1", name: "E2E Test" } } }).as("intakeSubmit");
    cy.visit("/intake/test-business-id");
    cy.get('input[placeholder="Your name"]').type("E2E Test User");
    cy.get('button[type="submit"]').click();
    cy.wait("@intakeSubmit");
    cy.contains("Thank you", { timeout: 5000 }).should("be.visible");
  });
});
