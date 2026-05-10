import { describe, it, expect, vi } from "vitest";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  it("forwards sign-in start to service", async () => {
    const service = {
      startOtp: vi.fn(async () => ({ ok: true })),
    } as any;
    const controller = new AuthController(service);

    const result = await controller.signInStart({ email: "x@test.com" });

    expect(service.startOtp).toHaveBeenCalledWith("x@test.com", "sign_in");
    expect(result).toEqual({ ok: true });
  });
});
