import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingWebhookService } from "./messaging-webhook.service";

const whereMock = vi.fn();
const limitMock = vi.fn();
const setMock = vi.fn();
const updateWhereMock = vi.fn();
const updateMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: selectMock,
    from: fromMock,
    where: whereMock,
    update: updateMock,
  }),
  messageEvents: { id: "id", providerMessageId: "providerMessageId", deliveryStatus: "deliveryStatus" },
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
});
