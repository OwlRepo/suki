import { describe, expect, it } from "vitest";
import { AssistantPlainAnswerStreamParser } from "./assistant-json-stream-parser";

describe("AssistantPlainAnswerStreamParser", () => {
  it("emits plain text when fragments split inside plainAnswer", () => {
    const parser = new AssistantPlainAnswerStreamParser();

    expect(parser.push('{"plainAn')).toBe("");
    expect(parser.push('swer":"Hello ')).toBe("Hello ");
    expect(parser.push('world","nextStep":"Open settings"}')).toBe("world");
    expect(() => parser.finish()).not.toThrow();
  });

  it("handles escaped quotes", () => {
    const parser = new AssistantPlainAnswerStreamParser();

    expect(parser.push('{"plainAnswer":"Say \\"hel')).toBe('Say "hel');
    expect(parser.push('lo\\" now"}')).toBe('lo" now');
    expect(() => parser.finish()).not.toThrow();
  });

  it("handles escaped newlines", () => {
    const parser = new AssistantPlainAnswerStreamParser();

    expect(parser.push('{"plainAnswer":"Line one\\nLine two"}')).toBe(
      "Line one\nLine two",
    );
    expect(() => parser.finish()).not.toThrow();
  });

  it("handles unicode escapes split across chunks", () => {
    const parser = new AssistantPlainAnswerStreamParser();

    expect(parser.push('{"plainAnswer":"Hi \\u')).toBe("Hi ");
    expect(parser.push("263")).toBe("");
    expect(parser.push('A"}')).toBe("☺");
    expect(() => parser.finish()).not.toThrow();
  });

  it("emits nothing for fields before plainAnswer", () => {
    const parser = new AssistantPlainAnswerStreamParser();

    expect(parser.push('{"intentKey":"usage","plainAnswer":"Ready"}')).toBe(
      "Ready",
    );
  });

  it("emits nothing for fields after plainAnswer", () => {
    const parser = new AssistantPlainAnswerStreamParser();

    expect(
      parser.push(
        '{"plainAnswer":"Ready","nextStep":"Do not stream this","details":"Hidden"}',
      ),
    ).toBe("Ready");
  });

  it("rejects an incomplete plainAnswer string at finish", () => {
    const parser = new AssistantPlainAnswerStreamParser();

    parser.push('{"plainAnswer":"Incomplete');

    expect(() => parser.finish()).toThrow("ASSISTANT_STREAM_PARSE_INCOMPLETE");
  });

  it("never leaks JSON braces or field names", () => {
    const parser = new AssistantPlainAnswerStreamParser();
    const emitted = [
      parser.push('{"details":"hidden",'),
      parser.push('"plainAnswer":"Visible'),
      parser.push(' text","nextStep":"hidden"}'),
    ].join("");

    expect(emitted).toBe("Visible text");
    expect(emitted).not.toMatch(/[{}]/);
    expect(emitted).not.toContain("plainAnswer");
    expect(emitted).not.toContain("nextStep");
  });
});
