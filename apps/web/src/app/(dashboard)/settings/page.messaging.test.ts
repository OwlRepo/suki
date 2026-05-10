import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Settings messaging/email usage integration hooks", () => {
  const file = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/settings/page.tsx"),
    "utf8",
  );

  it("loads SMS and email usage endpoints", () => {
    expect(file).toContain("/messaging/sms-usage");
    expect(file).toContain("/messaging/email-usage");
  });

  it("supports sms/email channel selection", () => {
    expect(file).toContain('autoSendChannel: "sms" | "email"');
    expect(file).toContain('SelectItem value="sms"');
    expect(file).toContain('SelectItem value="email"');
  });

  it("shows paused reason messaging map", () => {
    expect(file).toContain("PAUSED_REASON_MESSAGES");
    expect(file).toContain("cap_reached");
  });
});
