export type BookingStep = "customer" | "date" | "time" | "review" | "verify" | "done";

export type WizardState = "done" | "active" | "pending";

const order: BookingStep[] = ["customer", "date", "time", "review", "verify", "done"];

export function buildAppointmentWizardSteps(current: BookingStep) {
  const currentIdx = order.indexOf(current);
  return order.slice(0, -1).map((id, idx) => ({
    id,
    label: id,
    state: idx < currentIdx ? ("done" as WizardState) : idx === currentIdx ? ("active" as WizardState) : ("pending" as WizardState),
  }));
}
