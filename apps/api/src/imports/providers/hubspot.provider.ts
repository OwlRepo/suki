/**
 * HubSpot provider adapter — fetches contacts via HubSpot CRM API v3.
 * Requires OAuth access token (Private App token or user token).
 */
import type { CanonicalContact } from "../migration-types";

export const HUBSPOT_PROVIDER = "hubspot" as const;

interface HubSpotContactProperties {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  mobilephone?: string;
}

interface HubSpotContactResult {
  id: string;
  properties: HubSpotContactProperties;
}

interface HubSpotSearchResponse {
  results: HubSpotContactResult[];
  paging?: { next?: { after: string } };
}

export async function fetchHubSpotContacts(accessToken: string): Promise<CanonicalContact[]> {
  const all: CanonicalContact[] = [];
  const properties = "firstname,lastname,email,phone,mobilephone";
  let after: string | undefined;

  do {
    const url = new URL("https://api.hubapi.com/crm/v3/objects/contacts");
    url.searchParams.set("limit", "100");
    url.searchParams.set("properties", properties);
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HubSpot API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as HubSpotSearchResponse;
    for (const r of data.results ?? []) {
      const props = r.properties ?? {};
      const firstName = (props.firstname ?? "").trim();
      const lastName = (props.lastname ?? "").trim();
      const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
      all.push({
        externalId: r.id,
        firstName: firstName || name,
        lastName: lastName || undefined,
        email: props.email?.trim() || undefined,
        mobile: (props.mobilephone ?? props.phone)?.trim() || undefined,
      });
    }

    after = data.paging?.next?.after;
  } while (after);

  return all;
}
