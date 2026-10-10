import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";

const STORAGE_KEY = "tyvera-sidebar-collapsed-v1";

describe("useSidebarCollapsed", () => {
  // Node 25 exposes its own method-less `localStorage` global, which shadows jsdom's.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("edge: stays collapsed when no preference is stored", () => {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });

  it("edge: treats an unknown stored value as collapsed", () => {
    window.localStorage.setItem(STORAGE_KEY, "yes");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(true);
  });

  it("regression: restores an expanded sidebar from storage on first render", () => {
    window.localStorage.setItem(STORAGE_KEY, "0");
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current.collapsed).toBe(false);
  });

  it("happy: toggle persists the preference and updates every subscriber", () => {
    const first = renderHook(() => useSidebarCollapsed());
    const second = renderHook(() => useSidebarCollapsed());

    act(() => first.result.current.toggle());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("0");
    expect(first.result.current.collapsed).toBe(false);
    expect(second.result.current.collapsed).toBe(false);

    act(() => second.result.current.toggle());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
    expect(first.result.current.collapsed).toBe(true);
  });
});
