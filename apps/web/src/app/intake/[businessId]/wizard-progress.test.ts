import { describe, expect, it } from "vitest";
import { buildWizardSteps } from "./wizard-progress";

describe("buildWizardSteps", () => {
  it("marks date as active for schedule date sub-step", () => {
    const steps = buildWizardSteps("schedule", "date");
    expect(steps.find((s) => s.id === "date")?.state).toBe("active");
    expect(steps.find((s) => s.id === "date")?.ariaCurrent).toBe("step");
  });

  it("marks review as active before otp verification", () => {
    const steps = buildWizardSteps("review", "time");
    expect(steps.find((s) => s.id === "time")?.state).toBe("done");
    expect(steps.find((s) => s.id === "review")?.state).toBe("active");
    expect(steps.find((s) => s.id === "verify")?.state).toBe("pending");
  });

  it("marks completed steps as done", () => {
    const steps = buildWizardSteps("otp", "time");
    expect(steps.find((s) => s.id === "details")?.state).toBe("done");
    expect(steps.find((s) => s.id === "time")?.state).toBe("done");
    expect(steps.find((s) => s.id === "review")?.state).toBe("done");
    expect(steps.find((s) => s.id === "verify")?.state).toBe("active");
  });
});
