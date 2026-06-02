// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomerFormModal } from "./customer-form-modal";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: vi.fn(async () => "token") }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(async () => ({ templates: [] })),
}));

describe("CustomerFormModal mobile validation", () => {
  it("shows +63 guidance and blocks invalid mobile submission", () => {
    const onSubmit = vi.fn();
    render(
      <CustomerFormModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        businessId="biz1"
      />,
    );

    expect(screen.getByPlaceholderText("+639171234567")).toBeInTheDocument();
    expect(screen.getByText(/Use \+63 format/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/Mobile/i), { target: { value: "09171234567" } });
    fireEvent.click(screen.getByRole("button", { name: /save customer/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("+639171234567");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normalized valid mobile", () => {
    const onSubmit = vi.fn();
    render(
      <CustomerFormModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        businessId="biz1"
      />,
    );

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/Mobile/i), { target: { value: " +639171234567 " } });
    fireEvent.click(screen.getByRole("button", { name: /save customer/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ mobile: "+639171234567" }),
    );
  });
});
