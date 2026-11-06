"use client";

import { useMemo, useState } from "react";
import { FOCUS_STATES } from "@/lib/constants";
import { activityCountsFor } from "@/lib/visit-activities";
import type { AppData } from "@/lib/types";

const STATES = FOCUS_STATES.filter((item) => item.code !== "Unsorted");

export function ActivityTotals({ data }: { data: AppData }) {
  const admin = data.viewer.role === "admin" && !data.viewer.preview;
  const [state, setState] = useState("ALL");
  const [projectId, setProjectId] = useState("ALL");
  const viewer = data.viewer;

  const rows = useMemo(() => {
    // Rebuild ContactVisit-like list from household contactVisits for scoping.
    const visits = data.households.flatMap((h) => h.contactVisits.map((v) => ({
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
    })));
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
      admin ? { state, projectId } : viewer.role === "bochur" && viewer.projectId ? { projectId: viewer.projectId } : undefined,
    );
  }, [admin, data.households, data.viewer, projectId, state, viewer]);

  const line = rows.length ? rows.map((r) => `${r.count} ${r.label}`).join(" · ") : "No activities logged yet.";

  return (
    <section className="panel rounded-3xl p-4" aria-label="Visit activities">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">Visit activities</h2>
        {admin ? (
          <div className="flex flex-wrap gap-2">
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={state} onChange={(e) => setState(e.target.value)} aria-label="State filter">
              <option value="ALL">All states</option>
              {STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
            <select className="h-9 rounded-lg border bg-background px-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project filter">
              <option value="ALL">All projects</option>
              {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-foreground">{line}</p>
    </section>
  );
}
