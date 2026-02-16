describe("Home page", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("shows Suki branding and hero", () => {
    cy.contains("Suki").should("be.visible");
    cy.contains("Grow repeat visits without adding complexity").should(
      "be.visible"
    );
    cy.contains("Customer engagement for Philippine small business").should(
      "be.visible"
    );
  });

  it("shows conversion CTAs", () => {
    cy.contains("a", /Start free|Sign in|Go to Dashboard/).should("be.visible");
  });

  it("shows key landing sections", () => {
    cy.contains("Common problems, practical solutions").should("be.visible");
    cy.contains("How it works").should("be.visible");
    cy.contains("AI that assists").should("be.visible");
    cy.contains("Before and after").should("be.visible");
    cy.contains("Suki vs generic CRM").should("be.visible");
    cy.contains("Plans that grow with your business").should("be.visible");
    cy.contains("Your data is safe").should("be.visible");
  });

  it("shows plan cards with pricing", () => {
    cy.contains("Basic").should("be.visible");
    cy.contains("Grow").should("be.visible");
    cy.contains("Pro").should("be.visible");
    cy.contains("₱499").should("be.visible");
    cy.contains("₱999").should("be.visible");
    cy.contains("₱1,499").should("be.visible");
  });
});
