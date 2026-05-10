import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

const insertValuesMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@suki/database", () => ({
  getDb: () => ({
    insert: insertMock,
  }),
  authOtpChallenges: {},
}));

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReturnValue({ values: insertValuesMock });
    insertValuesMock.mockResolvedValue(undefined);
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("normalizes email and creates OTP challenge", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never);
    await expect(service.startOtp("  USER@TEST.COM ", "sign_in")).resolves.toEqual({ ok: true });

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@test.com",
        purpose: "sign_in",
        attempts: 0,
      }),
    );
  });

  it("does not throw when resend is not configured", async () => {
    const service = new AuthService({ founderLedModeEnabled: () => false, publicSignupEnabled: () => true } as never);
    await expect(service.startOtp("user@test.com", "sign_up")).resolves.toEqual({ ok: true });
  });
});
