import { describe, expect, it } from "vitest";
import { MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET } from "./manual-follow-up.constants";

describe("ManualFollowUpService constants", () => {
  it("supports only appointment-related urgent SMS keys", () => {
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("appointment_confirmation")).toBe(true);
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("appointment_reminder_24h")).toBe(true);
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("post_visit_followup")).toBe(false);
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("loyalty_unlock")).toBe(false);
  });
});
