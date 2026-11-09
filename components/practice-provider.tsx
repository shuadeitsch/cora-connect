"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  applyPractice,
  clearPractice,
  emptyPractice,
  loadPractice,
  savePractice,
  type PracticePatch,
} from "@/lib/practice";
import type { AppData } from "@/lib/types";

type PracticeContextValue = {
  active: boolean;
  patch: PracticePatch;
  setShare: (householdId: string, shared: boolean) => void;
  setTags: (householdId: string, tags: string[]) => void;
  setPlannerVisible: (dayId: string, visible: boolean) => void;
  setPlannerEditable: (dayId: string, editable: boolean) => void;
  setPref: (key: "shareNewWithBochurim" | "bochurimEditPlanner" | "bochurimSeePlannerDefault", value: boolean) => void;
  reset: () => void;
  mergeData: (data: AppData) => AppData;
};

const PracticeContext = createContext<PracticeContextValue | null>(null);

export function PracticeProvider({ active, children }: { active: boolean; children: ReactNode }) {
  const [patch, setPatch] = useState<PracticePatch>(() => (active ? loadPractice() : emptyPractice()));

  const commit = useCallback((updater: (prev: PracticePatch) => PracticePatch) => {
    setPatch((prev) => {
      const next = updater(prev);
      savePractice(next);
      return next;
    });
  }, []);

  const value = useMemo<PracticeContextValue>(() => {
    return {
      active,
      patch,
      setShare(householdId, shared) {
        commit((prev) => ({ ...prev, householdShare: { ...prev.householdShare, [householdId]: shared } }));
      },
      setTags(householdId, tags) {
        commit((prev) => ({ ...prev, householdTags: { ...prev.householdTags, [householdId]: tags } }));
      },
      setPlannerVisible(dayId, visible) {
        commit((prev) => ({ ...prev, plannerVisible: { ...prev.plannerVisible, [dayId]: visible } }));
      },
      setPlannerEditable(dayId, editable) {
        commit((prev) => ({ ...prev, plannerEditable: { ...prev.plannerEditable, [dayId]: editable } }));
      },
      setPref(key, prefValue) {
        commit((prev) => ({ ...prev, [key]: prefValue }));
      },
      reset() {
        clearPractice();
        setPatch(emptyPractice());
      },
      mergeData(data) {
        if (!active) return data;
        return applyPractice(data, patch);
      },
    };
  }, [active, commit, patch]);

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) {
    return {
      active: false,
      patch: emptyPractice(),
      setShare: () => {},
      setTags: () => {},
      setPlannerVisible: () => {},
      setPlannerEditable: () => {},
      setPref: () => {},
      reset: () => {},
      mergeData: (data: AppData) => data,
    } satisfies PracticeContextValue;
  }
  return ctx;
}
