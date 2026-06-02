import { scryptSync } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

const dbMock = vi.hoisted(() => ({
  tables: {
    authIdentities: { email: "authIdentities.email", userId: "authIdentities.userId" },
    authOtpChallenges: {
      id: "authOtpChallenges.id",
      email: "authOtpChallenges.email",
      purpose: "authOtpChallenges.purpose",
      createdAt: "authOtpChallenges.createdAt",
      consumedAt: "authOtpChallenges.consumedAt",
    },
    authSessions: { tokenHash: "authSessions.tokenHash", expiresAt: "authSessions.expiresAt", revokedAt: "authSessions.revokedAt" },
    organizations: { id: "organizations.id", name: "organizations.name" },
    subscriptions: { organizationId: "subscriptions.organizationId" },
    users: {
      id: "users.id",
      organizationId: "users.organizationId",
      role: "users.role",
      email: "users.email",
    },
    onboardingProgress: {
      organizationId: "onboardingProgress.organizationId",
      userId: "onboardingProgress.userId",
    },
  },
  insertValuesMock: vi.fn(),
  insertMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateMock: vi.fn(),
  selectMock: vi.fn(),
  transactionMock: vi.fn(),
  txInsertMock: vi.fn(),
  txInsertValuesMock: vi.fn(),
  txReturningMock: vi.fn(),
}));

const {
  insertValuesMock,
  insertMock,
  updateSetMock,
  updateMock,
  selectMock,
  transactionMock,
  txInsertMock,
  txInsertValuesMock,
  txReturningMock,
} = dbMock;

let selectQueue: unknown[][] = [];
let txReturningQueue: unknown[][] = [];

function selectBuilder(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(async () => rows),
  };
  return builder;
}

function updateBuilder() {
  const builder = {
    set: updateSetMock,
    where: vi.fn(async () => undefined),
  };
  updateSetMock.mockReturnValue(builder);
  return builder;
}

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ["and", args]),
  desc: vi.fn((arg: unknown) => ["desc", arg]),
  eq: vi.fn((left: unknown, right: unknown) => ["eq", left, right]),
  gt: vi.fn((left: unknown, right: unknown) => ["gt", left, right]),
  isNull: vi.fn((arg: unknown) => ["isNull", arg]),
}));

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    insert: dbMock.insertMock,
    update: dbMock.updateMock,
    select: dbMock.selectMock,
    transaction: dbMock.transactionMock,
  }),
  ...dbMock.tables,
}));

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue = [];
    txReturningQueue = [];

    insertMock.mockReturnValue({ values: insertValuesMock });
    insertValuesMock.mockResolvedValue(undefined);
    updateMock.mockReturnValue(updateBuilder());
    selectMock.mockImplementation(() => selectBuilder(selectQueue.shift() ?? []));
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        insert: txInsertMock,
      }),
    );
    txInsertMock.mockReturnValue({ values: txInsertValuesMock });
    txInsertValuesMock.mockReturnValue({ returning: txReturningMock });
    txReturningMock.mockImplementation(async () => txReturningQueue.shift() ?? []);

    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("normalizes email and creates sign-up OTP challenge", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never);
    await expect(service.startOtp("  USER@TEST.COM ", "sign_up")).resolves.toEqual({ ok: true });

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@test.com",
        purpose: "sign_up",
        attempts: 0,
      }),
    );
  });

  it("does not throw when resend is not configured", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never);
    await expect(service.startOtp("user@test.com", "sign_up")).resolves.toEqual({ ok: true });
  });

  it("creates a public account with password hash after valid sign-up OTP", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => true, publicSignupEnabled: () => false } as never);
    selectQueue = [
      [{ id: "challenge-1", codeHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", expiresAt: new Date(Date.now() + 60_000) }],
      [],
    ];
    txReturningQueue = [[{ id: "org-1" }], [{ id: "user-1" }]];

    await expect(service.verifyOtpAndSignUp("  New@TEST.com ", "123456", "secret123")).resolves.toMatchObject({
      ok: true,
      session: expect.objectContaining({ token: expect.any(String), expiresAt: expect.any(Date) }),
    });

    expect(transactionMock).toHaveBeenCalled();
    expect(txInsertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        email: "new@test.com",
        emailVerifiedAt: expect.any(Date),
        passwordHash: expect.stringMatching(/^[a-f0-9]{32}:[a-f0-9]{128}$/),
      }),
    );
    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({ consumedAt: expect.any(Date) }));
    expect(insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", tokenHash: expect.any(String) }));
  });

  it("rejects existing-account sign-up without creating a duplicate account", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never);
    selectQueue = [
      [{ id: "challenge-1", codeHash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", expiresAt: new Date(Date.now() + 60_000) }],
      [{ userId: "existing-user", email: "existing@test.com" }],
      [{ id: "existing-user", organizationId: "org-1", role: "owner", email: "existing@test.com" }],
    ];

    await expect(service.verifyOtpAndSignUp("existing@test.com", "123456", "secret123")).resolves.toEqual({
      ok: false,
      message: "Account already exists",
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("does not expose OTP sign-in verify path", () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never) as unknown as Record<string, unknown>;
    expect(service.verifyOtpAndSignIn).toBeUndefined();
  });

  it("redirects password login to onboarding when progress is missing", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never);
    const salt = "0123456789abcdef0123456789abcdef";
    const passwordHash = `${salt}:${scryptSync("secret123", salt, 64).toString("hex")}`;
    selectQueue = [
      [{ userId: "user-1", email: "user@test.com", passwordHash }],
      [{ id: "user-1", organizationId: "org-1", role: "owner", email: "user@test.com" }],
      [],
    ];

    await expect(service.signInWithPassword("user@test.com", "secret123")).resolves.toMatchObject({
      ok: true,
      redirectTo: "/onboarding",
      session: expect.objectContaining({ token: expect.any(String), expiresAt: expect.any(Date) }),
    });
  });

  it("redirects password login to dashboard when onboarding is complete", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never);
    const salt = "0123456789abcdef0123456789abcdef";
    const passwordHash = `${salt}:${scryptSync("secret123", salt, 64).toString("hex")}`;
    selectQueue = [
      [{ userId: "user-1", email: "user@test.com", passwordHash }],
      [{ id: "user-1", organizationId: "org-1", role: "owner", email: "user@test.com" }],
      [{ currentStep: 7 }],
    ];

    await expect(service.signInWithPassword("user@test.com", "secret123")).resolves.toMatchObject({
      ok: true,
      redirectTo: "/dashboard",
      session: expect.objectContaining({ token: expect.any(String), expiresAt: expect.any(Date) }),
    });
  });
});
