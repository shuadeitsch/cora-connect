"use client";

import { dayMatchesChavrusa, parseChavrusa, PRACTICE_BOCHURIM, type Chavrusa, type PlannerChavrusaFilter } from "@/lib/chavrusa";
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
  bochurChavrusa?: Record<string, Chavrusa | null>;
  plannerDayChavrusa?: Record<string, Chavrusa | null>;
  plannerFilter?: PlannerChavrusaFilter;
  viewerChavrusa?: Chavrusa | null;
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
      bochurChavrusa: parsed.bochurChavrusa ?? {},
      plannerDayChavrusa: parsed.plannerDayChavrusa ?? {},
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


/** Per-contact practice override, else a real share, else the shliach's default share setting. */
export function effectiveShare(house: { id: string; sharedWithBochurim?: boolean }, patch: PracticePatch): boolean {
  const share = patch.householdShare ?? {};
  if (Object.prototype.hasOwnProperty.call(share, house.id)) return Boolean(share[house.id]);
  if (house.sharedWithBochurim) return true;
  if (patch.shareNewWithBochurim !== undefined) return Boolean(patch.shareNewWithBochurim);
  return false;
}

/** Merge practice overlays into AppData. When viewing as bochur, hide unshared contacts. */
export function applyPractice(data: AppData, patch: PracticePatch): AppData {
  const tags = patch.householdTags ?? {};
  const households: HouseholdView[] = data.households.map((house) => {
    const next = { ...house, sharedWithBochurim: effectiveShare(house, patch) };
    if (tags[house.id]) next.tags = [...tags[house.id]];
    return next;
  });

  const extras = patch.addedHouseholds ?? [];
  const merged = extras.length
    ? [...households, ...extras.filter((house) => !households.some((item) => item.id === house.id)).map((house) => ({ ...house, sharedWithBochurim: effectiveShare(house, patch) }))]
    : households;

  let filtered = merged;
  if (data.viewer.role === "bochur") {
    filtered = merged.filter((house) => house.sharedWithBochurim);
  }

  const assignments = patch.bochurChavrusa ?? {};
  let members = data.members.map((member) => (
    Object.prototype.hasOwnProperty.call(assignments, member.id)
      ? { ...member, chavrusa: parseChavrusa(assignments[member.id]) }
      : member
  ));
  if (data.viewer.role === "shliach") {
    const mine = members.filter((member) => member.kind === "member" && member.role === "bochur" && member.leaderId === data.viewer.id);
    if (mine.length < 4) {
      for (const example of PRACTICE_BOCHURIM) {
        if (members.some((member) => member.id === example.id)) continue;
        members = [
          ...members,
          {
            ...example,
            leaderId: data.viewer.id,
            chavrusa: Object.prototype.hasOwnProperty.call(assignments, example.id)
              ? parseChavrusa(assignments[example.id])
              : example.chavrusa ?? null,
          },
        ];
      }
    }
  }

  return {
    ...data,
    households: filtered,
    members,
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
      chavrusa: data.viewer.role === "bochur"
        ? (patch.viewerChavrusa !== undefined ? parseChavrusa(patch.viewerChavrusa) : data.viewer.chavrusa ?? "A")
        : data.viewer.chavrusa ?? null,
    },
  };
}

export function applyPracticeDays<T extends { id: string; visibleToBochurim: boolean; editableByBochurim: boolean; chavrusa?: Chavrusa | null }>(
  days: T[],
  patch: PracticePatch,
  bochur: boolean,
  filter: PlannerChavrusaFilter = "all",
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
    if (Object.prototype.hasOwnProperty.call(patch.plannerDayChavrusa ?? {}, day.id)) {
      next.chavrusa = parseChavrusa(patch.plannerDayChavrusa![day.id]);
    }
    return next;
  });
  const view = bochur ? "all" : (patch.plannerFilter ?? filter);
  const bochurChavrusa = parseChavrusa(patch.viewerChavrusa);
  return mapped.filter((day) => {
    if (bochur && !day.visibleToBochurim) return false;
    return dayMatchesChavrusa(day, view, bochur ? (bochurChavrusa ?? "A") : null, bochur);
  });
}
