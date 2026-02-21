import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders required what/why/next guidance text", () => {
    render(
      <EmptyState
        what="No customers yet"
        why="Add customers to track visits and send offers."
        nextAction={<button>Add your first customer</button>}
      />
    );
    expect(screen.getByText("No customers yet")).toBeInTheDocument();
    expect(screen.getByText("Add customers to track visits and send offers.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add your first customer/i })).toBeInTheDocument();
  });

  it("CTA is present and keyboard-focusable via tabIndex or native button", () => {
    render(
      <EmptyState
        what="Empty"
        why="Why text"
        nextAction={<button>Add customer</button>}
      />
    );
    const cta = screen.getByRole("button", { name: /add customer/i });
    expect(cta).toBeInTheDocument();
    expect(cta.tagName).toBe("BUTTON");
  });

  it("renders without nextAction when not provided", () => {
    render(
      <EmptyState
        what="What"
        why="Why"
      />
    );
    expect(screen.getByText("What")).toBeInTheDocument();
    expect(screen.getByText("Why")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
