import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InboundSmsController } from "./inbound-sms.controller";

const selectMock = vi.fn();
const fromMock = vi.fn();
const innerJoinMock = vi.fn();
const whereMock = vi.fn();
const updateMock = vi.fn();
const setMock = vi.fn();
const updateWhereMock = vi.fn();
const insertMock = vi.fn();
const valuesMock = vi.fn();

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: selectMock,
    update: updateMock,
    insert: insertMock,
  }),
  customers: {
    id: "customerId",
    businessId: "businessId",
    mobile: "mobile",
    smsOptedOutAt: "smsOptedOutAt",
    updatedAt: "updatedAt",
  },
  businesses: {
    id: "businessId",
    organizationId: "organizationId",
  },
  consentAuditLogs: {
    customerId: "customerId",
  },
}));

function makeResponse() {
  return {
    type: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
}

function makeController(validate = vi.fn()) {
  const auditLog = { log: vi.fn() };
  const validator = { validate };
  return {
    controller: new InboundSmsController(auditLog as never, validator as never),
    auditLog,
    validator,
  };
}

describe("InboundSmsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ innerJoin: innerJoinMock });
    innerJoinMock.mockReturnValue({ where: whereMock });
    whereMock.mockResolvedValue([
      { id: "cust-1", organizationId: "org-1", smsOptedOutAt: null },
    ]);
    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: updateWhereMock });
    updateWhereMock.mockResolvedValue(undefined);
    insertMock.mockReturnValue({ values: valuesMock });
    valuesMock.mockResolvedValue(undefined);
  });

  it("rejects missing or invalid signatures before processing STOP", async () => {
    const validate = vi.fn(() => {
      throw new UnauthorizedException("Invalid signature");
    });
    const { controller } = makeController(validate);
    const res = makeResponse();

    await expect(
      controller.handleInboundSms(
        { From: "+639171234567", Body: "STOP" },
        { originalUrl: "/messaging/inbound/sms" } as never,
        undefined,
        res as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(selectMock).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it("accepts a valid signed STOP request, opts out the matching customer, and returns empty TwiML", async () => {
    const validate = vi.fn();
    const { controller, auditLog } = makeController(validate);
    const res = makeResponse();

    await controller.handleInboundSms(
      { From: "+63 917 123 4567", Body: "STOP" },
      { originalUrl: "/messaging/inbound/sms" } as never,
      "valid-signature",
      res as never,
    );

    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { From: "+63 917 123 4567", Body: "STOP" },
        signature: "valid-signature",
        configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
      }),
    );
    expect(updateMock).toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cust-1",
        source: "inbound_stop_webhook",
      }),
    );
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        action: "consent_change",
      }),
    );
    expect(res.type).toHaveBeenCalledWith("text/xml");
    expect(res.send).toHaveBeenCalledWith(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
  });

  it("accepts a valid signed non-STOP request without modifying consent", async () => {
    const { controller } = makeController(vi.fn());
    const res = makeResponse();

    await controller.handleInboundSms(
      { From: "+639171234567", Body: "Hello" },
      { originalUrl: "/messaging/inbound/sms" } as never,
      "valid-signature",
      res as never,
    );

    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
    expect(res.type).toHaveBeenCalledWith("text/xml");
    expect(res.send).toHaveBeenCalledWith(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
  });

  it("still validates the signature before rejecting malformed bodies", async () => {
    const validate = vi.fn();
    const { controller } = makeController(validate);
    const res = makeResponse();

    await expect(
      controller.handleInboundSms(
        { Body: "STOP" },
        { originalUrl: "/messaging/inbound/sms" } as never,
        "valid-signature",
        res as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(validate).toHaveBeenCalled();
  });
});
