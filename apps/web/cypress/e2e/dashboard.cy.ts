import { skipWhenNoClerk } from "../support/commands";

describe("Dashboard", () => {
  it("shows dashboard structure when Clerk not configured", function () {
    if (Cypress.env("hasClerk")) {
      this.skip();
    }
    cy.visit("/dashboard");
    cy.contains("Dashboard").should("be.visible");
  });

  it("shows dashboard with summary and navigation when Clerk configured", function () {
    skipWhenNoClerk(this);
    cy.visit("/dashboard");
    cy.contains("h1", "Dashboard").should("be.visible");
    cy.contains("Overview of your business").should("be.visible");
    cy.contains("Business setup").should("be.visible");
    cy.contains("Customers").should("be.visible");
  });

  it("shows summary cards (businesses, customers, appointments, promos)", function () {
    skipWhenNoClerk(this);
    cy.intercept("GET", "**/admin/summary", { businesses: 1, customers: 10, appointments: 5, promos: 2 }).as("summary");
    cy.intercept("GET", "**/businesses", { businesses: [{ id: "b1", name: "Test Biz" }] }).as("businesses");
    cy.intercept("GET", "**/admin/usage*", {
      activeCustomers: 10,
      newCustomersThisMonth: 2,
      visitsThisMonth: 4,
      promosSentThisMonth: 1,
      month: "2025-02",
    }).as("usage");
    cy.intercept("GET", "**/admin/activity*", { activities: [] }).as("activity");
    cy.visit("/dashboard");
    cy.wait(["@summary", "@businesses", "@usage", "@activity"]);
    cy.contains("Businesses").should("be.visible");
    cy.contains("Customers").should("be.visible");
    cy.contains("Appointments").should("be.visible");
    cy.contains("Promos").should("be.visible");
  });

  it("shows This month usage section when data available", function () {
    skipWhenNoClerk(this);
    cy.intercept("GET", "**/admin/summary", { businesses: 1, customers: 42, appointments: 0, promos: 0 });
    cy.intercept("GET", "**/businesses", { businesses: [{ id: "b1", name: "Test Biz" }] });
    cy.intercept("GET", "**/admin/usage*", {
      activeCustomers: 42,
      newCustomersThisMonth: 5,
      visitsThisMonth: 12,
      promosSentThisMonth: 3,
      month: "2025-02",
    });
    cy.intercept("GET", "**/admin/activity*", { activities: [] });
    cy.visit("/dashboard");
    cy.contains("This month", { timeout: 5000 }).should("be.visible");
    cy.contains("Active customers").should("be.visible");
    cy.contains("New customers").should("be.visible");
    cy.contains("Visits").should("be.visible");
  });

  it("shows Recent activity when activities exist", function () {
    skipWhenNoClerk(this);
    cy.intercept("GET", "**/admin/summary", { businesses: 1, customers: 1, appointments: 0, promos: 0 });
    cy.intercept("GET", "**/businesses", { businesses: [{ id: "b1", name: "Test Salon" }] });
    cy.intercept("GET", "**/admin/usage*", {
      activeCustomers: 1,
      newCustomersThisMonth: 0,
      visitsThisMonth: 0,
      promosSentThisMonth: 0,
      month: "2025-02",
    });
    cy.intercept("GET", "**/admin/activity*", {
      activities: [
        { type: "customer_added", description: 'Customer "Alice" added', at: "2025-02-16T10:00:00Z", businessName: "Test Salon" },
      ],
    });
    cy.visit("/dashboard");
    cy.contains("Recent activity", { timeout: 5000 }).should("be.visible");
    cy.contains("Customer \"Alice\" added").should("be.visible");
  });
});
