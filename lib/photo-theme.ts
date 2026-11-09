/** Client-side palette from a background photo — no extra deps. */

export type PhotoThemeColors = {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  card: string;
  muted: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  secondary: string;
  dark: boolean;
  /** 0–1 overlay opacity over the photo */
  overlay: number;
};

export const PHOTO_THEME_KEY = "cora-photo-theme";

type Rgb = { r: number; g: number; b: number };

function clamp(n: number, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, n));
}

function hex({ r, g, b }: Rgb) {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgb(r: number, g: number, b: number): Rgb {
  return { r, g, b };
}

/** Relative luminance (sRGB). */
export function luminance({ r, g, b }: Rgb) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: Rgb, b: Rgb) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl({ r, g, b }: Rgb) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const H = ((h % 360) + 360) % 360;
  const S = clamp(s);
  const L = clamp(l);
  if (S === 0) {
    const v = L * 255;
    return rgb(v, v, v);
  }
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const hk = H / 360;
  const t = (n: number) => {
    let x = n;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return rgb(t(hk + 1 / 3) * 255, t(hk) * 255, t(hk - 1 / 3) * 255);
}

/** Nudge lightness until contrast vs background is at least minRatio. */
function ensureContrast(fg: Rgb, bg: Rgb, minRatio = 4.5): Rgb {
  if (contrastRatio(fg, bg) >= minRatio) return fg;
  const hsl = toHsl(fg);
  const bgL = luminance(bg);
  const preferLight = bgL < 0.45;
  for (let step = 0; step <= 40; step++) {
    const delta = step * 0.02;
    const next = fromHsl(hsl.h, hsl.s, preferLight ? clamp(hsl.l + delta) : clamp(hsl.l - delta));
    if (contrastRatio(next, bg) >= minRatio) return next;
  }
  return preferLight ? rgb(255, 255, 255) : rgb(20, 18, 16);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return rgb(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
}

type Bucket = { count: number; r: number; g: number; b: number };

/** Sample an image source (blob URL, data URL, or CORS-enabled http URL). */
export async function extractPhotoTheme(source: string | Blob | File): Promise<PhotoThemeColors> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const revoke = typeof source !== "string";
  try {
    const img = await loadImage(url);
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<string, Bucket>();
    let sumL = 0;
    let pixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const L = luminance(rgb(r, g, b));
      sumL += L;
      pixels += 1;
      // Skip near-white / near-black for hue picking
      if (L > 0.92 || L < 0.08) continue;
      const qr = r >> 5;
      const qg = g >> 5;
      const qb = b >> 5;
      const key = `${qr},${qg},${qb}`;
      const hit = buckets.get(key);
      if (hit) {
        hit.count += 1;
        hit.r += r;
        hit.g += g;
        hit.b += b;
      } else buckets.set(key, { count: 1, r, g, b });
    }
    const avgL = pixels ? sumL / pixels : 0.5;
    const ranked = [...buckets.values()]
      .map((b) => ({
        count: b.count,
        color: rgb(b.r / b.count, b.g / b.count, b.b / b.count),
      }))
      .sort((a, b) => b.count - a.count);

    const colorful = ranked.filter((row) => toHsl(row.color).s > 0.12);
    const pool = colorful.length ? colorful : ranked;
    const dominant = pool[0]?.color ?? rgb(15, 118, 110);
    let accent = dominant;
    const domH = toHsl(dominant).h;
    for (const row of pool.slice(1)) {
      const dh = Math.abs(toHsl(row.color).h - domH);
      const hueDist = Math.min(dh, 360 - dh);
      if (hueDist > 35) {
        accent = row.color;
        break;
      }
    }
    if (accent === dominant) {
      const hsl = toHsl(dominant);
      accent = fromHsl((hsl.h + 40) % 360, clamp(hsl.s * 0.85, 0.2, 0.7), clamp(hsl.l + (avgL < 0.45 ? 0.15 : -0.1), 0.25, 0.75));
    }

    const dark = avgL < 0.42;
    const domHsl = toHsl(dominant);
    const primaryBase = fromHsl(
      domHsl.h,
      clamp(Math.max(domHsl.s, 0.35), 0.35, 0.72),
      dark ? clamp(Math.max(domHsl.l, 0.55), 0.52, 0.72) : clamp(Math.min(domHsl.l, 0.42), 0.28, 0.48),
    );
    const card = dark
      ? mix(rgb(28, 26, 23), dominant, 0.12)
      : mix(rgb(255, 252, 248), dominant, 0.08);
    const background = dark
      ? mix(rgb(18, 17, 15), dominant, 0.1)
      : mix(rgb(243, 239, 232), dominant, 0.12);
    const muted = dark ? mix(background, rgb(255, 255, 255), 0.08) : mix(background, dominant, 0.1);
    const border = dark ? mix(background, rgb(255, 255, 255), 0.16) : mix(background, rgb(28, 25, 21), 0.14);
    const secondary = muted;
    const foreground = ensureContrast(dark ? rgb(244, 239, 232) : rgb(28, 25, 21), card, 7);
    const mutedForeground = ensureContrast(
      dark ? rgb(196, 184, 170) : rgb(92, 86, 78),
      card,
      4.5,
    );
    const primary = primaryBase;
    const primaryForeground = ensureContrast(dark ? rgb(10, 30, 28) : rgb(247, 255, 254), primary, 4.5);
    // Prefer white text on primary buttons when it already passes — keeps buttons readable.
    const whiteOnPrimary = contrastRatio(rgb(255, 255, 255), primary);
    const blackOnPrimary = contrastRatio(rgb(20, 18, 16), primary);
    const buttonFg =
      whiteOnPrimary >= 4.5 && whiteOnPrimary >= blackOnPrimary
        ? rgb(255, 255, 255)
        : blackOnPrimary >= 4.5
          ? rgb(20, 18, 16)
          : primaryForeground;

    const accentHsl = toHsl(accent);
    const accentBg = dark
      ? fromHsl(accentHsl.h, clamp(accentHsl.s * 0.45, 0.15, 0.4), 0.18)
      : fromHsl(accentHsl.h, clamp(accentHsl.s * 0.35, 0.12, 0.35), 0.92);
    const accentFg = ensureContrast(fromHsl(accentHsl.h, 0.55, dark ? 0.82 : 0.32), accentBg, 4.5);

    // Stronger overlay on busy/mid photos so text stays readable
    const overlay = dark ? clamp(0.62 + (0.42 - avgL) * 0.25, 0.58, 0.78) : clamp(0.72 + Math.abs(avgL - 0.55) * 0.15, 0.7, 0.84);

    return {
      primary: hex(primary),
      primaryForeground: hex(buttonFg),
      accent: hex(accentBg),
      accentForeground: hex(accentFg),
      background: hex(background),
      card: hex(card),
      muted: hex(muted),
      border: hex(border),
      foreground: hex(foreground),
      mutedForeground: hex(mutedForeground),
      secondary: hex(secondary),
      dark,
      overlay: Math.round(overlay * 100) / 100,
    };
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that picture."));
    img.src = url;
  });
}

const VAR_MAP: { key: keyof PhotoThemeColors; css: string }[] = [
  { key: "primary", css: "--primary" },
  { key: "primaryForeground", css: "--primary-foreground" },
  { key: "accent", css: "--accent" },
  { key: "accentForeground", css: "--accent-foreground" },
  { key: "background", css: "--background" },
  { key: "card", css: "--card" },
  { key: "muted", css: "--muted" },
  { key: "border", css: "--border" },
  { key: "foreground", css: "--foreground" },
  { key: "mutedForeground", css: "--muted-foreground" },
  { key: "secondary", css: "--secondary" },
];

const EXTRA_VARS = [
  "--popover",
  "--sidebar",
  "--input",
  "--ring",
  "--chart-1",
  "--sidebar-primary",
  "--sidebar-ring",
  "--sidebar-accent",
  "--sidebar-border",
  "--sidebar-foreground",
  "--card-foreground",
  "--popover-foreground",
  "--secondary-foreground",
  "--sidebar-primary-foreground",
  "--sidebar-accent-foreground",
];

/** Apply a photo-derived palette. Leaves the preset id in localStorage so uncheck can restore it. */
export function applyPhotoTheme(colors: PhotoThemeColors) {
  const root = document.documentElement;
  root.setAttribute("data-photo-theme", "1");
  root.removeAttribute("data-palette");
  root.classList.toggle("dark", colors.dark);
  for (const { key, css } of VAR_MAP) {
    const value = colors[key];
    if (typeof value === "string") root.style.setProperty(css, value);
  }
  root.style.setProperty("--popover", colors.card);
  root.style.setProperty("--sidebar", colors.card);
  root.style.setProperty("--input", colors.border);
  root.style.setProperty("--ring", colors.primary);
  root.style.setProperty("--chart-1", colors.primary);
  root.style.setProperty("--sidebar-primary", colors.primary);
  root.style.setProperty("--sidebar-ring", colors.primary);
  root.style.setProperty("--sidebar-accent", colors.muted);
  root.style.setProperty("--sidebar-border", colors.border);
  root.style.setProperty("--sidebar-foreground", colors.foreground);
  root.style.setProperty("--card-foreground", colors.foreground);
  root.style.setProperty("--popover-foreground", colors.foreground);
  root.style.setProperty("--secondary-foreground", colors.foreground);
  root.style.setProperty("--sidebar-primary-foreground", colors.primaryForeground);
  root.style.setProperty("--sidebar-accent-foreground", colors.foreground);
  root.style.setProperty("--page-overlay", String(colors.overlay));
  window.localStorage.setItem("cora-theme", colors.dark ? "dark" : "light");
  window.localStorage.setItem(PHOTO_THEME_KEY, JSON.stringify(colors));
}

export function clearPhotoTheme() {
  const root = document.documentElement;
  root.removeAttribute("data-photo-theme");
  root.style.removeProperty("--page-overlay");
  for (const { css } of VAR_MAP) root.style.removeProperty(css);
  for (const css of EXTRA_VARS) root.style.removeProperty(css);
  window.localStorage.removeItem(PHOTO_THEME_KEY);
}

export function isPhotoThemeColors(value: unknown): value is PhotoThemeColors {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.primary === "string" && typeof row.card === "string" && typeof row.dark === "boolean";
}
