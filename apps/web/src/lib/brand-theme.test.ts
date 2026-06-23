import { describe, expect, it } from "vitest";
import { deriveBrandTheme } from "./brand-theme";

describe("deriveBrandTheme", () => {
  it("returns null for invalid colors", () => {
    expect(deriveBrandTheme("blue")).toBeNull();
    expect(deriveBrandTheme("#12345")).toBeNull();
  });

  it("keeps readable text contrast for neon and pale colors", () => {
    const neon = deriveBrandTheme("#EEFF00");
    const pale = deriveBrandTheme("#EFEFEF");

    expect(neon).not.toBeNull();
    expect(pale).not.toBeNull();

    expect(
      contrastFromOklch(neon!.primary, neon!.primaryForeground),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastFromOklch(pale!.primary, pale!.primaryForeground),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrastFromOklch(pale!.onLight, "oklch(1 0 0)")).toBeGreaterThanOrEqual(3);
  });

  it("darkens mid-tone colors until one foreground passes contrast", () => {
    const theme = deriveBrandTheme("#777777");

    expect(theme).not.toBeNull();
    expect(
      contrastFromOklch(theme!.primary, theme!.primaryForeground),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

function contrastFromOklch(first: string, second: string) {
  const firstLuminance = relativeLuminance(oklchToSrgb(parseOklch(first)));
  const secondLuminance = relativeLuminance(oklchToSrgb(parseOklch(second)));
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseOklch(value: string) {
  const match = value.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) {
    throw new Error(`Unsupported color: ${value}`);
  }

  return {
    l: Number(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
  };
}

function oklchToSrgb(color: { l: number; c: number; h: number }) {
  const hueRadians = (color.h * Math.PI) / 180;
  const labA = color.c * Math.cos(hueRadians);
  const labB = color.c * Math.sin(hueRadians);

  const lRoot = color.l + 0.3963377774 * labA + 0.2158037573 * labB;
  const mRoot = color.l - 0.1055613458 * labA - 0.0638541728 * labB;
  const sRoot = color.l - 0.0894841775 * labA - 1.291485548 * labB;

  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  const linearR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linearG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linearB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: fromLinear(linearR),
    g: fromLinear(linearG),
    b: fromLinear(linearB),
  };
}

function relativeLuminance(color: { r: number; g: number; b: number }) {
  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
}

function toLinear(value: number) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * clamped ** (1 / 2.4) - 0.055;
}
