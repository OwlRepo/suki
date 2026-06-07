import { describe, expect, it, vi } from "vitest";
import { Logger, ServiceUnavailableException } from "@nestjs/common";
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

  it("logs safe nested causes for server errors without changing the HTTP response body", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status,
        }),
        getRequest: () => ({
          method: "GET",
          url: "/platform-admin/communications",
        }),
      }),
    } as never;
    const loggerError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const driverCause = {
      name: "PostgresError",
      message: 'column "delivery_status" does not exist',
      code: "42703",
      detail: "Column is missing.",
      hint: "Check the selected database.",
      where: "SQL statement",
      query: "select * from message_events",
      password: "do-not-log",
      cause: {
        name: "NestedDriverError",
        message: "nested driver failure",
        apiKey: "secret-key",
      },
    };
    const exception = Object.assign(new Error("Drizzle query failed"), {
      cause: driverCause,
      mobile: "+639171234567",
    });

    new HttpExceptionFilter().catch(exception, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: ["Internal server error"],
        error: "Error",
        path: "/platform-admin/communications",
      }),
    );
    expect(json).not.toHaveBeenCalledWith(expect.objectContaining({ cause: expect.anything() }));
    expect(loggerError).toHaveBeenCalledWith(
      "GET /platform-admin/communications 500",
      expect.objectContaining({
        name: "Error",
        message: "Drizzle query failed",
        cause: expect.objectContaining({
          name: "PostgresError",
          message: 'column "delivery_status" does not exist',
          code: "42703",
          detail: "Column is missing.",
          hint: "Check the selected database.",
          where: "SQL statement",
          cause: expect.objectContaining({
            name: "NestedDriverError",
            message: "nested driver failure",
          }),
        }),
      }),
    );
    const loggedPayload = JSON.stringify(loggerError.mock.calls);
    expect(loggedPayload).not.toContain("select * from message_events");
    expect(loggedPayload).not.toContain("do-not-log");
    expect(loggedPayload).not.toContain("secret-key");
    expect(loggedPayload).not.toContain("+639171234567");
    loggerError.mockRestore();
  });
});
