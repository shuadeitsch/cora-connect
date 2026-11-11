"use client";

import type { AppData, HouseholdView } from "@/lib/types";

export const PRACTICE_KEY = "cora-practice-v1";

export type PracticePatch = {
  householdShare?: Record<string, boolean>;
  householdTags?: Record<string, string[]>;
  plannerVisible?: Record<string, boolean>;
  plannerEditable?: Record<string, boolean>;
  shareNewWithBochurim?: boolean;
  bochurimEditPlanner?: boolean;
  bochurimSeePlannerDefault?: boolean;
  /** When set, apply to every day first; per-day maps override afterward. */
  plannerVisibleAll?: boolean;
  plannerEditableAll?: boolean;
  addedHouseholds?: import("@/lib/types").HouseholdView[];
};

export function emptyPractice(): PracticePatch {
  return {
    householdShare: {},
    householdTags: {},
    plannerVisible: {},
    plannerEditable: {},
  };
}

export function loadPractice(): PracticePatch {
  if (typeof window === "undefined") return emptyPractice();
  try {
    const raw = window.sessionStorage.getItem(PRACTICE_KEY);
    if (!raw) return emptyPractice();
    const parsed = JSON.parse(raw) as PracticePatch;
    return {
      ...emptyPractice(),
      ...parsed,
      householdShare: parsed.householdShare ?? {},
      householdTags: parsed.householdTags ?? {},
      plannerVisible: parsed.plannerVisible ?? {},
      plannerEditable: parsed.plannerEditable ?? {},
    };
  } catch {
    return emptyPractice();
  }
}

export function savePractice(patch: PracticePatch) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PRACTICE_KEY, JSON.stringify(patch));
}

export function clearPractice() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PRACTICE_KEY);
}

/** Merge practice overlays into AppData. When viewing as bochur, hide unshared contacts. */
export function applyPractice(data: AppData, patch: PracticePatch): AppData {
  const share = patch.householdShare ?? {};
  const tags = patch.householdTags ?? {};
  const households: HouseholdView[] = data.households.map((house) => {
    const next = { ...house };
    if (Object.prototype.hasOwnProperty.call(share, house.id)) {
      next.sharedWithBochurim = Boolean(share[house.id]);
    }
    if (tags[house.id]) next.tags = [...tags[house.id]];
    return next;
  });

  const extras = patch.addedHouseholds ?? [];
  const merged = extras.length
    ? [...households, ...extras.filter((house) => !households.some((item) => item.id === house.id))]
    : households;

  let filtered = merged;
  if (data.viewer.role === "bochur") {
    filtered = merged.filter((house) => house.sharedWithBochurim !== false);
  }

  return {
    ...data,
    households: filtered,
    viewer: {
      ...data.viewer,
      shareNewWithBochurim:
        patch.shareNewWithBochurim !== undefined ? patch.shareNewWithBochurim : data.viewer.shareNewWithBochurim,
      bochurimEditPlanner:
        patch.bochurimEditPlanner !== undefined ? patch.bochurimEditPlanner : data.viewer.bochurimEditPlanner,
      bochurimSeePlannerDefault:
        patch.bochurimSeePlannerDefault !== undefined
          ? patch.bochurimSeePlannerDefault
          : data.viewer.bochurimSeePlannerDefault,
    },
  };
}

export function applyPracticeDays<T extends { id: string; visibleToBochurim: boolean; editableByBochurim: boolean }>(
  days: T[],
  patch: PracticePatch,
  bochur: boolean,
): T[] {
  const mapped = days.map((day) => {
    const next = { ...day };
    if (patch.plannerVisibleAll !== undefined) next.visibleToBochurim = Boolean(patch.plannerVisibleAll);
    if (patch.plannerEditableAll !== undefined) next.editableByBochurim = Boolean(patch.plannerEditableAll);
    if (Object.prototype.hasOwnProperty.call(patch.plannerVisible ?? {}, day.id)) {
      next.visibleToBochurim = Boolean(patch.plannerVisible![day.id]);
    }
    if (Object.prototype.hasOwnProperty.call(patch.plannerEditable ?? {}, day.id)) {
      next.editableByBochurim = Boolean(patch.plannerEditable![day.id]);
    }
    return next;
  });
  return bochur ? mapped.filter((day) => day.visibleToBochurim) : mapped;
}
