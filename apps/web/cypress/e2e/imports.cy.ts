import { skipWhenNoClerk } from "../support/commands";

describe("Imports flow", () => {
  it("loads imports page", () => {
    cy.visit("/imports");
    cy.get("body").should("be.visible");
    cy.contains("Import customers").should("be.visible");
  });

  it("shows source selection (CSV, HubSpot, Pipedrive)", function () {
    skipWhenNoClerk(this);
    cy.intercept("POST", "**/auth/sync", {
      organization: { id: "org1", name: "Test Org" },
      user: { id: "u1", email: "test@test.com" },
    }).as("authSync");
    cy.intercept("GET", "**/users/me/workspace", {
      activeBusinessId: "b1",
      businesses: [{ id: "b1", name: "Test Biz", crmMode: "lite", workflowProfile: "general" }],
    }).as("workspace");
    cy.visit("/imports");
    cy.wait("@workspace", { timeout: 5000 });
    cy.contains("Import customers").should("be.visible");
    cy.contains("CSV / Excel").should("be.visible");
    cy.contains("HubSpot").should("be.visible");
    cy.contains("Pipedrive").should("be.visible");
  });

  it("navigates from source to CSV paste flow", function () {
    skipWhenNoClerk(this);
    cy.intercept("POST", "**/auth/sync", {
      organization: { id: "org1", name: "Test Org" },
      user: { id: "u1", email: "test@test.com" },
    }).as("authSync");
    cy.intercept("GET", "**/users/me/workspace", {
      activeBusinessId: "b1",
      businesses: [{ id: "b1", name: "Test Biz", crmMode: "lite", workflowProfile: "general" }],
    }).as("workspace");
    cy.visit("/imports");
    cy.wait("@workspace", { timeout: 5000 });
    cy.contains("CSV / Excel").click();
    cy.contains("Continue to CSV / Excel").should("be.visible").click();
    cy.contains("Choose CSV or Excel file").should("be.visible");
    cy.contains("Paste CSV instead").should("be.visible");
  });

  it("completes dry-run and commit flow with mocked API", function () {
    skipWhenNoClerk(this);
    cy.on("window:confirm", () => true);
    cy.intercept("POST", "**/auth/sync", {
      organization: { id: "org1", name: "Test Org" },
      user: { id: "u1", email: "test@test.com" },
    }).as("authSync");
    cy.intercept("GET", "**/users/me/workspace", {
      activeBusinessId: "b1",
      businesses: [{ id: "b1", name: "Test Biz", crmMode: "lite", workflowProfile: "general" }],
    }).as("workspace");
    cy.visit("/imports");
    cy.intercept("GET", "**/health/feature-flags", {
      workspace_global_enabled: true,
      crm_mode_toggle_enabled: true,
      ai_usage_transparency_enabled: true,
      onboarding_v2_enabled: true,
    }).as("flags");
    cy.intercept("POST", "**/imports/parse", {
      rows: [
        { name: "Alice", mobile: "555-1234", notes: "VIP", rowIndex: 2 },
        { name: "Bob", mobile: "555-5678", rowIndex: 3 },
      ],
      errors: [],
    }).as("parse");
    cy.intercept("POST", "**/imports/duplicates", { duplicates: [] }).as("duplicates");
    cy.intercept("POST", "**/imports/dry-run", {
      mode: "dry_run",
      wouldImport: 2,
      wouldSkip: 0,
      duplicateCount: 0,
      validationReport: { totalRows: 2, validRows: 2, errorCount: 0 },
    }).as("dryRun");
    cy.intercept("POST", "**/imports/commit", {
      imported: 2,
      customers: [{ id: "c1", name: "Alice" }, { id: "c2", name: "Bob" }],
      report: {
        batchId: "batch-123",
        imported: 2,
        skipped: 0,
        errors: [],
        createdAt: new Date().toISOString(),
      },
    }).as("commit");
    cy.intercept("POST", "**/imports/batches/*/rollback", { rolledBack: 2 }).as("rollback");

    cy.wait("@workspace", { timeout: 5000 });
    cy.contains("CSV / Excel").click();
    cy.contains("Continue to CSV / Excel").click();
    cy.contains("Paste CSV instead").click();
    cy.get("textarea").type("name,mobile,notes\nAlice,555-1234,VIP\nBob,555-5678");
    cy.contains("Parse and check duplicates").click();
    cy.wait(["@parse", "@duplicates"]);
    cy.contains("Dry-run preview").click();
    cy.wait("@dryRun");
    cy.contains("Would import: 2").should("be.visible");
    cy.contains("Go live").click();
    cy.wait("@commit");
    cy.contains("Successfully imported 2 customer").should("be.visible");
    cy.contains("Rollback this import").click();
    cy.wait("@rollback");
    cy.contains("Import more").should("be.visible");
  });

  it("shows reconciliation history when batches exist", function () {
    skipWhenNoClerk(this);
    cy.intercept("POST", "**/auth/sync", {
      organization: { id: "org1", name: "Test Org" },
      user: { id: "u1", email: "test@test.com" },
    }).as("authSync");
    cy.intercept("GET", "**/users/me/workspace", {
      activeBusinessId: "b1",
      businesses: [{ id: "b1", name: "Test Biz", crmMode: "lite", workflowProfile: "general" }],
    }).as("workspace");
    cy.intercept("GET", "**/imports/batches*", [
      {
        id: "batch-1",
        businessId: "b1",
        source: "csv",
        entityType: "contacts",
        status: "completed",
        importedCount: 5,
        skippedCount: 1,
        errorCount: 0,
        createdAt: new Date().toISOString(),
      },
    ]).as("batches");
    cy.visit("/imports");
    cy.wait("@workspace", { timeout: 5000 });
    cy.wait("@batches", { timeout: 5000 });
    cy.contains("Reconciliation history").should("be.visible");
  });
});
