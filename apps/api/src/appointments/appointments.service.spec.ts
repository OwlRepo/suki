import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashOtpSkipPin,
  isBookingSecurityCompatibilityError,
  isValidOtpSkipPin,
} from "./appointments.service";
import { AppointmentsService } from "./appointments.service";

const dbMock = {
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
};
const txMock = {
  select: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(),
};
const fromMock = vi.fn();
const whereMock = vi.fn();
const limitMock = vi.fn();
const orderByMock = vi.fn();
const setMock = vi.fn();
const updateWhereMock = vi.fn();
const returningMock = vi.fn();
const insertValuesMock = vi.fn();

vi.mock("@tyvera/database", () => ({
  getDb: () => dbMock,
  appointments: {
    id: "appointments.id",
    customerId: "appointments.customer_id",
    businessId: "appointments.business_id",
    scheduledAt: "appointments.scheduled_at",
    durationMinutes: "appointments.duration_minutes",
    status: "appointments.status",
    checkedInAt: "appointments.checked_in_at",
    needsReviewAt: "appointments.needs_review_at",
    completedAt: "appointments.completed_at",
    visitRecordedAt: "appointments.visit_recorded_at",
    notes: "appointments.notes",
    updatedAt: "appointments.updated_at",
  },
  businesses: {
    id: "businesses.id",
    organizationId: "businesses.organization_id",
    businessType: "businesses.business_type",
  },
  customers: {
    id: "customers.id",
    visitCount: "customers.visit_count",
    lastVisitAt: "customers.last_visit_at",
    updatedAt: "customers.updated_at",
  },
  appointmentShareTemplates: {},
  bookingHolds: {},
  bookingSecuritySettings: {},
  bookingPinAttemptLogs: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  lte: (a: unknown, b: unknown) => ({ type: "lte", a, b }),
  desc: (a: unknown) => ({ type: "desc", a }),
  inArray: (a: unknown, b: unknown) => ({ type: "inArray", a, b }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  }),
}));

function makeService() {
  const automationSend = {
    sendPostVisitFollowup: vi.fn().mockResolvedValue(undefined),
    sendLoyaltyUnlock: vi.fn().mockResolvedValue(undefined),
    sendMissedRecovery: vi.fn().mockResolvedValue(undefined),
  };
  const service = new AppointmentsService(automationSend as never, {} as never);

  return { service, automationSend };
}

function wireSelectQueue(rowsQueue: unknown[][]) {
  const buildChain = () => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rowsQueue.shift() ?? []),
      })),
      orderBy: vi.fn(() => ({
        limit: vi.fn(async () => rowsQueue.shift() ?? []),
      })),
    })),
  });

  dbMock.select.mockImplementation(buildChain);
  txMock.select.mockImplementation(buildChain);
}

function wireUpdate(returningRows: unknown[] = []) {
  const updateChain = {
    set: setMock.mockReturnValue({
      where: updateWhereMock.mockReturnValue({
        returning: returningMock.mockResolvedValue(returningRows),
      }),
    }),
  };
  dbMock.update.mockReturnValue(updateChain);
  txMock.update.mockReturnValue(updateChain);
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) =>
    callback(txMock),
  );
  dbMock.execute.mockResolvedValue(undefined);
  txMock.execute.mockResolvedValue(undefined);
  dbMock.insert.mockReturnValue({ values: insertValuesMock });
  insertValuesMock.mockReturnValue({ returning: returningMock });
  fromMock.mockReset();
  whereMock.mockReset();
  limitMock.mockReset();
  orderByMock.mockReset();
  setMock.mockReset();
  updateWhereMock.mockReset();
  returningMock.mockReset();
  wireSelectQueue([]);
  wireUpdate([]);
});

describe("appointments security helpers", () => {
  it("validates 4-8 digit PIN", () => {
    expect(isValidOtpSkipPin("1234")).toBe(true);
    expect(isValidOtpSkipPin("12345678")).toBe(true);
    expect(isValidOtpSkipPin("123")).toBe(false);
    expect(isValidOtpSkipPin("123456789")).toBe(false);
    expect(isValidOtpSkipPin("12ab")).toBe(false);
  });

  it("hashes deterministically", () => {
    expect(hashOtpSkipPin("1234")).toBe(hashOtpSkipPin("1234"));
    expect(hashOtpSkipPin("1234")).not.toBe(hashOtpSkipPin("5678"));
  });

  it("detects booking security compatibility errors", () => {
    expect(isBookingSecurityCompatibilityError({ code: "42P01" })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ message: 'relation "booking_security_settings" does not exist' })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});

describe("AppointmentsService lifecycle", () => {
  it("markArrived('scheduled') sets status=checked_in and checkedInAt", async () => {
    const { service } = makeService();
    vi.spyOn(service, "findById").mockResolvedValue({
      id: "a1",
      businessId: "biz1",
      status: "scheduled",
    } as never);
    wireUpdate([{ id: "a1", status: "checked_in", checkedInAt: new Date() }]);

    await expect(service.markArrived("a1", "org1")).resolves.toEqual(
      expect.objectContaining({ status: "checked_in" }),
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "checked_in",
        checkedInAt: expect.any(Date),
      }),
    );
  });

  it("markArrived('needs_review') sets checked_in and clears needsReviewAt", async () => {
    const { service } = makeService();
    vi.spyOn(service, "findById").mockResolvedValue({
      id: "a1",
      businessId: "biz1",
      status: "needs_review",
    } as never);
    wireUpdate([{ id: "a1", status: "checked_in", needsReviewAt: null }]);

    await service.markArrived("a1", "org1");

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "checked_in", needsReviewAt: null }),
    );
  });

  it("markArrived('completed') rejects", async () => {
    const { service } = makeService();
    vi.spyOn(service, "findById").mockResolvedValue({
      id: "a1",
      businessId: "biz1",
      status: "completed",
    } as never);

    await expect(service.markArrived("a1", "org1")).rejects.toThrow(
      /scheduled or needs-review/i,
    );
  });

  it("manual completed status increments customers.visitCount once", async () => {
    const { service } = makeService();
    const appointment = {
      id: "a1",
      businessId: "biz1",
      customerId: "c1",
      status: "checked_in",
      completedAt: null,
      visitRecordedAt: null,
    };
    wireSelectQueue([
      [appointment],
      [{ organizationId: "org1" }],
    ]);
    wireUpdate([{ visitCount: 1 }, { ...appointment, status: "completed" }]);

    await service.updateStatus("a1", "org1", "completed");

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ visitCount: expect.anything() }),
    );
  });

  it("manual completed status sets customer lastVisitAt and appointment completion stamps", async () => {
    const { service } = makeService();
    const appointment = {
      id: "a1",
      businessId: "biz1",
      customerId: "c1",
      status: "scheduled",
      completedAt: null,
      visitRecordedAt: null,
    };
    wireSelectQueue([
      [appointment],
      [{ organizationId: "org1" }],
    ]);
    wireUpdate([{ visitCount: 1 }, { ...appointment, status: "completed" }]);

    await service.updateStatus("a1", "org1", "completed");

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ lastVisitAt: expect.any(Date) }),
    );
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        completedAt: expect.any(Date),
        visitRecordedAt: expect.any(Date),
      }),
    );
  });

  it("repeating completed status does not increment twice", async () => {
    const { service } = makeService();
    const appointment = {
      id: "a1",
      businessId: "biz1",
      customerId: "c1",
      status: "completed",
      completedAt: new Date(),
      visitRecordedAt: null,
    };
    wireSelectQueue([
      [appointment],
      [{ organizationId: "org1" }],
    ]);

    await service.updateStatus("a1", "org1", "completed");

    expect(txMock.update).not.toHaveBeenCalled();
  });

  it("repeating completed status does not resend post-visit or loyalty automation", async () => {
    const { service, automationSend } = makeService();
    const appointment = {
      id: "a1",
      businessId: "biz1",
      customerId: "c1",
      status: "completed",
      completedAt: new Date(),
      visitRecordedAt: null,
    };
    wireSelectQueue([
      [appointment],
      [{ organizationId: "org1" }],
    ]);

    await service.updateStatus("a1", "org1", "completed");

    expect(automationSend.sendPostVisitFollowup).not.toHaveBeenCalled();
    expect(automationSend.sendLoyaltyUnlock).not.toHaveBeenCalled();
  });

  it("missed status keeps missed-recovery automation", async () => {
    const { service, automationSend } = makeService();
    wireSelectQueue([
      [{ id: "a1", businessId: "biz1", status: "scheduled" }],
      [{ id: "biz1", organizationId: "org1" }],
    ]);
    wireUpdate([{ id: "a1", status: "missed" }]);

    await service.updateStatus("a1", "org1", "missed");

    expect(automationSend.sendMissedRecovery).toHaveBeenCalledWith(
      "org1",
      "biz1",
      "a1",
    );
  });

  it("reconcileVisitLifecycle completes due checked_in rows", async () => {
    const { service } = makeService();
    const now = new Date("2026-06-05T03:00:00.000Z");
    wireSelectQueue([
      [
        {
          id: "a1",
          status: "checked_in",
          scheduledAt: new Date("2026-06-05T02:00:00.000Z"),
          durationMinutes: 30,
        },
      ],
    ]);
    vi.spyOn(service as never, "completeAppointmentAndRecordVisit").mockResolvedValue({
      id: "a1",
    } as never);

    await expect(service.reconcileVisitLifecycle(now)).resolves.toEqual({
      completed: 1,
      needsReview: 0,
    });
  });

  it("reconcileVisitLifecycle moves due scheduled rows to needs_review", async () => {
    const { service } = makeService();
    const now = new Date("2026-06-05T03:00:00.000Z");
    wireSelectQueue([
      [
        {
          id: "a1",
          status: "scheduled",
          scheduledAt: new Date("2026-06-05T02:00:00.000Z"),
          durationMinutes: 30,
        },
      ],
    ]);
    wireUpdate([{ id: "a1" }]);

    await expect(service.reconcileVisitLifecycle(now)).resolves.toEqual({
      completed: 0,
      needsReview: 1,
    });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "needs_review", needsReviewAt: now }),
    );
  });

  it("reconcileVisitLifecycle ignores rows whose deadline has not passed", async () => {
    const { service } = makeService();
    const now = new Date("2026-06-05T02:40:00.000Z");
    wireSelectQueue([
      [
        {
          id: "a1",
          status: "scheduled",
          scheduledAt: new Date("2026-06-05T02:00:00.000Z"),
          durationMinutes: 30,
        },
      ],
    ]);

    await expect(service.reconcileVisitLifecycle(now)).resolves.toEqual({
      completed: 0,
      needsReview: 0,
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("completed visits cannot be rescheduled through the normal update endpoint", async () => {
    const { service } = makeService();
    vi.spyOn(service, "findById").mockResolvedValue({
      id: "a1",
      businessId: "biz1",
      status: "completed",
      visitRecordedAt: new Date(),
    } as never);

    await expect(
      service.update("a1", "org1", { scheduledAt: new Date() }),
    ).rejects.toThrow(/completed visits/i);
  });

  it("reconcileVisitLifecycle continues processing later rows when one appointment fails", async () => {
    const { service } = makeService();
    const now = new Date("2026-06-05T03:00:00.000Z");
    wireSelectQueue([
      [
        {
          id: "a1",
          status: "checked_in",
          scheduledAt: new Date("2026-06-05T02:00:00.000Z"),
          durationMinutes: 30,
        },
        {
          id: "a2",
          status: "scheduled",
          scheduledAt: new Date("2026-06-05T02:00:00.000Z"),
          durationMinutes: 30,
        },
      ],
    ]);
    vi.spyOn(service as never, "completeAppointmentAndRecordVisit").mockRejectedValue(
      new Error("boom") as never,
    );
    wireUpdate([{ id: "a2" }]);

    await expect(service.reconcileVisitLifecycle(now)).resolves.toEqual({
      completed: 0,
      needsReview: 1,
    });
  });
});
