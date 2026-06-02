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
    await expect(service.handleTwilioStatus({}, undefined, "https://x")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    process.env.TWILIO_AUTH_TOKEN = "token";
    await expect(service.handleTwilioStatus({}, undefined, "https://x")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("ignores unknown provider message id", async () => {
    process.env.TWILIO_AUTH_TOKEN = "token";
    const service = new MessagingWebhookService();
    const verifySpy = vi.spyOn(service as unknown as { verifyTwilioSignature: () => boolean }, "verifyTwilioSignature").mockReturnValue(true);

    limitMock.mockResolvedValueOnce([]);
    await service.handleTwilioStatus({ MessageSid: "SM1", MessageStatus: "delivered" }, "sig", "https://x");

    expect(updateMock).not.toHaveBeenCalled();
    expect(verifySpy).toHaveBeenCalled();
  });

  it("maps Twilio failed status and writes failure reason", async () => {
    process.env.TWILIO_AUTH_TOKEN = "token";
    const service = new MessagingWebhookService();
    vi.spyOn(service as unknown as { verifyTwilioSignature: () => boolean }, "verifyTwilioSignature").mockReturnValue(true);

    await service.handleTwilioStatus(
      { MessageSid: "SM1", MessageStatus: "undelivered", ErrorMessage: "no route" },
      "sig",
      "https://x",
    );

    expect(updateMock).toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: "failed", failureReason: "no route" }),
    );
  });

  it("throws when Resend secret missing", async () => {
    const service = new MessagingWebhookService();
    await expect(service.handleResendEvent("{}", {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
