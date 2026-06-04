import { describe, expect, it } from "vitest";
import { buildManualFollowUpDigestEmail } from "./manual-follow-up-email.template";

describe("buildManualFollowUpDigestEmail", () => {
  it("contains no customer PII", () => {
    const email = buildManualFollowUpDigestEmail({
      count: 2,
      frontendUrl: "https://app.tyvera.test",
    });

    expect(email.subject).toBe("2 reminders need attention");
    expect(email.body).toContain("https://app.tyvera.test/needs-attention");
    expect(email.body).not.toContain("+639");
    expect(email.body).not.toContain("Ana");
    expect(email.body).not.toContain("Reminder body");
  });
});
