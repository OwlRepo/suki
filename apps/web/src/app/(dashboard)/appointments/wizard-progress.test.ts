import { describe, expect, it } from "vitest";
import { buildAppointmentWizardSteps } from "./wizard-progress";

describe("buildAppointmentWizardSteps", () => {
  it("marks previous steps done and current active", () => {
    const steps = buildAppointmentWizardSteps("review");
    expect(steps.find((s) => s.id === "customer")?.state).toBe("done");
    expect(steps.find((s) => s.id === "review")?.state).toBe("active");
    expect(steps.find((s) => s.id === "verify")?.state).toBe("pending");
  });
});
