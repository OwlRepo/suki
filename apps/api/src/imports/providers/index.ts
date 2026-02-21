/**
 * CRM migration provider adapters.
 * CSV, HubSpot, and Pipedrive are implemented.
 */

export { csvToCanonicalContacts, CSV_PROVIDER } from "./csv.provider";
export { fetchHubSpotContacts, HUBSPOT_PROVIDER } from "./hubspot.provider";
export { fetchPipedrivePersons, PIPEDRIVE_PROVIDER } from "./pipedrive.provider";

export type { CsvRow } from "./csv.provider";
