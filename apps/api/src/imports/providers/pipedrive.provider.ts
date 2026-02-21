/**
 * Pipedrive provider adapter — fetches persons via Pipedrive API v1.
 * Requires API token (Settings → Personal preferences → API).
 */
import type { CanonicalContact } from "../migration-types";

export const PIPEDRIVE_PROVIDER = "pipedrive" as const;

interface PipedrivePerson {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: Array<{ value: string }>;
  phone?: Array<{ value: string }>;
}

interface PipedrivePersonsResponse {
  success: boolean;
  data?: PipedrivePerson[];
  additional_data?: { pagination?: { more_items_in_collection: boolean; next_start: number } };
}

export async function fetchPipedrivePersons(apiToken: string): Promise<CanonicalContact[]> {
  const all: CanonicalContact[] = [];
  let start = 0;
  const limit = 100;

  do {
    const url = new URL("https://api.pipedrive.com/api/v1/persons");
    url.searchParams.set("api_token", apiToken);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("start", String(start));

    const res = await fetch(url.toString());

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pipedrive API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as PipedrivePersonsResponse;
    if (!data.success || !data.data) {
      throw new Error(data.data ? "Pipedrive API returned no data" : "Pipedrive API error");
    }

    for (const p of data.data) {
      const firstName = (p.first_name ?? "").trim();
      const lastName = (p.last_name ?? "").trim();
      const fullName = (p.name ?? [firstName, lastName].filter(Boolean).join(" ")).trim() || "Unknown";
      const parts = fullName.split(/\s+/);
      const first = firstName || (parts[0] ?? "");
      const last = lastName || parts.slice(1).join(" ") || undefined;
      const email = p.email?.[0]?.value?.trim();
      const phone = p.phone?.[0]?.value?.trim();

      all.push({
        externalId: String(p.id),
        firstName: first || fullName,
        lastName: last || undefined,
        email: email || undefined,
        mobile: phone || undefined,
      });
    }

    const more = data.additional_data?.pagination?.more_items_in_collection;
    const nextStart = data.additional_data?.pagination?.next_start;
    if (!more || nextStart == null) break;
    start = nextStart;
  } while (true);

  return all;
}
