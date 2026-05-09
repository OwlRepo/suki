export type IntakeStep = "form" | "schedule" | "review" | "otp" | "done";
export type ScheduleSubStep = "date" | "time";

type StepId = "details" | "date" | "time" | "review" | "verify";
export type WizardStepState = "active" | "done" | "pending";

export interface WizardStep {
  id: StepId;
  label: string;
  state: WizardStepState;
  ariaCurrent?: "step";
}

const STEP_META: Array<{ id: StepId; label: string }> = [
  { id: "details", label: "1 Details" },
  { id: "date", label: "2 Date" },
  { id: "time", label: "3 Time" },
  { id: "review", label: "4 Review" },
  { id: "verify", label: "5 Verify" },
];

function getActiveStep(step: IntakeStep, scheduleSubStep: ScheduleSubStep): StepId {
  if (step === "form") return "details";
  if (step === "schedule") return scheduleSubStep;
  if (step === "review") return "review";
  if (step === "otp") return "verify";
  return "verify";
}

function isDone(stepId: StepId, step: IntakeStep, scheduleSubStep: ScheduleSubStep): boolean {
  if (stepId === "details") return step !== "form";
  if (stepId === "date") return step === "review" || step === "otp" || step === "done" || (step === "schedule" && scheduleSubStep === "time");
  if (stepId === "time") return step === "review" || step === "otp" || step === "done";
  if (stepId === "review") return step === "otp" || step === "done";
  return step === "done";
}

export function buildWizardSteps(step: IntakeStep, scheduleSubStep: ScheduleSubStep): WizardStep[] {
  const activeStep = getActiveStep(step, scheduleSubStep);

  return STEP_META.map((meta) => {
    const state: WizardStepState = meta.id === activeStep ? "active" : isDone(meta.id, step, scheduleSubStep) ? "done" : "pending";
    return {
      id: meta.id,
      label: meta.label,
      state,
      ariaCurrent: state === "active" ? "step" : undefined,
    };
  });
}
