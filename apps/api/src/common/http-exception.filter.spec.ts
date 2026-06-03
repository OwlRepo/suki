import { describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  it("passes custom code fields through to the HTTP response body", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status,
        }),
        getRequest: () => ({
          method: "POST",
          url: "/billing/checkout",
        }),
      }),
    } as never;

    new HttpExceptionFilter().catch(
      new ServiceUnavailableException({
        code: "BILLING_DISABLED",
        message: "Self-serve billing is disabled.",
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "BILLING_DISABLED",
        message: ["Self-serve billing is disabled."],
        error: "ServiceUnavailableException",
      }),
    );
  });
});
