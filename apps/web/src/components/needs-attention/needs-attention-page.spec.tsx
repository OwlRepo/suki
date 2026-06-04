import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NeedsAttentionPage } from "./needs-attention-page";

vi.mock("./manual-follow-up.api", () => ({
  listOpenManualFollowUps: vi.fn(async () => [
    {
      id: "task-1",
      businessId: "biz-1",
      originalMessageEventId: "evt-1",
      retryMessageEventId: null,
      customerId: "cust-1",
      appointmentId: null,
      status: "open",
      recipientMobile: "+639171234567",
      messageBody: "Reminder body",
      failureReason: "provider_rejected",
      createdAt: "2026-06-05T00:00:00.000Z",
      customerName: "Ana Santos",
      businessName: "Tyvera Clinic",
      appointmentScheduledAt: null,
      duplicateRisk: false,
    },
  ]),
  markManualFollowUpContacted: vi.fn(async () => ({})),
  dismissManualFollowUp: vi.fn(async () => ({})),
  retryManualFollowUpSms: vi.fn(async () => ({})),
}));

Object.assign(navigator, { clipboard: { writeText: vi.fn() } });

describe("NeedsAttentionPage", () => {
  it("renders open manual follow-up tasks", async () => {
    render(<NeedsAttentionPage />);

    await waitFor(() => {
      expect(screen.getByText("Ana Santos")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /needs attention/i })).toBeInTheDocument();
  });
});
