import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader guidance", () => {
  it("renders purpose and next-step guidance for non-technical users", () => {
    render(
      <PageHeader
        title="Customers"
        plainLanguageDescription="Manage customer records in one place."
        whatThisPageIsFor="Quickly find and update customer details."
        whatToDoNext="Use Add customer, then search or filter as needed."
      />,
    );

    expect(screen.getByText(/what this page is for/i)).toBeInTheDocument();
    expect(screen.getByText(/what to do next/i)).toBeInTheDocument();
  });
});
