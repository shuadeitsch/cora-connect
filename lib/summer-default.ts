import { normalizeState } from "@/lib/constants";
import type { ProjectSummerSetting } from "@/lib/types";

/** Two-letter code for a real state tab; "" for All states, Unsorted or blank. */
export function summerStateCode(state: string | null | undefined): string {
  const code = normalizeState(state ?? "");
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

export function summerSettingFor(settings: ProjectSummerSetting[] | undefined, projectId: string, state: string | null | undefined): ProjectSummerSetting | null {
  const code = summerStateCode(state);
  if (!projectId || projectId === "ALL" || !code) return null;
  return (settings ?? []).find((item) => item.projectId === projectId && item.state === code) ?? null;
}

export function summerDefaultText(projectName: string, setting: ProjectSummerSetting | null): string {
  if (!setting || !projectName) return "";
  return `${projectName}: ${setting.includeSummer ? "including" : "excluding"} summer homes`;
}

/**
 * Remember which project and state the summer choice was last set for, per screen group.
 * Returns true when the context just changed, which is when the project's default replaces a manual choice.
 */
export function summerContextChanged(storageKey: string, projectId: string, state: string | null | undefined): boolean {
  const key = `${projectId || "-"}|${summerStateCode(state) || "-"}`;
  try {
    if (window.localStorage.getItem(storageKey) === key) return false;
    window.localStorage.setItem(storageKey, key);
  } catch {
    return false;
  }
  return true;
}
