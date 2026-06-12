import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProgressiveAssistantText } from "./use-progressive-assistant-text";

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function drainRevealFrames() {
  for (let frame = 0; frame < 100; frame += 1) {
    act(() => {
      vi.advanceTimersByTime(16);
    });
  }
}

describe("useProgressiveAssistantText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reveals target text incrementally instead of immediately", () => {
    const { result } = renderHook(() =>
      useProgressiveAssistantText({
        targetText: "Progressively revealed text",
        enabled: true,
      }),
    );

    expect(result.current.visibleText).toBe("");
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current.visibleText.length).toBeGreaterThan(0);
    expect(result.current.visibleText).not.toBe("Progressively revealed text");
  });

  it("appends a later target suffix and drains it progressively", () => {
    const { result, rerender } = renderHook(
      ({ targetText }) =>
        useProgressiveAssistantText({ targetText, enabled: true }),
      { initialProps: { targetText: "First" } },
    );

    drainRevealFrames();
    expect(result.current.visibleText).toBe("First");

    rerender({ targetText: "First second" });
    expect(result.current.visibleText).toBe("First");
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current.visibleText).toMatch(/^First/);
    expect(result.current.visibleText).not.toBe("First second");
    drainRevealFrames();
    expect(result.current.visibleText).toBe("First second");
  });

  it("reports revealing state while pending and false after drain", () => {
    const onRevealChange = vi.fn();
    const { result } = renderHook(() =>
      useProgressiveAssistantText({
        targetText: "Pending",
        enabled: true,
        onRevealChange,
      }),
    );

    expect(result.current.isRevealing).toBe(true);
    drainRevealFrames();
    expect(result.current.isRevealing).toBe(false);
    expect(onRevealChange).toHaveBeenNthCalledWith(1, true);
    expect(onRevealChange).toHaveBeenLastCalledWith(false);
  });

  it("immediately renders when disabled", () => {
    const { result } = renderHook(() =>
      useProgressiveAssistantText({
        targetText: "Immediate",
        enabled: false,
      }),
    );

    expect(result.current).toEqual({
      visibleText: "Immediate",
      isRevealing: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("immediately renders when reduced motion is enabled", () => {
    stubReducedMotion(true);

    const { result } = renderHook(() =>
      useProgressiveAssistantText({
        targetText: "Reduced motion",
        enabled: true,
      }),
    );

    expect(result.current).toEqual({
      visibleText: "Reduced motion",
      isRevealing: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels timers on unmount", () => {
    const { unmount } = renderHook(() =>
      useProgressiveAssistantText({
        targetText: "A long target that still has text left to reveal",
        enabled: true,
      }),
    );

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
