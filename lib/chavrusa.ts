import type { TeamMember } from "@/lib/types";

export type Chavrusa = "A" | "B";
export type PlannerChavrusaFilter = "all" | "shared" | "A" | "B";

export const CHAVRUSA_MIN_BOCHURIM = 4;

export const PRACTICE_BOCHURIM: Omit<TeamMember, "leaderId">[] = [
  { id: "practice-bochur-1", name: "Ari Example", email: "ari.example@invalid.cora", role: "bochur", status: "approved", expiresAt: null, canViewHistory: true, canViewContact: true, canEdit: false, assignedRouteIds: [], territory: [], adminApprovedAt: "2026-01-01", finalApprovedAt: "2026-01-01", avatarUrl: null, projectId: null, kind: "member", chavrusa: null },
  { id: "practice-bochur-2", name: "Dovid Example", email: "dovid.example@invalid.cora", role: "bochur", status: "approved", expiresAt: null, canViewHistory: true, canViewContact: true, canEdit: false, assignedRouteIds: [], territory: [], adminApprovedAt: "2026-01-01", finalApprovedAt: "2026-01-01", avatarUrl: null, projectId: null, kind: "member", chavrusa: null },
  { id: "practice-bochur-3", name: "Levi Example", email: "levi.example@invalid.cora", role: "bochur", status: "approved", expiresAt: null, canViewHistory: true, canViewContact: true, canEdit: false, assignedRouteIds: [], territory: [], adminApprovedAt: "2026-01-01", finalApprovedAt: "2026-01-01", avatarUrl: null, projectId: null, kind: "member", chavrusa: null },
  { id: "practice-bochur-4", name: "Shmuel Example", email: "shmuel.example@invalid.cora", role: "bochur", status: "approved", expiresAt: null, canViewHistory: true, canViewContact: true, canEdit: false, assignedRouteIds: [], territory: [], adminApprovedAt: "2026-01-01", finalApprovedAt: "2026-01-01", avatarUrl: null, projectId: null, kind: "member", chavrusa: null },
];

export function parseChavrusa(value: unknown): Chavrusa | null {
  return value === "A" || value === "B" ? value : null;
}

export function chavrusaLabel(value: Chavrusa | null | undefined, empty = "Shared"): string {
  if (value === "A") return "Chavrusa A";
  if (value === "B") return "Chavrusa B";
  return empty;
}

/** Bochur: shared + his group. Shliach/admin filter: all, shared-only, or a group plus shared. */
export function dayMatchesChavrusa(
  day: { chavrusa?: Chavrusa | null },
  filter: PlannerChavrusaFilter,
  bochurChavrusa?: Chavrusa | null,
  isBochur?: boolean,
): boolean {
  if (isBochur) return !day.chavrusa || day.chavrusa === (bochurChavrusa ?? null);
  if (filter === "all") return true;
  if (filter === "shared") return !day.chavrusa;
  return !day.chavrusa || day.chavrusa === filter;
}

export function showChavrusosUi(bochurCount: number, practiceActive: boolean, hasAssignments = false) {
  return practiceActive || bochurCount >= CHAVRUSA_MIN_BOCHURIM || hasAssignments;
}

export function newDayChavrusa(filter: PlannerChavrusaFilter): Chavrusa | null {
  return filter === "A" || filter === "B" ? filter : null;
}
