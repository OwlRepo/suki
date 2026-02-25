/**
 * Founder allowlist: comma-separated emails and/or Clerk user IDs from env.
 * FOUNDER_ALLOWLIST_EMAILS - e.g. "founder@example.com,admin@example.com"
 * FOUNDER_ALLOWLIST_USER_IDS - e.g. "user_2abc,user_2xyz" (Clerk sub claims)
 */
const EMAILS_KEY = "FOUNDER_ALLOWLIST_EMAILS";
const USER_IDS_KEY = "FOUNDER_ALLOWLIST_USER_IDS";

let cachedEmails: Set<string> | null = null;
let cachedUserIds: Set<string> | null = null;

function parseList(raw: string | undefined): Set<string> {
  if (!raw || typeof raw !== "string") return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getFounderAllowlistEmails(): Set<string> {
  if (cachedEmails === null) {
    cachedEmails = parseList(process.env[EMAILS_KEY]);
  }
  return cachedEmails;
}

export function getFounderAllowlistUserIds(): Set<string> {
  if (cachedUserIds === null) {
    cachedUserIds = parseList(process.env[USER_IDS_KEY]);
  }
  return cachedUserIds;
}

export function isFounder(clerkId?: string, email?: string): boolean {
  const emails = getFounderAllowlistEmails();
  const userIds = getFounderAllowlistUserIds();
  if (emails.size === 0 && userIds.size === 0) return false;
  if (clerkId && userIds.has(clerkId.toLowerCase())) return true;
  if (email && emails.has(email.trim().toLowerCase())) return true;
  return false;
}
