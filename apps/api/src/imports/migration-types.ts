/**
 * Canonical import schema for CRM migration from Salesforce, HubSpot,
 * Dynamics, Zoho, Pipedrive, or CSV.
 */

export interface CanonicalContact {
  externalId?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  tags?: string[];
}

export interface CanonicalCompany {
  externalId?: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface CanonicalDeal {
  externalId?: string;
  title: string;
  stage: string;
  amount?: number;
  contactId?: string;
  companyId?: string;
}

export interface CanonicalActivity {
  externalId?: string;
  type: string;
  subject?: string;
  body?: string;
  createdAt: string;
  contactId?: string;
}

export interface CanonicalTask {
  externalId?: string;
  title: string;
  dueAt?: string;
  completedAt?: string;
  contactId?: string;
  dealId?: string;
}

export interface CanonicalTicket {
  externalId?: string;
  title: string;
  status: string;
  priority?: string;
  contactId?: string;
}

export type MigrationEntity = "contacts" | "companies" | "deals" | "activities" | "tasks" | "tickets";

export type MigrationSource = "csv" | "salesforce" | "hubspot" | "dynamics" | "zoho" | "pipedrive";

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  entityType: MigrationEntity;
  transform?: "lowercase" | "uppercase" | "trim" | "date";
}

export interface MigrationValidationReport {
  totalRows: number;
  validRows: number;
  errorCount: number;
  errors: Array<{ rowIndex: number; field: string; message: string }>;
}

export interface DryRunResult {
  mode: "dry_run";
  wouldImport: number;
  wouldSkip: number;
  duplicateCount: number;
  validationReport: MigrationValidationReport;
}

export interface ReconciliationReport {
  batchId: string;
  imported: number;
  skipped: number;
  errors: Array<{ rowIndex: number; message: string }>;
  createdAt: string;
}
