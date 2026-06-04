import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManualFollowUpCard } from "./manual-follow-up-card";
import type { ManualFollowUpTask } from "./manual-follow-up.types";

const writeText = vi.fn(async () => undefined);
Object.assign(navigator, { clipboard: { writeText } });

function makeTask(overrides: Partial<ManualFollowUpTask> = {}): ManualFollowUpTask {
  return {
    id: "task-1",
    businessId: "biz-1",
    originalMessageEventId: "evt-1",
    retryMessageEventId: null,
    customerId: "cust-1",
    appointmentId: "appt-1",
    status: "open",
    recipientMobile: "+639171234567",
    messageBody: "Reminder body",
    failureReason: "provider_rejected",
    createdAt: "2026-06-05T00:00:00.000Z",
    customerName: "Ana Santos",
    businessName: "Tyvera Clinic",
    appointmentScheduledAt: null,
    duplicateRisk: false,
    ...overrides,
  };
}

describe("ManualFollowUpCard", () => {
  it("copies before opening the SMS deep link", () => {
    const { container } = render(
      <ManualFollowUpCard
        task={makeTask()}
        onContacted={vi.fn()}
        onDismiss={vi.fn()}
        onRetrySms={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: /open sms app/i });
    expect(link).toHaveAttribute(
      "href",
      "sms:+639171234567?body=Reminder%20body",
    );
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(writeText).toHaveBeenCalledWith("Reminder body");
    expect(screen.getByText(/copy fallback is available/i)).toBeInTheDocument();
    expect(
      container.querySelector("article.rounded-2xl.border-slate-200.bg-white"),
    ).toBeTruthy();
  });

  it("shows duplicate-risk warning and disables automatic retry", () => {
    render(
      <ManualFollowUpCard
        task={makeTask({ duplicateRisk: true })}
        onContacted={vi.fn()}
        onDismiss={vi.fn()}
        onRetrySms={vi.fn()}
      />,
    );

    expect(screen.getByText(/delivery could not be confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("border-amber-500/50");
    expect(
      screen.getByRole("button", { name: /retry automatic sms/i }),
    ).toBeDisabled();
  });

  it("runs contacted and dismiss actions", () => {
    const onContacted = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ManualFollowUpCard
        task={makeTask()}
        onContacted={onContacted}
        onDismiss={onDismiss}
        onRetrySms={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mark as contacted/i }));
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onContacted).toHaveBeenCalledWith("task-1");
    expect(onDismiss).toHaveBeenCalledWith("task-1");
  });
});
