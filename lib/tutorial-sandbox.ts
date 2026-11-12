"use client";

import type { Chavrusa } from "@/lib/chavrusa";
import type { AppData, ContactVisitView, HouseholdInput, HouseholdView, VisitInput, VisitView } from "@/lib/types";

export const TUTORIAL_SANDBOX_KEY = "cora-tutorial-sandbox-v1";
export const TUTORIAL_PRACTICE_ON_KEY = "cora-tutorial-practice-on";
export const TUTORIAL_TOUR_ACTIVE_KEY = "cora-tutorial-tour-active";

export type SandboxItem = {
  id: string;
  dayId: string;
  kind: "route" | "event";
  routeId: string | null;
  title: string;
  time: string | null;
  notes: string;
  address: string;
  sort: number;
};

export type SandboxDay = {
  id: string;
  date: string;
  visibleToBochurim: boolean;
  editableByBochurim: boolean;
  chavrusa?: Chavrusa | null;
  items: SandboxItem[];
};

export type TutorialSandbox = {
  households: HouseholdView[];
  days: SandboxDay[];
  suggestions: number;
  completed: Record<string, boolean>;
};

function house(partial: Partial<HouseholdView> & Pick<HouseholdView, "id" | "name" | "street" | "city" | "state">): HouseholdView {
  const zip = partial.zip ?? "04101";
  const country = partial.country ?? "USA";
  const address = [partial.street, partial.city, partial.state, zip].filter(Boolean).join(", ");
  const people = partial.people ?? [
    {
      id: `${partial.id}-p`,
      householdId: partial.id,
      name: partial.name,
      gender: null,
      phone: "",
      phone2: "",
      phone3: "",
      email: "",
      whatsapp: "",
      sortOrder: 0,
    },
  ];
  return {
    id: partial.id,
    name: partial.name,
    street: partial.street,
    city: partial.city,
    state: partial.state,
    zip,
    country,
    lat: partial.lat ?? 43.6591,
    lng: partial.lng ?? -70.2568,
    notes: partial.notes ?? "",
    projectId: partial.projectId ?? null,
    projectName: partial.projectName ?? null,
    scheduleCategoryId: partial.scheduleCategoryId ?? null,
    scheduleName: partial.scheduleName ?? "None",
    intervalDays: partial.intervalDays ?? null,
    categoryIds: partial.categoryIds ?? [],
    categoryNames: partial.categoryNames ?? [],
    tags: partial.tags ?? [],
    customFields: partial.customFields ?? {},
    sharedWithCora: partial.sharedWithCora ?? true,
    ownerId: partial.ownerId ?? null,
    deletedAt: partial.deletedAt ?? null,
    deletedByShliachAt: partial.deletedByShliachAt ?? null,
    deletedByShliachBy: partial.deletedByShliachBy ?? null,
    deletedByShliachName: partial.deletedByShliachName ?? null,
    sharedWithBochurim: partial.sharedWithBochurim !== false,
    visitReaction: partial.visitReaction ?? null,
    possibleDuplicate: partial.possibleDuplicate ?? false,
    duplicateOf: partial.duplicateOf ?? null,
    duplicateOfName: partial.duplicateOfName ?? null,
    duplicateMatchId: partial.duplicateMatchId ?? null,
    canMarkNotDuplicate: false,
    duplicateReason: "",
    contactVisits: partial.contactVisits ?? [],
    latestVisited: partial.latestVisited ?? "",
    latestReaction: partial.latestReaction ?? null,
    visitCount: partial.contactVisits?.length ?? 0,
    createdAt: partial.createdAt ?? "2026-06-01T00:00:00.000Z",
    importBatchId: null,
    createdBy: null,
    people,
    lastVisitAt: partial.lastVisitAt ?? null,
    lastStatus: partial.lastStatus ?? null,
    nextDue: null,
    dueState: "none",
    address,
  };
}

const SEED_VISIT: ContactVisitView = {
  id: "sandbox-visit-jordan",
  visited: "Summer 5786",
  visitedBy: "Mendy Example & Shmuel Example",
  reaction: "warm",
  notes: "Example visit for practice.",
  visitDate: "2026-07-15",
  status: "completed",
  createdAt: "2026-07-15T16:00:00.000Z",
  createdBy: null,
  canRemove: true,
  projectId: null,
  activities: ["Tefillin"],
};

export function seedTutorialSandbox(): TutorialSandbox {
  return {
    households: [
      house({
        id: "sandbox-alex",
        name: "Alex Example",
        street: "12 Maple Street",
        city: "Portland",
        state: "ME",
        sharedWithBochurim: true,
      }),
      house({
        id: "sandbox-jordan",
        name: "Jordan Example",
        street: "44 Oak Avenue",
        city: "Portland",
        state: "ME",
        zip: "04102",
        sharedWithBochurim: true,
        contactVisits: [SEED_VISIT],
        latestVisited: "Summer 5786",
        latestReaction: "warm",
        lastVisitAt: "2026-07-15",
        lastStatus: "completed",
        lat: 43.662,
        lng: -70.26,
      }),
      house({
        id: "sandbox-sam",
        name: "Sam Example",
        street: "9 Pine Court",
        city: "South Portland",
        state: "ME",
        zip: "04106",
        sharedWithBochurim: false,
        lat: 43.641,
        lng: -70.241,
      }),
    ],
    days: [
      {
        id: "sandbox-day-1",
        date: "2026-11-11",
        visibleToBochurim: true,
        chavrusa: null,
        editableByBochurim: true,
        items: [
          {
            id: "sandbox-item-1",
            dayId: "sandbox-day-1",
            kind: "event",
            routeId: null,
            title: "Morning visits — example",
            time: "10:00",
            notes: "Practice only.",
            address: "12 Maple Street, Portland, ME",
            sort: 0,
          },
        ],
      },
      {
        id: "sandbox-day-2",
        date: "2026-11-12",
        visibleToBochurim: false,
        chavrusa: null,
        editableByBochurim: false,
        items: [
          {
            id: "sandbox-item-2",
            dayId: "sandbox-day-2",
            kind: "event",
            routeId: null,
            title: "Hidden practice day",
            time: "14:00",
            notes: "",
            address: "",
            sort: 0,
          },
        ],
      },
    ],
    suggestions: 0,
    completed: {},
  };
}

export function emptySandbox(): TutorialSandbox {
  return { households: [], days: [], suggestions: 0, completed: {} };
}

export function isTutorialPracticeOn(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(TUTORIAL_PRACTICE_ON_KEY) === "1";
}

export function setTutorialPracticeOn(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.sessionStorage.setItem(TUTORIAL_PRACTICE_ON_KEY, "1");
  else window.sessionStorage.removeItem(TUTORIAL_PRACTICE_ON_KEY);
}

export function isTutorialTourActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(TUTORIAL_TOUR_ACTIVE_KEY) === "1";
}

export function setTutorialTourActive(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.sessionStorage.setItem(TUTORIAL_TOUR_ACTIVE_KEY, "1");
  else window.sessionStorage.removeItem(TUTORIAL_TOUR_ACTIVE_KEY);
}

export function loadTutorialSandbox(): TutorialSandbox | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(TUTORIAL_SANDBOX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TutorialSandbox;
    if (!Array.isArray(parsed.households) || !Array.isArray(parsed.days)) return null;
    return {
      households: parsed.households,
      days: parsed.days,
      suggestions: Number(parsed.suggestions ?? 0),
      completed: parsed.completed ?? {},
    };
  } catch {
    return null;
  }
}

export function saveTutorialSandbox(state: TutorialSandbox) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TUTORIAL_SANDBOX_KEY, JSON.stringify(state));
}

export function clearTutorialSandbox() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TUTORIAL_SANDBOX_KEY);
  window.sessionStorage.removeItem(TUTORIAL_PRACTICE_ON_KEY);
}

export function loadOrSeedTutorialSandbox(): TutorialSandbox {
  return loadTutorialSandbox() ?? seedTutorialSandbox();
}

export function newSandboxId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `sandbox-${crypto.randomUUID()}`;
  return `sandbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function applyTutorialSandbox(data: AppData, state: TutorialSandbox): AppData {
  const bochur = data.viewer.role === "bochur";
  const households = bochur
    ? state.households.filter((house) => house.sharedWithBochurim !== false)
    : state.households;
  const visits: VisitView[] = [];
  for (const house of households) {
    for (const cv of house.contactVisits ?? []) {
      visits.push({
        id: cv.id,
        householdId: house.id,
        householdName: house.name,
        visitorId: cv.createdBy,
        visitorName: cv.visitedBy ?? "",
        visitDate: cv.visitDate ?? "",
        status: cv.status,
        reaction: (cv.reaction as VisitView["reaction"]) ?? null,
        details: cv.notes,
        followUpDate: null,
        scheduleName: house.scheduleName,
        categoryNames: house.categoryNames,
        projectName: house.projectName,
        createdAt: cv.createdAt,
      });
    }
  }
  visits.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  return { ...data, households, visits };
}

export function sandboxFromHouseholdInput(input: HouseholdInput, existing?: HouseholdView): HouseholdView {
  const id = input.id || existing?.id || newSandboxId();
  const person = input.people[0];
  const name = input.name.trim() || person?.name.trim() || "New contact";
  return house({
    ...(existing ?? {}),
    id,
    name,
    street: input.street,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country || "USA",
    lat: input.lat ? Number(input.lat) : existing?.lat ?? null,
    lng: input.lng ? Number(input.lng) : existing?.lng ?? null,
    notes: input.notes,
    projectId: input.projectId || null,
    tags: input.tags ? input.tags.split(",").map((item) => item.trim()).filter(Boolean) : existing?.tags ?? [],
    sharedWithCora: Boolean(input.sharedWithCora),
    sharedWithBochurim: input.sharedWithBochurim ?? existing?.sharedWithBochurim ?? true,
    people: [
      {
        id: person?.id || `${id}-p`,
        householdId: id,
        name,
        gender: null,
        phone: person?.phone ?? "",
        phone2: person?.phone2 ?? "",
        phone3: person?.phone3 ?? "",
        email: person?.email ?? "",
        whatsapp: person?.whatsapp ?? person?.phone ?? "",
        sortOrder: 0,
      },
    ],
    address: [input.street, input.city, input.state, input.zip].filter(Boolean).join(", "),
  });
}

export function applySandboxVisit(house: HouseholdView, input: VisitInput): HouseholdView {
  const id = input.id || newSandboxId();
  const visitDate = input.visitDate || new Date().toISOString().slice(0, 10);
  const status = input.status === "deferred" ? "deferred" : input.status === "completed" ? "completed" : null;
  const visit: ContactVisitView = {
    id,
    visited: input.visited ?? "",
    visitedBy: input.visitedBy ?? "",
    reaction: (input.reaction || null) as ContactVisitView["reaction"],
    notes: input.details ?? "",
    visitDate,
    status,
    createdAt: new Date().toISOString(),
    createdBy: null,
    canRemove: true,
    projectId: house.projectId,
    activities: input.activities ?? [],
  };
  const rest = (house.contactVisits ?? []).filter((item) => item.id !== id);
  const contactVisits = [visit, ...rest].sort((a, b) => (b.visitDate ?? "").localeCompare(a.visitDate ?? ""));
  const latest = contactVisits[0];
  return {
    ...house,
    contactVisits,
    visitCount: contactVisits.length,
    latestVisited: latest?.visited ?? "",
    latestReaction: latest?.reaction ?? null,
    lastVisitAt: latest?.visitDate ?? null,
    lastStatus: latest?.status ?? null,
  };
}

const SEED_IDS = new Set(seedTutorialSandbox().households.map((house) => house.id));
const SEED_BY_ID = new Map(seedTutorialSandbox().households.map((house) => [house.id, house]));

export function tutorialActionDone(stepId: string, state: TutorialSandbox): boolean {
  if (state.completed[stepId]) return true;
  if (stepId === "contacts-add") return state.households.some((house) => !SEED_IDS.has(house.id));
  if (stepId === "visit-log") {
    return state.households.some((house) => {
      const seedLen = SEED_BY_ID.get(house.id)?.contactVisits.length ?? 0;
      return (house.contactVisits?.length ?? 0) > seedLen;
    });
  }
  if (stepId === "contacts-share") {
    return state.households.some((house) => {
      const seed = SEED_BY_ID.get(house.id);
      return seed && seed.sharedWithBochurim !== house.sharedWithBochurim;
    });
  }
  if (stepId === "contacts-remove") {
    return state.households.some((house) => (house.tags ?? []).length > 0) || state.households.length < SEED_IDS.size;
  }
  if (stepId === "contacts-suggest") return state.suggestions > 0;
  if (stepId === "planner") {
    const seed = seedTutorialSandbox();
    if (state.days.length !== seed.days.length) return true;
    return state.days.some((day, index) => {
      const start = seed.days[index];
      if (!start) return true;
      return (
        day.visibleToBochurim !== start.visibleToBochurim ||
        day.editableByBochurim !== start.editableByBochurim ||
        day.items.length !== start.items.length
      );
    });
  }
  return false;
}
