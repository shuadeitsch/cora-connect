"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  changePassword,
  sendMagicLink,
  sendPasswordReset,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  startGoogleSignIn,
} from "@/lib/auth";
import {
  deleteAllRoutes,
  deleteCategory,
  deleteCustomField,
  applyUndo,
  deleteHouseholds,
  dismissDuplicate,
  deleteMember,
  deleteProject,
  deleteRoute,
  deleteVisit,
  removeContactVisitFromContact,
  importContacts,
  importHouseholds,
  mergeContacts,
  readNotifications,
  resetDemoData,
  saveCategory,
  setAccountApproval,
  saveCustomField,
  saveHousehold,
  saveMember,
  saveOrganization,
  saveProject,
  saveRoute,
  saveVisit,
  setHouseholdCategories,
  setHouseholdSchedule,
} from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";
import type {
  ActionResult,
  ApprovalDecision,
  ContactImport,
  CategoryInput,
  FieldInput,
  HouseholdInput,
  MemberInput,
  OrgInput,
  ProjectInput,
  RouteInput,
  UndoPayload,
  VisitInput,
} from "@/lib/types";
import type { CsvHouseholdRow } from "@/lib/csv";

async function actor() {
  return getCurrentUser();
}

function refresh<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function signInAction(email: string, password: string) {
  return signInWithPassword(email, password);
}

export async function signUpAction(name: string, email: string, password: string, confirm: string) {
  return signUpWithPassword(name, email, password, confirm);
}

export async function sendPasswordResetAction(email: string) {
  return sendPasswordReset(email);
}

export async function changePasswordAction(current: string, next: string, confirm: string) {
  return changePassword(current, next, confirm);
}

export async function sendMagicLinkAction(email: string) {
  return sendMagicLink(email);
}

export async function setAccountApprovalAction(
  id: string,
  decision: ApprovalDecision,
  territory?: { states: string[]; areas: string[] },
) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await setAccountApproval(user, id, decision, territory));
}

export async function googleSignInAction() {
  const result = await startGoogleSignIn();
  if (!result.ok) redirect(`/login?error=${encodeURIComponent(result.error)}`);
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}

function actionError(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message ? error.message : fallback;
  return { ok: false as const, error: message };
}

export async function saveHouseholdAction(input: HouseholdInput) {
  try {
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await saveHousehold(user, input));
  } catch (error) {
    return actionError(error, "Could not save the contact.");
  }
}

export async function deleteHouseholdsAction(ids: string[]) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteHouseholds(user, ids));
}

export async function undoAction(undo: UndoPayload) {
  try {
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await applyUndo(user, undo));
  } catch (error) {
    return actionError(error, "Could not undo that.");
  }
}

export async function mergeContactsAction(sourceId: string, targetId: string) {
  try {
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await mergeContacts(user, sourceId, targetId));
  } catch (error) {
    return actionError(error, "Could not merge those contacts.");
  }
}

export async function dismissDuplicateAction(id: string) {
  try {
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await dismissDuplicate(user, id));
  } catch (error) {
    return actionError(error, "Could not clear that flag.");
  }
}

export async function setScheduleAction(householdId: string, scheduleCategoryId: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await setHouseholdSchedule(user, householdId, scheduleCategoryId));
}

export async function setCategoriesAction(householdId: string, categoryIds: string[]) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await setHouseholdCategories(user, householdId, categoryIds));
}

export async function importContactsAction(plan: ContactImport) {
  try {
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await importContacts(user, plan));
  } catch (error) {
    return actionError(error, "Import failed.");
  }
}

export async function importHouseholdsAction(rows: CsvHouseholdRow[]) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await importHouseholds(user, rows));
}

export async function saveVisitAction(input: VisitInput) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveVisit(user, input));
}

export async function deleteVisitAction(id: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteVisit(user, id));
}

export async function removeContactVisitAction(id: string) {
  try {
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await removeContactVisitFromContact(user, id));
  } catch (error) {
    return actionError(error, "Could not remove the visit.");
  }
}

export async function saveRouteAction(input: RouteInput) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveRoute(user, input));
}

export async function deleteRouteAction(id: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteRoute(user, id));
}

export async function deleteAllRoutesAction() {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteAllRoutes(user));
}

export async function saveMemberAction(input: MemberInput) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveMember(user, input));
}

export async function deleteMemberAction(id: string, kind: "member" | "invite") {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteMember(user, id, kind));
}

export async function saveOrganizationAction(input: OrgInput) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveOrganization(user, input));
}

export async function saveCategoryAction(input: CategoryInput) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveCategory(user, input));
}

export async function deleteCategoryAction(id: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteCategory(user, id));
}

export async function saveProjectAction(input: ProjectInput) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveProject(user, input));
}

export async function deleteProjectAction(id: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteProject(user, id));
}

export async function saveFieldAction(input: FieldInput) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveCustomField(user, input));
}

export async function deleteFieldAction(id: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteCustomField(user, id));
}

export async function readNotificationsAction() {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await readNotifications(user));
}

export async function resetDemoAction() {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await resetDemoData(user));
}
