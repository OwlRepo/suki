/**
 * Zoho CRM provider adapter (stub).
 * Future: OAuth, Zoho Contacts API, map to canonical schema.
 */
export const ZOHO_PROVIDER = "zoho" as const;

export async function fetchZohoContacts(_accessToken: string): Promise<unknown[]> {
  // TODO: Zoho CRM API integration
  return [];
}
