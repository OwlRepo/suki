import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HelpPage from "./page";

describe("Help language and feedback states", () => {
  it("regression: exposes selected language and the language of localized content", () => {
    const { container } = render(<HelpPage />);
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Tagalog" }));
    expect(screen.getByRole("button", { name: "Tagalog" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector('[lang="tl"]')).toBeInTheDocument();
  });

  it("regression: exposes helpful feedback selection without relying on color", () => {
    render(<HelpPage />);
    const helpful = screen.getAllByRole("button", { name: "Helpful" })[0]!;
    fireEvent.click(helpful);
    expect(helpful).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: "Not helpful" })[0]).toHaveAttribute("aria-pressed", "false");
  });
});
