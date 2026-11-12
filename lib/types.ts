import type { ExtraAddress } from "@/lib/extra-addresses";
export type { ExtraAddress };

export type Role = "admin" | "shliach" | "bochur" | "visitor" | "limited";
export type VisitStatus = "completed" | "deferred";
export type Reaction = "happy" | "warm" | "neutral" | "cold" | "not_interested";
export type HouseholdReaction = "very_happy" | "warm" | "neutral" | "cold" | "very_cold";
export type Gender = "him" | "her";
export type CategoryKind = "regular" | "scheduled";
export type FieldType = "text" | "number" | "date" | "select";
export type MemberStatus = "invited" | "pending" | "approved" | "rejected" | "disabled";
export type ApprovalDecision = "admin" | "shliach" | "bochur" | "reject" | "disable";

export interface Territory {
  state: string;
  area: string;
}
export type DueState = "none" | "upcoming" | "due" | "overdue";

export interface Organization {
  id: string;
  name: string;
  chabadHouseName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: number | null;
  lng: number | null;
  startLat: number | null;
  startLng: number | null;
  defaultState: string;
  planName: string;
  planLimit: number;
  planRenewsOn: string;
}

export interface User {
  id: string;
  orgId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: MemberStatus;
  expiresAt: string | null;
  canViewHistory: boolean;
  canViewContact: boolean;
  canEdit: boolean;
  assignedRouteIds: string[];
  leaderId: string | null;
  territory: Territory[];
  /** Public URL of his profile picture, if he set one. */
  avatarUrl?: string | null;
  theme?: string | null;
  backgroundUrl?: string | null;
  themeMatchPhoto?: boolean;
  themeColors?: Record<string, unknown> | null;
  shareNewWithBochurim?: boolean;
  bochurimEditPlanner?: boolean;
  /** Default for new planner days: whether bochurim can see them. */
  bochurimSeePlannerDefault?: boolean;
  projectId?: string | null;
  /** True while an admin is in Beta preview as this role. */
  previewing?: boolean;
  /** Bochur: step one (a Cora admin) and the final step (his shliach). */
  adminApprovedAt?: string | null;
  finalApprovedAt?: string | null;
  tutorialStep?: number;
  tutorialDone?: boolean;
  /** Bochur: Chavrusa A or B. Null means unassigned / shared planner only. */
  chavrusa?: "A" | "B" | null;
}

export interface Invite {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  expiresAt: string | null;
  canViewHistory: boolean;
  canViewContact: boolean;
  canEdit: boolean;
  assignedRouteIds: string[];
  territory: Territory[];
  acceptedAt: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
}

export interface Category {
  id: string;
  orgId: string;
  name: string;
  kind: CategoryKind;
  intervalDays: number | null;
}

export interface CustomFieldDef {
  id: string;
  orgId: string;
  name: string;
  fieldType: FieldType;
  options: string[];
}

export interface Person {
  id: string;
  householdId: string;
  name: string;
  gender: Gender | null;
  phone: string;
  phone2: string;
  phone3: string;
  email: string;
  whatsapp: string;
  sortOrder: number;
}

export interface Household {
  id: string;
  orgId: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: number | null;
  lng: number | null;
  extraAddresses?: ExtraAddress[];
  notes: string;
  projectId: string | null;
  scheduleCategoryId: string | null;
  categoryIds: string[];
  tags: string[];
  customFields: Record<string, string>;
  sharedWithCora: boolean;
  ownerId: string | null;
  /** Admin soft-delete. Live lists must omit these. */
  deletedAt?: string | null;
  deletedByShliachAt?: string | null;
  deletedByShliachBy?: string | null;
  visitReaction: HouseholdReaction | null;
  possibleDuplicate: boolean;
  duplicateOf: string | null;
  createdAt: string;
  /** Set when the contact came from a spreadsheet import. */
  importBatchId?: string | null;
  /** Who created the contact (auth user). */
  createdBy?: string | null;
}

export interface ContactVisit {
  id: string;
  orgId: string;
  householdId: string;
  visited: string;
  /** Free-text who visited, e.g. "Mendel Baitelman & Mendele Lustig". */
  visitedBy?: string | null;
  reaction: HouseholdReaction | null;
  notes: string;
  visitDate: string | null;
  /** null when the visit has no Completed/Deferred status stored. */
  status: "completed" | "deferred" | null;
  arrived: string;
  createdBy: string | null;
  createdAt: string;
  importBatchId: string | null;
  /** Built-in chips and write-ins, e.g. Tefillin, Menorah/package, custom text. */
  activities: string[];
  /** Project this visit belongs to (bochur edit/delete scope). */
  projectId?: string | null;
}

export interface Visit {
  id: string;
  orgId: string;
  householdId: string;
  visitorId: string | null;
  visitorName: string;
  visitDate: string;
  status: VisitStatus | null;
  reaction: Reaction | null;
  details: string;
  followUpDate: string | null;
  createdAt: string;
  projectId?: string | null;
}

export interface RouteStop {
  householdId: string;
  position: number;
}

export interface Route {
  id: string;
  orgId: string;
  name: string;
  projectId: string | null;
  optimized: boolean;
  createdBy: string | null;
  createdAt: string;
  stops: RouteStop[];
}

export interface AppNotification {
  id: string;
  orgId: string;
  title: string;
  body: string;
  createdAt: string;
  readBy: string[];
}

export interface Database {
  version: 1;
  organization: Organization;
  users: User[];
  invites: Invite[];
  projects: Project[];
  categories: Category[];
  customFields: CustomFieldDef[];
  households: Household[];
  people: Person[];
  visits: Visit[];
  contactVisits: ContactVisit[];
  contactVisitsReady: boolean;
  /** Pairs confirmed "not a duplicate", each as "lowId|highId". */
  notDuplicatePairs?: string[];
  removedVisitIds?: string[];
  contactShares?: { householdId: string; bochurId: string }[];
  routes: Route[];
  notifications: AppNotification[];
}

export interface Viewer {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  expiresAt: string | null;
  expired: boolean;
  canViewHistory: boolean;
  canViewContact: boolean;
  canEdit: boolean;
  canManage: boolean;
  canLogVisit: boolean;
  canCreateRoute: boolean;
  canDeleteRoute: boolean;
  canDeleteContacts: boolean;
  canImport: boolean;
  canExport: boolean;
  canOutreach: boolean;
  canShare: boolean;
  leaderId: string | null;
  territory: Territory[];
  avatarUrl: string | null;
  theme: string | null;
  backgroundUrl: string | null;
  themeMatchPhoto: boolean;
  themeColors: Record<string, unknown> | null;
  shareNewWithBochurim: boolean;
  bochurimEditPlanner: boolean;
  bochurimSeePlannerDefault: boolean;
  projectId: string | null;
  /** Set when a Cora admin is viewing the app as another role (Beta). */
  preview?: { role: "shliach" | "bochur"; state: string | null } | null;
  /** Tutorial practice sandbox is on. Writes are blocked; UI shows example data. */
  sandbox?: boolean;
  tutorialStep?: number;
  tutorialDone?: boolean;
  chavrusa?: "A" | "B" | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  expiresAt: string | null;
  canViewHistory: boolean;
  canViewContact: boolean;
  canEdit: boolean;
  assignedRouteIds: string[];
  leaderId: string | null;
  territory: Territory[];
  adminApprovedAt: string | null;
  finalApprovedAt: string | null;
  avatarUrl: string | null;
  projectId: string | null;
  kind: "member" | "invite";
  chavrusa?: "A" | "B" | null;
}

export interface HouseholdView {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: number | null;
  lng: number | null;
  extraAddresses: ExtraAddress[];
  notes: string;
  projectId: string | null;
  projectName: string | null;
  scheduleCategoryId: string | null;
  scheduleName: string;
  intervalDays: number | null;
  categoryIds: string[];
  categoryNames: string[];
  tags: string[];
  customFields: Record<string, string>;
  sharedWithCora: boolean;
  ownerId: string | null;
  deletedAt?: string | null;
  deletedByShliachAt: string | null;
  deletedByShliachBy: string | null;
  deletedByShliachName: string | null;
  sharedWithBochurim: boolean;
  visitReaction: HouseholdReaction | null;
  possibleDuplicate: boolean;
  duplicateOf: string | null;
  duplicateOfName: string | null;
  /** The contact the reason points at (duplicate_of, or the closest match when that is empty). */
  duplicateMatchId: string | null;
  /** Plain reason, e.g. "Same address and phone as". Worked out on load, not stored. */
  duplicateReason: string;
  /** May press "Not a duplicate" (admins, editors; a shliach only on his own contacts; never a bochur). */
  canMarkNotDuplicate: boolean;
  contactVisits: ContactVisitView[];
  latestVisited: string;
  latestReaction: HouseholdReaction | null;
  visitCount: number;
  createdAt: string;
  importBatchId: string | null;
  createdBy?: string | null;
  people: Person[];
  lastVisitAt: string | null;
  lastStatus: VisitStatus | null;
  nextDue: string | null;
  dueState: DueState;
  address: string;
}

export interface ContactVisitView {
  id: string;
  visited: string;
  visitedBy?: string | null;
  reaction: HouseholdReaction | null;
  notes: string;
  visitDate: string | null;
  /** null when the visit has no Completed/Deferred status stored. */
  status: "completed" | "deferred" | null;
  createdAt: string;
  /** Who logged it (null for imported history). */
  createdBy: string | null;
  canRemove: boolean;
  /** Bochur may edit/remove only when this matches his project. */
  projectId?: string | null;
  activities: string[];
}

export interface VisitView {
  id: string;
  householdId: string;
  householdName: string;
  visitorId: string | null;
  visitorName: string;
  visitDate: string;
  status: VisitStatus | null;
  reaction: Reaction | null;
  details: string;
  followUpDate: string | null;
  scheduleName: string;
  categoryNames: string[];
  projectName: string | null;
  createdAt: string;
}

export interface RouteStopView {
  householdId: string;
  position: number;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  phone: string;
}

export interface RouteView {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string;
  optimized: boolean;
  createdAt: string;
  stopCount: number;
  stops: RouteStopView[];
  miles: number | null;
}

export interface Stats {
  /** Counts of completed visits that include each activity label. */
  activityCounts?: { label: string; count: number }[];

  householdCount: number;
  householdsThisMonth: number;
  planLimit: number;
  visitsThisMonth: number;
  routeCount: number;
  optimizedRoutes: number;
  stopCount: number;
  teamCount: number;
  roleCounts: Record<Role, number>;
  activity: { label: string; count: number }[];
  reactions: Record<Reaction, number>;
  topCategories: { name: string; count: number }[];
  dueThisWeek: {
    id: string;
    name: string;
    schedule: string;
    overdue: boolean;
    nextDue: string | null;
  }[];
  recentVisits: {
    id: string;
    householdId: string;
    householdName: string;
    visitorName: string;
    status: VisitStatus | null;
    reaction: Reaction | null;
    visitDate: string;
    details: string;
  }[];
  checklist: {
    chabadHouse: boolean;
    startPoint: boolean;
    imported: boolean;
    route: boolean;
    visit: boolean;
  };
}

export interface AppNotificationView {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface AppData {
  mode: "demo" | "supabase";
  viewer: Viewer;
  org: Organization;
  members: TeamMember[];
  projects: Project[];
  categories: Category[];
  customFields: CustomFieldDef[];
  households: HouseholdView[];
  visits: VisitView[];
  routes: RouteView[];
  notifications: AppNotificationView[];
  stats: Stats;
}

export interface HouseholdInput {
  sharedWithBochurim?: boolean;
  id?: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: string;
  lng: string;
  extraAddresses?: ExtraAddress[];
  notes: string;
  projectId: string;
  scheduleCategoryId: string;
  categoryIds: string[];
  tags: string;
  customFields: Record<string, string>;
  sharedWithCora: boolean;
  ownerId: string;
  visitReaction: string;
  visits: {
    id?: string;
    visited: string;
    visitedBy?: string;
    status: string;
    reaction: string;
    notes: string;
    visitDate: string;
    activities?: string[];
  }[];
  people: {
    id?: string;
    name: string;
    gender: string;
    phone: string;
    phone2: string;
    phone3: string;
    email: string;
    whatsapp: string;
  }[];
}

export interface ImportedPerson {
  name: string;
  phone: string;
  email: string;
}

export interface ContactImport {
  visitedFallback: string;
  ownerId: string;
  sharedWithCora: boolean;
  rows: {
    name: string;
    phone: string;
    phone2: string;
    phone3: string;
    email: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    shareWithCora: boolean | null;
    tags: string;
    visited: string;
    status: string;
    reaction: string;
    notes: string;
    visitDate: string;
  }[];
}

export interface VisitInput {
  id?: string;
  householdId: string;
  visitDate: string;
  status: string;
  reaction: string;
  details: string;
  /** Season and Hebrew year, stored as "Summer 5786". Blank keeps the previous value on an edit. */
  visited?: string;
  /** Snapshot of who visited; auto-filled on insert when blank. */
  visitedBy?: string;
  activities?: string[];
}

export interface ContactSnapshot {
  household: Household;
  people: Person[];
  contactVisits: ContactVisit[];
  visits: Visit[];
}

export type UndoPayload =
  | { type: "delete-created"; householdIds: string[] }
  | { type: "restore-deleted"; householdIds: string[] }
  | { type: "restore-shliach-hidden"; householdIds: string[] }
  | { type: "reinsert"; snapshots: ContactSnapshot[] }
  | { type: "replace-contact"; snapshot: ContactSnapshot }
  | { type: "restore-visit"; visit: Visit; mode: "undelete" | "reinsert" }
  | { type: "replace-visit"; visit: Visit }
  | { type: "delete-visit"; id: string }
  | { type: "restore-contact-visit"; id: string; history?: boolean; log?: boolean }
  | { type: "restore-legacy-visit"; householdId: string; projectId: string | null; visitReaction: HouseholdReaction | null; notes: string }
  | { type: "import"; batchId: string; householdIds: string[]; visitIds: string[] }
  | { type: "flags"; id: string; possibleDuplicate: boolean; duplicateOf: string | null; pair?: [string, string] }
  | { type: "merge"; source: ContactSnapshot; target: ContactSnapshot };

export interface RouteInput {
  id?: string;
  name: string;
  projectId: string;
  optimized: boolean;
  householdIds: string[];
}

export interface MemberInput {
  id?: string;
  kind?: "member" | "invite";
  name: string;
  email: string;
  role: Role;
  expiresAt: string;
  canViewHistory: boolean;
  canViewContact: boolean;
  canEdit: boolean;
  assignedRouteIds: string[];
  territoryStates: string;
  territoryAreas: string;
}

export interface OrgInput {
  name: string;
  chabadHouseName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  defaultState: string;
  startLat: string;
  startLng: string;
  useHouseAsStart: boolean;
}

export interface CategoryInput {
  id?: string;
  name: string;
  kind: CategoryKind;
  intervalDays: string;
}

export interface ProjectInput {
  id?: string;
  name: string;
}

export interface FieldInput {
  id?: string;
  name: string;
  fieldType: FieldType;
  options: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; warning?: string; undo?: UndoPayload }
  | { ok: false; error: string };
