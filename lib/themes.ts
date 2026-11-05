export const THEMES = [
  { id: "classic", label: "Classic green", dark: false, swatch: ["#0f766e", "#f3efe8", "#fffcf8"] },
  { id: "ocean", label: "Ocean blue", dark: false, swatch: ["#1d5fa8", "#eef3f8", "#fbfdff"] },
  { id: "sand", label: "Warm sand", dark: false, swatch: ["#a4521c", "#f4ebdd", "#fffaf2"] },
  { id: "purple", label: "Royal purple", dark: false, swatch: ["#6b3fa0", "#f1edf6", "#fdfbff"] },
  { id: "soft", label: "Soft light", dark: false, swatch: ["#3f6f8f", "#fafaf8", "#ffffff"] },
  { id: "dark", label: "Dark mode", dark: true, swatch: ["#2dd4bf", "#12110f", "#1c1a17"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_KEY = "cora-palette";
export const isThemeId = (value: unknown): value is ThemeId => THEMES.some((theme) => theme.id === value);

/** Applies a preset right away: the palette attribute plus light/dark. */
export function applyTheme(id: ThemeId) {
  const theme = THEMES.find((item) => item.id === id)!;
  const root = document.documentElement;
  if (id === "classic" || id === "dark") root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", id);
  root.classList.toggle("dark", theme.dark);
  window.localStorage.setItem(THEME_KEY, id);
  window.localStorage.setItem("cora-theme", theme.dark ? "dark" : "light");
}
