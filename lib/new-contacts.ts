/**
 * "New contacts" on the dashboards counts only contacts added by hand after this moment
 * (the 1.8.18 release: Nov 4, 2026, 10:10 PM ET). Everything that already existed, and anything that comes in through
 * a spreadsheet import (now or later), is not a new contact.
 */
export const NEW_CONTACTS_SINCE = "2026-11-05T03:10:00Z";

export function isNewContact(contact: { createdAt: string; importBatchId?: string | null }) {
  return !contact.importBatchId && Date.parse(contact.createdAt) > Date.parse(NEW_CONTACTS_SINCE);
}
