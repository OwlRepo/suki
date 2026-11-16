import { describe, expect, it } from "vitest";
import { buildManualFollowUpDigestEmail } from "./manual-follow-up-email.template";

describe("buildManualFollowUpDigestEmail", () => {
  it("contains no customer PII", () => {
    const email = buildManualFollowUpDigestEmail({
      count: 2,
      frontendUrl: "https://suki.example.test",
    });

    expect(email.subject).toBe("2 reminders need attention");
    expect(email.body).toContain("https://suki.example.test/needs-attention");
    expect(email.body).not.toContain("+639");
    expect(email.body).not.toContain("Ana");
    expect(email.body).not.toContain("Reminder body");
  });
});
