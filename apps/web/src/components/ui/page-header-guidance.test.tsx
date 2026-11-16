import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader guidance", () => {
  it("regression: keeps one contextual description instead of repeated guidance panels", () => {
    const { container } = render(
      <PageHeader
        title="Customers"
        plainLanguageDescription="Manage customer records in one place."
        whatThisPageIsFor="Quickly find and update customer details."
        whatToDoNext="Use Add customer, then search or filter as needed."
      />,
    );

    expect(screen.getByText("Manage customer records in one place.")).toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(screen.queryByText(/what this page is for/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/what to do next/i)).not.toBeInTheDocument();
  });
});
