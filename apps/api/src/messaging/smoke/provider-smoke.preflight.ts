export type PreflightResult = {
  ok: boolean;
  missing: string[];
  messages: string[];
};

function isMissing(v: string | undefined): boolean {
  if (!v) return true;
  const t = v.trim();
  return !t || t.toLowerCase().includes("placeholder");
}

export function getProviderSmokePreflight(env: NodeJS.ProcessEnv): PreflightResult {
  const missing: string[] = [];
  const messages: string[] = [];

  if (env.SMOKE_REAL_PROVIDERS !== "true") {
    messages.push("SMOKE_REAL_PROVIDERS is not 'true'; smoke tests are intentionally skipped.");
  }

  const twilioRequired = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "SMOKE_TWILIO_TO",
  ];
  const twilioSender = !isMissing(env.TWILIO_MESSAGING_SERVICE_SID) || !isMissing(env.TWILIO_PHONE_NUMBER);
  for (const k of twilioRequired) {
    if (isMissing(env[k])) missing.push(k);
  }
  if (!twilioSender) {
    missing.push("TWILIO_MESSAGING_SERVICE_SID|TWILIO_PHONE_NUMBER");
  }

  const resendRequired = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "SMOKE_RESEND_TO"];
  for (const k of resendRequired) {
    if (isMissing(env[k])) missing.push(k);
  }

  if (missing.length > 0) {
    messages.push(`Missing env: ${missing.join(", ")}`);
  }

  return { ok: env.SMOKE_REAL_PROVIDERS === "true" && missing.length === 0, missing, messages };
}
