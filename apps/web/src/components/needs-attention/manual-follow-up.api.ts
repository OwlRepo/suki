import { apiRequest } from "@/lib/api";
import type { ManualFollowUpTask } from "./manual-follow-up.types";

export function listOpenManualFollowUps() {
  return apiRequest<ManualFollowUpTask[]>(
    "/messaging/manual-follow-ups?status=open",
  );
}

export function getOpenManualFollowUpCount() {
  return apiRequest<{ count: number }>(
    "/messaging/manual-follow-ups/open-count",
  );
}

export function markManualFollowUpContacted(taskId: string) {
  return apiRequest(`/messaging/manual-follow-ups/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "contacted" }),
  });
}

export function dismissManualFollowUp(taskId: string) {
  return apiRequest(`/messaging/manual-follow-ups/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "dismissed" }),
  });
}

export function retryManualFollowUpSms(taskId: string) {
  return apiRequest(`/messaging/manual-follow-ups/${taskId}/retry-sms`, {
    method: "POST",
  });
}
