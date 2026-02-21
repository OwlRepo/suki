import { Injectable } from "@nestjs/common";

@Injectable()
export class AutomationMessageComposerService {
  compose(
    automationKey: string,
    context: {
      customerName?: string;
      scheduledAt?: Date;
      staffName?: string;
      rescheduleLink?: string;
      rebookLink?: string;
      businessName?: string;
    },
  ): string {
    const time =
      context.scheduledAt?.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }) ?? "[date/time]";
    const staff = context.staffName ? ` with ${context.staffName}` : "";
    const link = context.rescheduleLink ?? context.rebookLink ?? "[link]";

    switch (automationKey) {
      case "appointment_confirmation":
        return `Hi${context.customerName ? ` ${context.customerName}` : ""}! Your appointment${staff} is confirmed for ${time}.`;
      case "appointment_reminder_24h":
      case "appointment_reminder_72h":
        return `Reminder: Your appointment${staff} is ${automationKey === "appointment_reminder_72h" ? "in 3 days" : "tomorrow"}. Reschedule: ${link}.`;
      case "missed_recovery":
        return `We noticed you missed your appointment. We'd love to see you—rebook here: ${link}.`;
      case "post_visit_followup":
        return `Thank you for visiting! We hope to see you again soon. Book your next visit: ${link}.`;
      case "inactivity_winback":
        return `We miss you! Come back and save on your next visit.`;
      case "loyalty_unlock":
        return `Congratulations! You've unlocked your reward. Claim it on your next visit.`;
      default:
        return `Hi! ${context.businessName ?? "We"} have a message for you.`;
    }
  }
}
