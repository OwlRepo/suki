import { describe, expect, it } from "vitest";
import { AutomationMessageComposerService } from "./automation-message-composer.service";

describe("AutomationMessageComposerService", () => {
  it("renders custom template placeholders", () => {
    const svc = new AutomationMessageComposerService();
    const out = svc.compose(
      "post_visit_followup",
      {
        customerName: "Ana",
        scheduledAt: new Date("2026-05-10T08:00:00.000Z"),
        staffName: "Mia",
        rebookLink: "https://x.test",
      },
      "Hi {customerName}, see you on {dateTime}. Ask for {staffName}. {link}",
    );

    expect(out).toContain("Ana");
    expect(out).toContain("Mia");
    expect(out).toContain("https://x.test");
    expect(out).not.toContain("{customerName}");
  });
});
