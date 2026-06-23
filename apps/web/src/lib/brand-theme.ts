type SrgbColor = {
  r: number;
  g: number;
  b: number;
};

type OklchColor = {
  l: number;
  c: number;
  h: number;
};

export type BrandTheme = {
  primary: string;
  primaryForeground: string;
  ring: string;
  onLight: string;
};

const DARK_TEXT_HEX = "#0a0a0a";
const WHITE_HEX = "#ffffff";
const MIN_TEXT_CONTRAST = 4.5;
const MIN_ON_LIGHT_CONTRAST = 3;

const WHITE = hexToSrgb(WHITE_HEX);
const DARK_TEXT = hexToSrgb(DARK_TEXT_HEX);
const WHITE_OKLCH = formatOklch(srgbToOklch(WHITE));
const DARK_TEXT_OKLCH = formatOklch(srgbToOklch(DARK_TEXT));

export function deriveBrandTheme(hex?: string | null): BrandTheme | null {
  const normalizedHex = normalizeHex(hex);
  if (!normalizedHex) return null;

  const brandSrgb = hexToSrgb(normalizedHex);
  const ring = formatOklch(srgbToOklch(brandSrgb));

  let primarySrgb = brandSrgb;
  let bestForeground = pickForeground(primarySrgb);

  if (bestForeground.contrast < MIN_TEXT_CONTRAST) {
    const darkened = darkenUntilContrast(primarySrgb, MIN_TEXT_CONTRAST);
    if (!darkened) return null;
    primarySrgb = darkened;
    bestForeground = pickForeground(primarySrgb);
  }

  const onLight = ensureContrastOnWhite(brandSrgb, MIN_ON_LIGHT_CONTRAST);

  return {
    primary: formatOklch(srgbToOklch(primarySrgb)),
    primaryForeground:
      bestForeground.hex === WHITE_HEX ? WHITE_OKLCH : DARK_TEXT_OKLCH,
    ring,
    onLight: formatOklch(srgbToOklch(onLight)),
  };
}

function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

function pickForeground(background: SrgbColor) {
  const whiteContrast = contrastRatio(background, WHITE);
  const darkContrast = contrastRatio(background, DARK_TEXT);

  return whiteContrast >= darkContrast
    ? { hex: WHITE_HEX, contrast: whiteContrast }
    : { hex: DARK_TEXT_HEX, contrast: darkContrast };
}

function darkenUntilContrast(color: SrgbColor, minimumContrast: number): SrgbColor | null {
  const base = srgbToOklch(color);

  for (let nextL = base.l; nextL >= 0; nextL -= 0.01) {
    const candidate = oklchToSrgb({ ...base, l: clamp(nextL, 0, 1) });
    if (pickForeground(candidate).contrast >= minimumContrast) {
      return candidate;
    }
  }

  return null;
}

function ensureContrastOnWhite(color: SrgbColor, minimumContrast: number): SrgbColor {
  if (contrastRatio(color, WHITE) >= minimumContrast) {
    return color;
  }

  const base = srgbToOklch(color);

  for (let nextL = base.l; nextL >= 0; nextL -= 0.01) {
    const candidate = oklchToSrgb({ ...base, l: clamp(nextL, 0, 1) });
    if (contrastRatio(candidate, WHITE) >= minimumContrast) {
      return candidate;
    }
  }

  return color;
}

function contrastRatio(first: SrgbColor, second: SrgbColor) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: SrgbColor) {
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToSrgb(hex: string): SrgbColor {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function srgbToOklch(color: SrgbColor): OklchColor {
  const r = toLinear(color.r);
  const g = toLinear(color.g);
  const b = toLinear(color.b);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  const labL =
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const labA =
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const labB =
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;

  const c = Math.sqrt(labA * labA + labB * labB);
  const rawHue = (Math.atan2(labB, labA) * 180) / Math.PI;

  return {
    l: clamp(labL, 0, 1),
    c,
    h: rawHue >= 0 ? rawHue : rawHue + 360,
  };
}

function oklchToSrgb(color: OklchColor): SrgbColor {
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
    r: clamp(fromLinear(linearR), 0, 1),
    g: clamp(fromLinear(linearG), 0, 1),
    b: clamp(fromLinear(linearB), 0, 1),
  };
}

function toLinear(value: number) {
  return value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number) {
  if (value <= 0) return 0;
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055;
}

function formatOklch(color: OklchColor) {
  return `oklch(${round(color.l, 4)} ${round(color.c, 4)} ${round(color.h, 2)})`;
}

function round(value: number, digits: number) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
