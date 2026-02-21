/**
 * Salesforce provider adapter (stub).
 * Future: OAuth, export API, map Salesforce objects to canonical schema.
 */
export const SALESFORCE_PROVIDER = "salesforce" as const;

export async function fetchSalesforceContacts(_accessToken: string): Promise<unknown[]> {
  // TODO: Salesforce API integration
  return [];
}
