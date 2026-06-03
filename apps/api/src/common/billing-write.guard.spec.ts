import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { BillingWriteGuard } from "./billing-write.guard";

describe("BillingWriteGuard", () => {
  it("blocks writes when the org is read-only", async () => {
    const guard = new BillingWriteGuard({
      isReadOnly: vi.fn().mockResolvedValue(true),
    } as never);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          tenant: {
            organizationId: "org-1",
          },
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows writes when the org is writable", async () => {
    const guard = new BillingWriteGuard({
      isReadOnly: vi.fn().mockResolvedValue(false),
    } as never);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          tenant: {
            organizationId: "org-1",
          },
        }),
      }),
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });
});
