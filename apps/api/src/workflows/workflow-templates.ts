/**
 * Capability templates for workflow profiles.
 * Maps workflowProfile to stage labels, reminders, and required fields.
 */
export type WorkflowProfile = "general" | "service_scheduling" | "project_lifecycle" | "compliance_heavy";

export interface WorkflowTemplate {
  profile: WorkflowProfile;
  stageLabels: string[];
  defaultReminderDays: number[];
  requiredFields: string[];
}

export const WORKFLOW_TEMPLATES: Record<WorkflowProfile, WorkflowTemplate> = {
  general: {
    profile: "general",
    stageLabels: ["Lead", "Contacted", "Qualified", "Customer"],
    defaultReminderDays: [3, 7, 14],
    requiredFields: ["name", "mobile"],
  },
  service_scheduling: {
    profile: "service_scheduling",
    stageLabels: ["Inquiry", "Booked", "Completed", "Follow-up"],
    defaultReminderDays: [1, 7, 30],
    requiredFields: ["name", "mobile"],
  },
  project_lifecycle: {
    profile: "project_lifecycle",
    stageLabels: ["Proposal", "In Progress", "Review", "Closed"],
    defaultReminderDays: [3, 7, 14],
    requiredFields: ["name", "mobile"],
  },
  compliance_heavy: {
    profile: "compliance_heavy",
    stageLabels: ["Intake", "Verified", "Active", "Archived"],
    defaultReminderDays: [7, 30],
    requiredFields: ["name", "mobile"],
  },
};
