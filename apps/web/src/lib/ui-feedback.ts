export type FeedbackType = "success" | "error";

export interface UiFeedback {
  type: FeedbackType;
  message: string;
}

export function successFeedback(actionLabel: string): UiFeedback {
  return { type: "success", message: `${actionLabel} saved successfully.` };
}

export function errorFeedback(actionLabel: string, fallback = "Please try again."): UiFeedback {
  return { type: "error", message: `${actionLabel} failed. ${fallback}` };
}

export function fromError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
