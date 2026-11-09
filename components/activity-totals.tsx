"use client";

import { useMemo } from "react";
import { activityCountsFor } from "@/lib/visit-activities";
import type { AppData } from "@/lib/types";

/** Visit activity totals. Filters come from the shared Dashboard bar. */
export function ActivityTotals({
  data,
  projectId = "ALL",
  state = "ALL",
}: {
  data: AppData;
  projectId?: string;
  state?: string;
}) {
  const viewer = data.viewer;

  const rows = useMemo(() => {
    const visits = data.households.flatMap((h) =>
      h.contactVisits.map((v) => ({
        id: v.id,
        orgId: data.viewer.orgId,
        householdId: h.id,
        visited: v.visited,
        reaction: v.reaction,
        notes: v.notes,
        visitDate: v.visitDate,
        status: v.status,
        arrived: "",
        createdBy: v.createdBy,
        createdAt: v.createdAt,
        importBatchId: null,
        activities: v.activities ?? [],
        projectId: v.projectId ?? null,
      })),
    );
    const households = data.households.map((h) => ({
      id: h.id,
      orgId: data.viewer.orgId,
      name: h.name,
      street: h.street,
      city: h.city,
      state: h.state,
      zip: h.zip,
      country: h.country,
      lat: h.lat,
      lng: h.lng,
      notes: h.notes,
      projectId: h.projectId,
      scheduleCategoryId: h.scheduleCategoryId,
      categoryIds: h.categoryIds,
      tags: h.tags,
      customFields: h.customFields,
      sharedWithCora: h.sharedWithCora,
      ownerId: h.ownerId,
      visitReaction: h.visitReaction,
      possibleDuplicate: h.possibleDuplicate,
      duplicateOf: h.duplicateOf,
      createdAt: h.createdAt,
      importBatchId: h.importBatchId,
      deletedByShliachAt: h.deletedByShliachAt,
      deletedByShliachBy: h.deletedByShliachBy,
    }));
    return activityCountsFor(
      visits,
      households as never,
      {
        id: viewer.id,
        orgId: viewer.orgId,
        name: viewer.name,
        email: viewer.email,
        passwordHash: "",
        role: viewer.role,
        status: viewer.status,
        expiresAt: viewer.expiresAt,
        canViewHistory: viewer.canViewHistory,
        canViewContact: viewer.canViewContact,
        canEdit: viewer.canEdit,
        assignedRouteIds: [],
        leaderId: viewer.leaderId,
        territory: viewer.territory,
        projectId: viewer.projectId,
      },
      { state, projectId },
    );
  }, [data.households, data.viewer, projectId, state, viewer]);

  const line = rows.length ? rows.map((r) => `${r.count} ${r.label}`).join(" · ") : "No activities logged yet.";

  return (
    <section className="panel rounded-3xl p-4" aria-label="Visit activities">
      <h2 className="font-heading text-xl font-semibold text-foreground">Visit activities</h2>
      <p className="mt-3 text-sm text-foreground">{line}</p>
    </section>
  );
}
