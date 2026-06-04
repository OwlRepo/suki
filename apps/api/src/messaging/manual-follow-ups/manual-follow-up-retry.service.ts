import { BadRequestException, Injectable } from "@nestjs/common";
import { MessageDispatchService } from "../message-dispatch.service";
import { ManualFollowUpService } from "./manual-follow-up.service";

@Injectable()
export class ManualFollowUpRetryService {
  constructor(
    private readonly manualFollowUps: ManualFollowUpService,
    private readonly dispatch: MessageDispatchService,
  ) {}

  async retryAutomaticSms(input: {
    organizationId: string;
    userId: string;
    taskId: string;
  }) {
    const task = await this.manualFollowUps.getOpenTask(
      input.organizationId,
      input.taskId,
    );

    if (task.failureReason === "provider_outcome_unknown") {
      throw new BadRequestException(
        "Delivery could not be confirmed. Check with the customer before sending again.",
      );
    }

    const result = await this.dispatch.dispatch({
      organizationId: task.organizationId,
      businessId: task.businessId,
      customerId: task.customerId,
      actorUserId: input.userId,
      appointmentId: task.appointmentId ?? undefined,
      automationKey: task.automationKey,
      purpose: task.purpose,
      channel: "sms",
      rawMessage: task.manualRetryRawMessage,
    });

    if (result.status !== "sent" || !result.messageEventId) {
      throw new BadRequestException(result.reason ?? "automatic_sms_retry_failed");
    }

    await this.manualFollowUps.attachRetryMessageEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      taskId: task.id,
      retryMessageEventId: result.messageEventId,
    });

    return { status: "sent" };
  }
}
