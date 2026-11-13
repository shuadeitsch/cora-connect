export const SIDEBAR_ORDER_KEY = "cora_sidebar_order";

/** Default sidebar order. Pre-planner sits directly above Routes. */
export const DEFAULT_NAV_HREFS = [
  "/dashboard",
  "/households",
  "/pre-planner",
  "/saved-routes",
  "/planner",
  "/team",
  "/settings",
  "/map",
  "/beta",
  "/tutorials",
] as const;

export const MORE_NAV_HREFS = new Set(["/map", "/beta", "/tutorials"]);

export type NavHref = (typeof DEFAULT_NAV_HREFS)[number];

export function isNavHref(value: string): value is NavHref {
  return (DEFAULT_NAV_HREFS as readonly string[]).includes(value);
}

/** Keep known hrefs, drop unknowns, and append any new default items the user has not placed yet. */
export function normalizeNavOrder(saved: unknown): string[] {
  const known = DEFAULT_NAV_HREFS as readonly string[];
  const seen = new Set<string>();
  const out: string[] = [];
  const list = Array.isArray(saved) ? saved : [];
  for (const item of list) {
    if (typeof item !== "string" || !known.includes(item) || seen.has(item)) continue;
    out.push(item);
    seen.add(item);
  }
  for (const href of known) {
    if (!seen.has(href)) out.push(href);
  }
  return out;
}

export function sameNavOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((href, index) => href === b[index]);
}

export function orderNavItems<T extends { href: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(normalizeNavOrder(order).map((href, index) => [href, index]));
  return [...items].sort((a, b) => (rank.get(a.href) ?? 999) - (rank.get(b.href) ?? 999));
}

export function readStoredNavOrder(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? normalizeNavOrder(parsed) : null;
  } catch {
    return null;
  }
}

export function writeStoredNavOrder(order: string[] | null) {
  if (typeof window === "undefined") return;
  if (!order || sameNavOrder(order, [...DEFAULT_NAV_HREFS])) {
    window.localStorage.removeItem(SIDEBAR_ORDER_KEY);
    return;
  }
  window.localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(normalizeNavOrder(order)));
}
