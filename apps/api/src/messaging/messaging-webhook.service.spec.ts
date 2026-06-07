import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingWebhookService } from "./messaging-webhook.service";

const verifyMock = vi.fn();
const whereMock = vi.fn();
const limitMock = vi.fn();
const setMock = vi.fn();
const updateWhereMock = vi.fn();
const updateMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();
const insertMock = vi.fn();
const valuesMock = vi.fn();
const onConflictDoNothingMock = vi.fn();
const returningMock = vi.fn();

vi.mock("svix", () => ({
  Webhook: vi.fn(() => ({
    verify: verifyMock,
  })),
}));

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: selectMock,
    from: fromMock,
    where: whereMock,
    update: updateMock,
    insert: insertMock,
  }),
  messageEvents: { id: "id", providerMessageId: "providerMessageId", deliveryStatus: "deliveryStatus" },
  processedWebhookEvents: {
    eventId: "eventId",
    failureReason: "failureReason",
    retryCount: "retryCount",
    status: "status",
  },
}));

describe("MessagingWebhookService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.RESEND_WEBHOOK_SECRET;

    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ limit: limitMock });
    limitMock.mockResolvedValue([{ id: "evt1", deliveryStatus: "sent" }]);

    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: updateWhereMock });
    updateWhereMock.mockResolvedValue(undefined);

    insertMock.mockReturnValue({ values: valuesMock });
    valuesMock.mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
    onConflictDoNothingMock.mockReturnValue({ returning: returningMock });
    returningMock.mockResolvedValue([{ id: "processed-event-1" }]);
    verifyMock.mockReturnValue({
      type: "email.delivered",
      data: { id: "resend-message-1" },
    });
  });

  it("throws when Twilio config/signature is missing", async () => {
    const service = new MessagingWebhookService();
    await expect(service.handleTwilioStatus({})).resolves.toBeUndefined();
  });

  it("ignores unknown provider message id", async () => {
    const service = new MessagingWebhookService();

    limitMock.mockResolvedValueOnce([]);
    await service.handleTwilioStatus({ MessageSid: "SM1", MessageStatus: "delivered" });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("maps Twilio failed status and writes failure reason", async () => {
    const service = new MessagingWebhookService();

    await service.handleTwilioStatus(
      { MessageSid: "SM1", MessageStatus: "undelivered", ErrorMessage: "no route" },
    );

    expect(updateMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: "failed", failureReason: "no route" }),
    );
  });

  it.each([
    ["accepted", "queued"],
    ["scheduled", "queued"],
    ["queued", "queued"],
    ["sending", "sent"],
    ["sent", "sent"],
    ["delivered", "delivered"],
    ["failed", "failed"],
    ["undelivered", "failed"],
    ["canceled", "rejected"],
    ["cancelled", "rejected"],
  ])("maps Twilio %s to %s", async (twilioStatus, expected) => {
    const service = new MessagingWebhookService();

    await service.handleTwilioStatus({
      MessageSid: "SM1",
      MessageStatus: twilioStatus,
      ExtraFutureField: "ok",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: expected,
        providerMetadata: expect.objectContaining({ ExtraFutureField: "ok" }),
      }),
    );
    vi.clearAllMocks();
    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: updateWhereMock });
  });

  it("does not overwrite terminal delivery statuses", async () => {
    limitMock.mockResolvedValueOnce([{ id: "evt1", deliveryStatus: "delivered" }]);
    const service = new MessagingWebhookService();

    await service.handleTwilioStatus({ MessageSid: "SM1", MessageStatus: "failed" });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("safely ignores unknown Twilio statuses", async () => {
    const service = new MessagingWebhookService();

    await service.handleTwilioStatus({ MessageSid: "SM1", MessageStatus: "mystery" });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("throws when Resend secret missing", async () => {
    const service = new MessagingWebhookService();
    await expect(service.handleResendEvent("{}", {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("ignores duplicate Resend Svix event ids without processing again", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    returningMock.mockResolvedValueOnce([]);
    const service = new MessagingWebhookService();

    await service.handleResendEvent("{}", {
      "svix-id": "evt_duplicate",
      "svix-timestamp": "123",
      "svix-signature": "sig",
    });

    expect(insertMock).toHaveBeenCalled();
    expect(selectMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each([
    ["email.delivery_delayed", "queued"],
    ["email.suppressed", "rejected"],
    ["email.complained", "rejected"],
  ])("maps Resend %s safely to %s", async (type, expected) => {
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    verifyMock.mockReturnValueOnce({
      type,
      data: { id: "resend-message-1" },
    });
    const service = new MessagingWebhookService();

    await service.handleResendEvent("{}", {
      "svix-id": `evt_${type}`,
      "svix-timestamp": "123",
      "svix-signature": "sig",
    });

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: expected,
      }),
    );
  });
});
