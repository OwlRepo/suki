export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;
export const CLINIC_APPOINTMENT_DURATION_MINUTES = 60;
export const APPOINTMENT_AUTO_COMPLETE_GRACE_MINUTES = 15;

export function appointmentDurationMinutesForBusinessType(
  businessType?: string | null,
): number {
  return businessType === "clinic"
    ? CLINIC_APPOINTMENT_DURATION_MINUTES
    : DEFAULT_APPOINTMENT_DURATION_MINUTES;
}

export function appointmentLifecycleDueAt(
  scheduledAt: Date,
  durationMinutes = DEFAULT_APPOINTMENT_DURATION_MINUTES,
): Date {
  return new Date(
    scheduledAt.getTime() +
      (durationMinutes + APPOINTMENT_AUTO_COMPLETE_GRACE_MINUTES) * 60_000,
  );
}
