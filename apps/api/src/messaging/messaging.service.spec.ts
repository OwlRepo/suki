import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessagingService } from "./messaging.service";

describe("MessagingService", () => {
  let service: MessagingService;

  beforeEach(() => {
    vi.resetModules();
    service = new MessagingService();
  });

  it("reports hasOpenAi false when key is missing", () => {
    expect(service.hasOpenAi()).toBe(false);
  });
});
