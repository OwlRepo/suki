describe("Intake public submission", () => {
  const mockConfig = {
    template: {
      id: "default",
      name: "Default",
      fieldsConfig: [
        { key: "source", label: "Source", placeholder: "How did they find you?" },
      ],
    },
  };

  beforeEach(() => {
    cy.intercept("GET", "**/intake/config*", { statusCode: 200, body: mockConfig }).as("intakeConfig");
  });

  it("shows intake form for a business", () => {
    cy.visit("/intake/test-business-id");
    cy.wait("@intakeConfig");
    cy.contains("Customer intake").should("be.visible");
    cy.get('input[placeholder="e.g. Juan Dela Cruz"]').should("be.visible");
    cy.get('button[type="submit"]').should("exist");
  });

  it("submits intake form and shows thank you when API succeeds", () => {
    cy.intercept("POST", "**/intake", {
      statusCode: 200,
      body: { success: true, customer: { id: "1", name: "E2E Test" } },
    }).as("intakeSubmit");
    cy.visit("/intake/test-business-id");
    cy.wait("@intakeConfig");
    cy.get('input[placeholder="e.g. Juan Dela Cruz"]').type("E2E Test User");
    cy.get('button[type="submit"]').click();
    cy.wait("@intakeSubmit");
    cy.contains("Thank you", { timeout: 5000 }).should("be.visible");
  });
});
