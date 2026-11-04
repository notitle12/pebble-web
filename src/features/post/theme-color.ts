export type RGB = { r: number; g: number; b: number; a: number };
export type ThemePair = { light: string; dark: string };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const channel = (value: string, scale = 255) => value.endsWith("%")
  ? clamp(Number.parseFloat(value) * scale / 100, 0, scale)
  : clamp(Number.parseFloat(value), 0, scale);

export function parseThemeColor(value: unknown): RGB | null {
  if (typeof value !== "string") return null;
  const input = value.trim();
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(input)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? [...hex].map(char => char + char).join("") : hex;
    const parts = digits.match(/[\da-f]{2}/gi)!.map(part => Number.parseInt(part, 16));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] / 255 };
  }
  const rgb = /^rgba?\(\s*([^)]*)\s*\)$/i.exec(input)?.[1];
  if (!rgb) return null;
  const [components, alphaPart] = rgb.split("/").map(part => part.trim());
  const values = components.includes(",") ? components.split(",").map(part => part.trim()) : components.split(/\s+/);
  if (values.length < 3 || values.length > 4) return null;
  const alpha = alphaPart ?? values[3];
  const parse = (part: string, max: number) => {
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(part)) return NaN;
    return channel(part, max);
  };
  const r = parse(values[0], 255), g = parse(values[1], 255), b = parse(values[2], 255);
  const a = alpha === undefined ? 1 : parse(alpha, 1);
  return [r, g, b, a].every(Number.isFinite) ? { r, g, b, a } : null;
}

export function toHex(color: RGB): string {
  return `#${[color.r, color.g, color.b].map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

export function composite(foreground: RGB, background: RGB): RGB {
  const a = foreground.a + background.a * (1 - foreground.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (f: number, b: number) => (f * foreground.a + b * background.a * (1 - foreground.a)) / a;
  return { r: mix(foreground.r, background.r), g: mix(foreground.g, background.g), b: mix(foreground.b, background.b), a };
}

const luminance = ({ r, g, b }: RGB) => {
  const linear = (v: number) => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
  return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
};

export function contrastRatio(first: RGB, second: RGB): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + .05) / (dark + .05);
}

const blend = (color: RGB, endpoint: RGB, amount: number): RGB => ({
  r: color.r + (endpoint.r - color.r) * amount,
  g: color.g + (endpoint.g - color.g) * amount,
  b: color.b + (endpoint.b - color.b) * amount,
  a: 1,
});

export function readableForeground(color: RGB, background: RGB, minimum = 4.5): RGB {
  const target = minimum + .03;
  const opaque = { ...color, a: 1 };
  if (contrastRatio(opaque, background) >= target) return opaque;
  const candidates = [
    { r: 0, g: 0, b: 0, a: 1 },
    { r: 255, g: 255, b: 255, a: 1 },
  ].map(endpoint => {
    let low = 0, high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (contrastRatio(blend(opaque, endpoint, mid), background) >= target) high = mid;
      else low = mid;
    }
    return { color: blend(opaque, endpoint, high), amount: high };
  });
  return candidates.sort((a, b) => a.amount - b.amount)[0].color;
}

export const themeBackgrounds = {
  light: { r: 255, g: 255, b: 255, a: 1 },
  dark: { r: 23, g: 33, b: 27, a: 1 },
} satisfies Record<keyof ThemePair, RGB>;

export function textThemePair(color: unknown, highlight?: unknown): ThemePair | null {
  const source = parseThemeColor(color);
  if (!source) return null;
  const highlightColor = highlight === undefined ? null : parseThemeColor(highlight);
  if (highlight !== undefined && !highlightColor) return null;
  const map = (theme: keyof ThemePair) => {
    const page = themeBackgrounds[theme];
    const background = highlightColor ? parseThemeColor(highlightThemePair(highlight)![theme])! : page;
    return toHex(readableForeground(composite(source, background), background));
  };
  return { light: map("light"), dark: map("dark") };
}

export function highlightThemePair(color: unknown): ThemePair | null {
  const source = parseThemeColor(color);
  if (!source) return null;
  const map = (theme: keyof ThemePair) => {
    const page = themeBackgrounds[theme];
    return toHex(readableForeground(composite(source, page), page, 1.2));
  };
  return { light: map("light"), dark: map("dark") };
}

export function themeColorVariables(color: unknown, highlight?: unknown): Record<string, string> | null {
  const text = textThemePair(color, highlight);
  if (!text) return null;
  const vars: Record<string, string> = {
    "--pebble-text-light": text.light,
    "--pebble-text-dark": text.dark,
  };
  if (highlight !== undefined) {
    const background = highlightThemePair(highlight);
    if (!background) return null;
    vars["--pebble-highlight-light"] = background.light;
    vars["--pebble-highlight-dark"] = background.dark;
  }
  return vars;
}
