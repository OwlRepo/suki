// @vitest-environment jsdom
import { Suspense } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IntakePage from "./page";

describe("IntakePage OTP flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    });
  });

  it("shows resend cooldown and hold-expiry countdown after OTP send", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/intake/config")) {
        return new Response(JSON.stringify({ template: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (href.endsWith("/intake")) {
        return new Response(JSON.stringify({ customer: { id: "cust-1" }, success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (href.includes("/intake/availability")) {
        return new Response(
          JSON.stringify({
            month: "2026-06",
            slotDurationMins: 30,
            byDay: {
              "2026-06-10": ["2026-06-10T09:00:00.000Z"],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (href.endsWith("/intake/hold")) {
        return new Response(JSON.stringify({ hold: { id: "hold-1" }, success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (href.endsWith("/intake/otp/send")) {
        return new Response(
          JSON.stringify({
            success: true,
            reused: false,
            holdExpiresAt: "2026-06-10T09:15:00.000Z",
            resendAvailableAt: "2026-06-10T09:01:00.000Z",
            sendsRemaining: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-06-10T09:00:00.000Z").getTime());

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading</div>}>
          <IntakePage params={Promise.resolve({ businessId: "biz-1" })} />
        </Suspense>,
      );
    });

    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/mobile/i), { target: { value: "+639171234567" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText(/choose your appointment/i);
    fireEvent.click(screen.getByRole("button", { name: /continue to time/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to review/i }));
    fireEvent.click(screen.getByRole("button", { name: /proceed to otp/i }));

    expect(await screen.findByText(/resend available in 1m/i)).toBeInTheDocument();
    expect(screen.getByText(/hold expires in 15m/i)).toBeInTheDocument();
    expect(screen.getByText(/2 sends remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend otp/i })).toBeDisabled();
  });

  it("returns to scheduling with a friendly message when the slot is no longer available", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/intake/config")) {
        return new Response(JSON.stringify({ template: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (href.endsWith("/intake")) {
        return new Response(JSON.stringify({ customer: { id: "cust-1" }, success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (href.includes("/intake/availability")) {
        return new Response(
          JSON.stringify({
            month: "2026-06",
            slotDurationMins: 30,
            byDay: {
              "2026-06-10": ["2026-06-10T09:00:00.000Z"],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (href.endsWith("/intake/hold")) {
        return new Response(JSON.stringify({ hold: { id: "hold-1" }, success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (href.endsWith("/intake/otp/send")) {
        return new Response(
          JSON.stringify({
            success: true,
            reused: false,
            holdExpiresAt: "2026-06-10T09:15:00.000Z",
            resendAvailableAt: "2026-06-10T09:01:00.000Z",
            sendsRemaining: 2,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (href.endsWith("/intake/otp/verify")) {
        return new Response(
          JSON.stringify({
            code: "OTP_SLOT_CONFLICT",
            message: "Selected slot is no longer available",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-06-10T09:00:00.000Z").getTime());

    await act(async () => {
      render(
        <Suspense fallback={<div>Loading</div>}>
          <IntakePage params={Promise.resolve({ businessId: "biz-1" })} />
        </Suspense>,
      );
    });

    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/mobile/i), { target: { value: "+639171234567" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText(/choose your appointment/i);
    fireEvent.click(screen.getByRole("button", { name: /continue to time/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to review/i }));
    fireEvent.click(screen.getByRole("button", { name: /proceed to otp/i }));

    const otpInput = await screen.findByLabelText(/otp code/i);
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() =>
      expect(screen.getByText(/that time slot was just taken/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/choose your appointment/i)).toBeInTheDocument();
  });
});
