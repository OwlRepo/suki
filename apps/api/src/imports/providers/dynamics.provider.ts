/**
 * Microsoft Dynamics 365 provider adapter (stub).
 * Future: OAuth, Dataverse API, map Dynamics entities to canonical schema.
 */
export const DYNAMICS_PROVIDER = "dynamics" as const;

export async function fetchDynamicsContacts(_accessToken: string): Promise<unknown[]> {
  // TODO: Dynamics 365 API integration
  return [];
}
