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
  deleteRoutes,
  deleteCategory,
  deleteCustomField,
  applyUndo,
  deleteHouseholds,
  markContactsRemoved,
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
  saveOutreachTemplate,
  deleteOutreachTemplate,
  logOutreachSend,
  saveOutreachSender,
  deleteOutreachSender,
  saveOutreachTextSettings,
  saveDomainSender,
  deleteDomainSender,
  disconnectGmailAccount,
  sendOutreachEmail,
  // messaging imported separately

  savePreplannerEntry,
  confirmPreplannerVisit,
  deletePreplannerEntry,
  markPreplannerScheduled,
  setAccountApproval,
  saveCustomField,
  saveHousehold,
  saveMember,
  resendMemberInvite,
  saveOrganization,
  saveProject,
  saveRoute,
  saveVisit,
  setHouseholdCategories,
  setHouseholdSchedule,
} from "@/lib/repo";
import { assertNotPreview } from "@/lib/preview";
import { getAppData, getCurrentUser } from "@/lib/session";
import { geocodeMany, geocodeText } from "@/lib/geocode";
import { nearestNeighbor } from "@/lib/geo";
import {
  disconnectMessagingChannel,
  loadThreadMessages,
  markThreadRead,
  saveMessagingChannel,
  sendCampaignMessage,
} from "@/lib/messaging-repo";
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

async function requireWritable() {
  const gate = await assertNotPreview();
  if (!gate.ok) return gate;
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return { ok: true as const, user };
}

function refresh<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function signInAction(email: string, password: string) {
  return signInWithPassword(email, password);
}

export async function signUpAction(name: string, email: string, password: string, confirm: string, state?: string, project?: string) {
  return signUpWithPassword(name, email, password, confirm, state, project);
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
  leaderId?: string,
) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await setAccountApproval(user, id, decision, territory, leaderId));
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
    const writable = await requireWritable();
    if (!writable.ok) return writable;
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await saveHousehold(user, input));
  } catch (error) {
    return actionError(error, "Could not save the contact.");
  }
}

export async function deleteHouseholdsAction(ids: string[]) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteHouseholds(user, ids));
}

/** Tag contacts as Not Jewish / Probably doesn't exist (hides from main list). Does not hard-delete. */
export async function markContactsRemovedAction(ids: string[], reason: "not_jewish" | "doesnt_exist") {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await markContactsRemoved(user, ids, reason));
}

export async function undoAction(undo: UndoPayload) {
  try {
    const writable = await requireWritable();
    if (!writable.ok) return writable;
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await applyUndo(user, undo));
  } catch (error) {
    return actionError(error, "Could not undo that.");
  }
}

export async function mergeContactsAction(sourceId: string, targetId: string) {
  try {
    const writable = await requireWritable();
    if (!writable.ok) return writable;
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await mergeContacts(user, sourceId, targetId));
  } catch (error) {
    return actionError(error, "Could not merge those contacts.");
  }
}

export async function dismissDuplicateAction(id: string, otherId?: string | null) {
  try {
    const writable = await requireWritable();
    if (!writable.ok) return writable;
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await dismissDuplicate(user, id, otherId));
  } catch (error) {
    return actionError(error, "Could not clear that flag.");
  }
}

export async function setScheduleAction(householdId: string, scheduleCategoryId: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await setHouseholdSchedule(user, householdId, scheduleCategoryId));
}

export async function setCategoriesAction(householdId: string, categoryIds: string[]) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await setHouseholdCategories(user, householdId, categoryIds));
}

export async function importContactsAction(plan: ContactImport) {
  try {
    const writable = await requireWritable();
    if (!writable.ok) return writable;
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await importContacts(user, plan));
  } catch (error) {
    return actionError(error, "Import failed.");
  }
}

export async function importHouseholdsAction(rows: CsvHouseholdRow[]) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await importHouseholds(user, rows));
}

export async function saveVisitAction(input: VisitInput) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveVisit(user, input));
}

export async function deleteVisitAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteVisit(user, id));
}

export async function removeContactVisitAction(id: string) {
  try {
    const writable = await requireWritable();
    if (!writable.ok) return writable;
    const user = await actor();
    if (!user) return { ok: false as const, error: "Sign in again." };
    return refresh(await removeContactVisitFromContact(user, id));
  } catch (error) {
    return actionError(error, "Could not remove the visit.");
  }
}

export async function saveRouteAction(input: RouteInput) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveRoute(user, input));
}

export async function deleteRouteAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteRoute(user, id));
}

export async function deleteRoutesAction(ids: string[]) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteRoutes(user, ids));
}

export async function saveMemberAction(input: MemberInput) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveMember(user, input));
}

export async function deleteMemberAction(id: string, kind: "member" | "invite") {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteMember(user, id, kind));
}

export async function resendMemberInviteAction(id: string, kind: "member" | "invite") {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await resendMemberInvite(user, id, kind));
}

export async function saveOrganizationAction(input: OrgInput) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveOrganization(user, input));
}

export async function saveCategoryAction(input: CategoryInput) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveCategory(user, input));
}

export async function deleteCategoryAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteCategory(user, id));
}

export async function saveProjectAction(input: ProjectInput) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveProject(user, input));
}

export async function deleteProjectAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteProject(user, id));
}

export async function saveFieldAction(input: FieldInput) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveCustomField(user, input));
}

export async function deleteFieldAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
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
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await resetDemoData(user));
}

/** Map points for contacts with no saved coordinates. Looked up on the fly; nothing is saved. */
export async function geocodeContactsAction(ids: string[]) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;const data = await getAppData();
  if (!data) return { ok: false as const, error: "Sign in again." };
  const wanted = new Set(ids.slice(0, 40));
  const queries = data.households
    .filter((household) => wanted.has(household.id) && (household.lat == null || household.lng == null))
    .map((household) => ({ key: household.id, street: household.street, city: household.city, state: household.state, zip: household.zip }));
  return { ok: true as const, data: await geocodeMany(queries) };
}

/** Saves a new route from picked contacts, ordered nearest-first from the start point (looked-up points for contacts with no saved coordinates). */
export async function buildRouteAction(input: { name: string; projectId: string; householdIds: string[] }) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  const data = await getAppData();
  if (!data) return { ok: false as const, error: "Sign in again." };
  const wanted = new Set(input.householdIds);
  const picked = data.households.filter((household) => wanted.has(household.id));
  const lookups = await geocodeMany(
    picked
      .filter((household) => household.lat == null || household.lng == null)
      .map((household) => ({ key: household.id, street: household.street, city: household.city, state: household.state, zip: household.zip })),
  );
  const points = picked.map((household) => ({
    id: household.id,
    lat: household.lat ?? lookups[household.id]?.lat ?? null,
    lng: household.lng ?? lookups[household.id]?.lng ?? null,
  }));
  const start = data.org.startLat != null && data.org.startLng != null ? { lat: data.org.startLat, lng: data.org.startLng } : null;
  const ordered = nearestNeighbor(start, points);
  return refresh(await saveRoute(user, { name: input.name, projectId: input.projectId, optimized: true, householdIds: ordered }));
}

/** Finds a typed starting point for Start route. Nothing is saved. */
export async function geocodeStartAction(text: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  const point = await geocodeText(text);
  return point ? { ok: true as const, data: point } : { ok: false as const, error: "Couldn't find that address. Try adding the town and state." };
}

export async function saveOutreachTemplateAction(input: { id?: string; name: string; subject: string; email: string; sms: string }) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveOutreachTemplate(user, input));
}

export async function deleteOutreachTemplateAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteOutreachTemplate(user, id));
}

export async function logOutreachSendAction(input: {
  mode: string;
  templateId?: string;
  templateName?: string;
  subject: string;
  body: string;
  recipientCount: number;
  fromAddress?: string;
}) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return logOutreachSend(user, input);
}

export async function saveOutreachSenderAction(input: { id?: string; email: string; isGoogle?: boolean }) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveOutreachSender(user, input));
}

export async function deleteOutreachSenderAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteOutreachSender(user, id));
}

export async function saveOutreachTextSettingsAction(input: { textFrom: "sms" | "google_voice"; googleVoiceNumber?: string }) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveOutreachTextSettings(user, input));
}

export async function savePreplannerEntryAction(input: {
  id?: string;
  householdId: string;
  reachedDate: string;
  reachedTime: string;
  reachedHow: string | string[];
  followUpHow?: string;
  requestedDate?: string;
  requestedTime?: string;
  notes?: string;
  projectId?: string | null;
  stage?: string;
}) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await savePreplannerEntry(user, input));
}

export async function deletePreplannerEntryAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deletePreplannerEntry(user, id));
}

export async function markPreplannerScheduledAction(id: string, dayId: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await markPreplannerScheduled(user, id, dayId));
}

export async function confirmPreplannerVisitAction(input: { id: string; requestedDate: string; requestedTime: string; notes?: string }) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await confirmPreplannerVisit(user, input));
}

export async function saveDomainSenderAction(input: { id?: string; email: string; fromName: string }) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveDomainSender(user, input));
}

export async function deleteDomainSenderAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await deleteDomainSender(user, id));
}

export async function disconnectGmailAccountAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await disconnectGmailAccount(user, id));
}

export async function sendOutreachEmailAction(input: {
  method: "gmail" | "resend";
  fromAddress: string;
  fromName?: string;
  gmailAccountId?: string;
  to: string;
  subject: string;
  body: string;
  householdId?: string;
  personId?: string;
  templateId?: string;
  templateName?: string;
}) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await sendOutreachEmail(user, input));
}

export async function saveMessagingChannelAction(input: Parameters<typeof saveMessagingChannel>[1]) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await saveMessagingChannel(user, input));
}

export async function disconnectMessagingChannelAction(id: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await disconnectMessagingChannel(user, id));
}

export async function sendCampaignMessageAction(input: Parameters<typeof sendCampaignMessage>[1]) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await sendCampaignMessage(user, input));
}

export async function loadThreadMessagesAction(threadId: string) {
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return loadThreadMessages(user, threadId);
}

export async function markThreadReadAction(threadId: string) {
  const writable = await requireWritable();
  if (!writable.ok) return writable;
  const user = await actor();
  if (!user) return { ok: false as const, error: "Sign in again." };
  return refresh(await markThreadRead(user, threadId));
}
