"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyPractice,
  applyPracticeDays,
  clearPractice,
  emptyPractice,
  loadPractice,
  savePractice,
  type PracticePatch,
} from "@/lib/practice";
import type { Chavrusa, PlannerChavrusaFilter } from "@/lib/chavrusa";
import type { AppData, HouseholdInput, VisitInput } from "@/lib/types";
import {
  applySandboxVisit,
  applyTutorialSandbox,
  clearTutorialSandbox,
  isTutorialPracticeOn,
  loadOrSeedTutorialSandbox,
  saveTutorialSandbox,
  sandboxFromHouseholdInput,
  setTutorialPracticeOn,
  tutorialActionDone,
  type SandboxDay,
  type TutorialSandbox,
} from "@/lib/tutorial-sandbox";

type PracticeContextValue = {
  active: boolean;
  sandbox: boolean;
  patch: PracticePatch;
  sandboxDays: SandboxDay[] | null;
  completed: Record<string, boolean>;
  setShare: (householdId: string, shared: boolean) => void;
  setTags: (householdId: string, tags: string[]) => void;
  setPlannerVisible: (dayId: string, visible: boolean) => void;
  setPlannerEditable: (dayId: string, editable: boolean) => void;
  setPref: (key: "shareNewWithBochurim" | "bochurimEditPlanner" | "bochurimSeePlannerDefault", value: boolean) => void;
  setBochurChavrusa: (bochurId: string, chavrusa: Chavrusa | null) => void;
  setPlannerDayChavrusa: (dayId: string, chavrusa: Chavrusa | null) => void;
  setPlannerFilter: (filter: PlannerChavrusaFilter) => void;
  setViewerChavrusa: (chavrusa: Chavrusa | null) => void;
  saveHousehold: (input: HouseholdInput) => { ok: true; data: { id: string } };
  saveVisit: (input: VisitInput) => { ok: true; data: { id: string } };
  recordSuggestion: () => void;
  addPlannerDay: (date: string, chavrusa?: Chavrusa | null) => void;
  removePlannerDay: (dayId: string) => void;
  addPlannerItem: (input: { dayId: string; kind: "route" | "event"; title?: string; time?: string | null; notes?: string; address?: string; routeId?: string | null }) => void;
  updatePlannerItem: (input: { id: string; title?: string; time?: string | null; notes?: string; address?: string }) => void;
  removePlannerItem: (itemId: string) => void;
  markDone: (stepId: string) => void;
  actionDone: (stepId: string) => boolean;
  reset: () => void;
  clearSandbox: () => void;
  mergeData: (data: AppData) => AppData;
  mergeDays: <T extends { id: string; visibleToBochurim: boolean; editableByBochurim: boolean; chavrusa?: Chavrusa | null }>(days: T[], bochur: boolean, filter?: PlannerChavrusaFilter) => T[];
};

const PracticeContext = createContext<PracticeContextValue | null>(null);

const noopFallback: PracticeContextValue = {
  active: false,
  sandbox: false,
  patch: emptyPractice(),
  sandboxDays: null,
  completed: {},
  setShare: () => {},
  setTags: () => {},
  setPlannerVisible: () => {},
  setPlannerEditable: () => {},
  setPref: () => {},
  setBochurChavrusa: () => {},
  setPlannerDayChavrusa: () => {},
  setPlannerFilter: () => {},
  setViewerChavrusa: () => {},
  saveHousehold: (input) => ({ ok: true, data: { id: input.id || "" } }),
  saveVisit: (input) => ({ ok: true, data: { id: input.id || "" } }),
  recordSuggestion: () => {},
  addPlannerDay: () => {},
  removePlannerDay: () => {},
  addPlannerItem: () => {},
  updatePlannerItem: () => {},
  removePlannerItem: () => {},
  markDone: () => {},
  actionDone: () => false,
  reset: () => {},
  clearSandbox: () => {},
  mergeData: (data) => data,
  mergeDays: (days) => days,
};

export function PracticeProvider({
  active,
  sandbox = false,
  children,
}: {
  active: boolean;
  sandbox?: boolean;
  children: ReactNode;
}) {
  const sandboxOn = sandbox || (typeof window !== "undefined" && isTutorialPracticeOn());
  const [patch, setPatch] = useState<PracticePatch>(() => (active || sandboxOn ? loadPractice() : emptyPractice()));
  const [box, setBox] = useState<TutorialSandbox | null>(() => (sandboxOn ? loadOrSeedTutorialSandbox() : null));

  useEffect(() => {
    if (active) setPatch(loadPractice());
  }, [active]);

  useEffect(() => {
    if (sandbox || isTutorialPracticeOn()) {
      const next = loadOrSeedTutorialSandbox();
      saveTutorialSandbox(next);
      setBox(next);
    }
  }, [sandbox]);

  const commit = useCallback((updater: (prev: PracticePatch) => PracticePatch) => {
    setPatch((prev) => {
      const next = updater(prev);
      savePractice(next);
      return next;
    });
  }, []);

  const commitBox = useCallback((updater: (prev: TutorialSandbox) => TutorialSandbox) => {
    setBox((prev) => {
      const base = prev ?? loadOrSeedTutorialSandbox();
      const next = updater(base);
      saveTutorialSandbox(next);
      return next;
    });
  }, []);

  const value = useMemo<PracticeContextValue>(() => {
    const usingSandbox = Boolean(box) && (sandbox || isTutorialPracticeOn());
    const live = usingSandbox || active;
    return {
      active: live,
      sandbox: usingSandbox,
      patch,
      sandboxDays: usingSandbox && box ? box.days : null,
      completed: box?.completed ?? {},
      setShare(householdId, shared) {
        commit((prev) => ({ ...prev, householdShare: { ...prev.householdShare, [householdId]: shared } }));
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            households: prev.households.map((house) => (house.id === householdId ? { ...house, sharedWithBochurim: shared } : house)),
            completed: { ...prev.completed, "contacts-share": true },
          }));
        }
      },
      setTags(householdId, tags) {
        commit((prev) => ({ ...prev, householdTags: { ...prev.householdTags, [householdId]: tags } }));
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            households: prev.households.map((house) => (house.id === householdId ? { ...house, tags } : house)),
            completed: { ...prev.completed, "contacts-remove": true },
          }));
        }
      },
      setPlannerVisible(dayId, visible) {
        commit((prev) => ({ ...prev, plannerVisible: { ...prev.plannerVisible, [dayId]: visible } }));
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            days: prev.days.map((day) => (day.id === dayId ? { ...day, visibleToBochurim: visible } : day)),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      setPlannerEditable(dayId, editable) {
        commit((prev) => ({ ...prev, plannerEditable: { ...prev.plannerEditable, [dayId]: editable } }));
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            days: prev.days.map((day) => (day.id === dayId ? { ...day, editableByBochurim: editable } : day)),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      setBochurChavrusa(bochurId, chavrusa) {
        commit((prev) => ({ ...prev, bochurChavrusa: { ...prev.bochurChavrusa, [bochurId]: chavrusa } }));
      },
      setPlannerDayChavrusa(dayId, chavrusa) {
        commit((prev) => ({ ...prev, plannerDayChavrusa: { ...prev.plannerDayChavrusa, [dayId]: chavrusa } }));
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            days: prev.days.map((day) => (day.id === dayId ? { ...day, chavrusa } : day)),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      setPlannerFilter(filter) {
        commit((prev) => ({ ...prev, plannerFilter: filter }));
      },
      setViewerChavrusa(chavrusa) {
        commit((prev) => ({ ...prev, viewerChavrusa: chavrusa }));
      },
      setPref(key, prefValue) {
        commit((prev) => {
          const next = { ...prev, [key]: prefValue };
          if (key === "bochurimSeePlannerDefault") {
            next.plannerVisibleAll = prefValue;
            next.plannerVisible = {};
          }
          if (key === "bochurimEditPlanner") {
            next.plannerEditableAll = prefValue;
            next.plannerEditable = {};
          }
          return next;
        });
        if (usingSandbox && (key === "bochurimSeePlannerDefault" || key === "bochurimEditPlanner")) {
          commitBox((prev) => ({
            ...prev,
            days: prev.days.map((day) =>
              key === "bochurimSeePlannerDefault"
                ? { ...day, visibleToBochurim: prefValue }
                : { ...day, editableByBochurim: prefValue },
            ),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      saveHousehold(input) {
        const existing = box?.households.find((house) => house.id === input.id);
        const saved = sandboxFromHouseholdInput(input, existing);
        if (usingSandbox) {
          commitBox((prev) => {
            const has = prev.households.some((house) => house.id === saved.id);
            return {
              ...prev,
              households: has ? prev.households.map((house) => (house.id === saved.id ? saved : house)) : [...prev.households, saved],
              completed: { ...prev.completed, "contacts-add": true },
            };
          });
        } else {
          commit((prev) => {
            const extras = (prev.addedHouseholds ?? []).filter((house) => house.id !== saved.id);
            return { ...prev, addedHouseholds: [...extras, saved] };
          });
        }
        return { ok: true as const, data: { id: saved.id } };
      },
      saveVisit(input) {
        const id = input.id || `sandbox-visit-${Date.now()}`;
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            households: prev.households.map((house) => (house.id === input.householdId ? applySandboxVisit(house, { ...input, id }) : house)),
            completed: { ...prev.completed, "visit-log": true },
          }));
        }
        return { ok: true as const, data: { id } };
      },
      recordSuggestion() {
        if (usingSandbox) {
          commitBox((prev) => ({ ...prev, suggestions: prev.suggestions + 1, completed: { ...prev.completed, "contacts-suggest": true } }));
        }
      },
      addPlannerDay(date, chavrusa = null) {
        if (usingSandbox) {
          const id = `sandbox-day-${Date.now()}`;
          commitBox((prev) => ({
            ...prev,
            days: [...prev.days, { id, date, visibleToBochurim: true, editableByBochurim: false, chavrusa: chavrusa ?? null, items: [] }].sort((a, b) => a.date.localeCompare(b.date)),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      removePlannerDay(dayId) {
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            days: prev.days.filter((day) => day.id !== dayId),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      addPlannerItem(input) {
        if (usingSandbox) {
          const id = `sandbox-item-${Date.now()}`;
          commitBox((prev) => ({
            ...prev,
            days: prev.days.map((day) =>
              day.id === input.dayId
                ? {
                    ...day,
                    items: [
                      ...day.items,
                      {
                        id,
                        dayId: day.id,
                        kind: input.kind,
                        routeId: input.routeId ?? null,
                        title: input.title ?? "",
                        time: input.time ?? null,
                        notes: input.notes ?? "",
                        address: input.address ?? "",
                        sort: day.items.length,
                      },
                    ],
                  }
                : day,
            ),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      updatePlannerItem(input) {
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            days: prev.days.map((day) => ({
              ...day,
              items: day.items.map((item) => (item.id === input.id ? { ...item, ...input } : item)),
            })),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      removePlannerItem(itemId) {
        if (usingSandbox) {
          commitBox((prev) => ({
            ...prev,
            days: prev.days.map((day) => ({ ...day, items: day.items.filter((item) => item.id !== itemId) })),
            completed: { ...prev.completed, planner: true },
          }));
        }
      },
      markDone(stepId) {
        if (usingSandbox) commitBox((prev) => ({ ...prev, completed: { ...prev.completed, [stepId]: true } }));
      },
      actionDone(stepId) {
        if (!box) return false;
        return tutorialActionDone(stepId, box);
      },
      reset() {
        clearPractice();
        setPatch(emptyPractice());
      },
      clearSandbox() {
        clearTutorialSandbox();
        setTutorialPracticeOn(false);
        setBox(null);
      },
      mergeData(data) {
        if (!live) return data;
        const base = usingSandbox && box ? applyTutorialSandbox(data, box) : data;
        return applyPractice(base, patch);
      },
      mergeDays(days, bochur, filter = "all") {
        const source = (usingSandbox && box ? box.days : days) as typeof days;
        return applyPracticeDays(source, patch, bochur, filter);
      },
    };
  }, [active, box, commit, commitBox, patch, sandbox]);

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  return ctx ?? noopFallback;
}
