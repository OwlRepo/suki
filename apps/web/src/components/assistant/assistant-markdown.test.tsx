import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantMarkdown } from "./assistant-markdown";

describe("AssistantMarkdown", () => {
  it("renders bold Markdown without visible markers", () => {
    render(<AssistantMarkdown text="**SMS Usage**" />);

    expect(screen.getByText("SMS Usage").tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*SMS Usage\*\*/)).not.toBeInTheDocument();
  });

  it("renders headings and unordered lists", () => {
    render(<AssistantMarkdown text={"## Summary\n\n- First\n- Second"} />);

    expect(
      screen.getByRole("heading", { name: "Summary", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders ordered lists", () => {
    render(<AssistantMarkdown text={"1. First\n2. Second"} />);

    expect(screen.getByRole("list").tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders GFM tables inside a horizontal scroll wrapper", () => {
    render(
      <AssistantMarkdown
        text={"| Name | Visits |\n| --- | ---: |\n| Ana | 3 |"}
      />,
    );

    expect(
      screen.getByTestId("assistant-markdown-table-scroll"),
    ).toContainElement(screen.getByRole("table"));
  });

  it("renders inline code and fenced code blocks", () => {
    render(
      <AssistantMarkdown
        text={"Use `npm test`.\n\n```ts\nconst ready = true;\n```"}
      />,
    );

    expect(screen.getByText("npm test").tagName).toBe("CODE");
    expect(screen.getByText("const ready = true;").tagName).toBe("CODE");
  });

  it("does not inject raw HTML", () => {
    const { container } = render(
      <AssistantMarkdown
        text={'<img src="x" onerror="alert(1)">Safe text<script>alert(1)</script>'}
      />,
    );

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("script")).not.toBeInTheDocument();
  });

  it("renders allowlisted internal links as clickable", () => {
    render(<AssistantMarkdown text="[Settings](/settings)" />);

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it.each([
    ["external", "[External](https://attacker.example)"],
    ["javascript", "[JavaScript](javascript:alert(1))"],
    ["unknown internal", "[Unknown](/admin)"],
  ])("renders %s links as non-clickable text", (_, text) => {
    render(<AssistantMarkdown text={text} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
