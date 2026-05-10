import { describe, expect, it } from "vitest";
import { buildAssistantContextPack } from "./assistant-context";

describe("assistant context pack retrieval", () => {
  it("prioritizes route-specific docs for imports query", () => {
    const pack = buildAssistantContextPack({
      intent: "how_to",
      locale: "en",
      query: "How do I import customers from CSV?",
      memory: { summary: "", turns: [] },
      dataContext: {},
    });

    expect(pack.task_context.helpArticles[0]?.routes).toContain("/imports");
  });

  it("returns TL route-specific docs with equivalent structure", () => {
    const pack = buildAssistantContextPack({
      intent: "usage",
      locale: "tl",
      query: "Ilan ang AI credits ko at kailan reset?",
      memory: { summary: "", turns: [] },
      dataContext: {},
    });

    expect(pack.task_context.helpArticles.some((article) => article.routes.includes("/settings"))).toBe(true);
    expect(pack.task_context.helpArticles.some((article) => article.quickAnswer.length > 0)).toBe(true);
  });
});
