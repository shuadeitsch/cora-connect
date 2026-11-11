"use client";

import { Avatar } from "@/components/avatar";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { approveBochurAction, disableBochurAction, extendBochurAction, setBochurShliachAction } from "@/lib/bochur-actions";
import { setBochurChavrusaAction } from "@/lib/chavrusa-actions";
import { CHAVRUSA_MIN_BOCHURIM, showChavrusosUi, type Chavrusa } from "@/lib/chavrusa";
import { usePractice } from "@/components/practice-provider";
import { useToast } from "@/components/toast";
import { setBochurProjectAction } from "@/lib/shliach-prefs-actions";
import { formatMedium } from "@/lib/format";
import type { AppData, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Badge = { label: string; className: string };

function badgeOf(member: TeamMember, today: string): Badge {
  if (member.status === "pending") {
    return {
      label: member.adminApprovedAt ? "Pending your approval" : "Pending",
      className: "bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-100",
    };
  }
  if (member.status === "disabled") return { label: "Disabled", className: "bg-muted text-muted-foreground ring-border" };
  if (member.status !== "approved") return { label: member.status, className: "bg-muted text-muted-foreground ring-border" };
  if (member.expiresAt && member.expiresAt.slice(0, 10) < today) {
    return { label: `Expired ${formatMedium(member.expiresAt)}`, className: "bg-red-500/10 text-red-800 ring-red-500/30 dark:text-red-200" };
  }
  return {
    label: member.expiresAt ? `Active · until ${formatMedium(member.expiresAt)}` : "Active",
    className: "bg-emerald-500/15 text-emerald-900 ring-emerald-500/30 dark:text-emerald-100",
  };
}

/** Participating bochurim: approve (after a Cora admin), extend a month, or disable. Admins see every bochur. */
export function BochurimPanel({ data }: { data: AppData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();
  const admin = data.viewer.canManage;
  const mine = data.members.filter((member) => member.kind === "member" && member.role === "bochur" && (admin || member.leaderId === data.viewer.id));
  if (data.viewer.role !== "shliach" && !admin) return null;
  const shluchim = data.members.filter((member) => member.kind === "member" && member.role === "shliach").sort((a, b) => a.name.localeCompare(b.name));
  const order = (member: TeamMember) => (member.status === "pending" ? 0 : member.status === "approved" && !(member.expiresAt && member.expiresAt.slice(0, 10) < todayIso()) ? 1 : 2);
  mine.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  const today = todayIso();

  function run(id: string, task: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    setBusy(id);
    start(async () => {
      const result = await task();
      setBusy("");
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  return (
    <>
    <section className="panel mb-4 rounded-3xl p-4 ring-1 ring-primary/20" aria-label="Participating bochurim">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">Participating bochurim</h2>
        <span className="text-xs text-muted-foreground">{mine.length} {mine.length === 1 ? "bochur" : "bochurim"}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{admin ? "Every bochur on this account, and which shliach he is under." : "Bochurim under you. Approve them after a Cora Connect admin does, then extend or disable."}</p>
      {error ? <div className="my-2"><Notice>{error}</Notice></div> : null}
      {mine.length ? (
        <ul className="mt-3 divide-y">
          {mine.map((member) => {
            const leader = data.members.find((item) => item.id === member.leaderId);
            const waiting = member.status === "pending" && Boolean(member.adminApprovedAt);
            const canAct = admin || member.leaderId === data.viewer.id;
            const badge = badgeOf(member, today);
            return (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar name={member.name} src={member.avatarUrl} className="mt-0.5 size-10 text-xs" />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Shliach: {leader?.name ?? (admin ? "Not set" : "you")}
                      {member.expiresAt && badge.label.startsWith("Active") ? "" : ""}
                    </p>
                    <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", badge.className)}>{badge.label}</span>
                    {admin ? (
                      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        Assign shliach
                        <select
                          aria-label={`Shliach for ${member.name}`}
                          className="h-9 max-w-[14rem] min-w-0 rounded-lg border bg-background px-2 text-sm text-foreground"
                          value={member.leaderId ?? ""}
                          disabled={busy === member.id}
                          onChange={(event) => { const next = event.target.value; if (next) run(member.id, () => setBochurShliachAction(member.id, next)); }}
                        >
                          {!leader ? <option value="">No shliach set</option> : null}
                          {shluchim.map((shliach) => <option key={shliach.id} value={shliach.id}>{shliach.name}</option>)}
                        </select>
                    <select
                      aria-label="Project"
                      className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-2 text-sm"
                      value={member.projectId ?? ""}
                      disabled={busy === member.id}
                      onChange={(event) => run(member.id, () => setBochurProjectAction(member.id, event.target.value))}
                    >
                      <option value="">No project</option>
                      {data.projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                      </label>
                    ) : null}
                  </div>
                </div>
                {canAct ? (
                  <div className="flex flex-wrap gap-1.5">
                    {waiting && !admin ? (
                      <Button type="button" className="min-h-11 rounded-full px-4" disabled={busy === member.id} onClick={() => run(member.id, () => approveBochurAction(member.id))}>Approve</Button>
                    ) : null}
                    {member.finalApprovedAt ? (
                      <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" disabled={busy === member.id} onClick={() => run(member.id, () => extendBochurAction(member.id))}>
                        {member.status === "approved" ? "Extend 1 month" : "Turn on for 1 month"}
                      </Button>
                    ) : null}
                    {member.status === "approved" ? (
                      <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 text-red-700 dark:text-red-300" disabled={busy === member.id} onClick={() => run(member.id, () => disableBochurAction(member.id))}>Disable</Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">No bochurim yet.{admin ? "" : " When a Cora Connect admin approves a bochur for you, he shows up here for your approval."}</p>
      )}
    </section>
    <ChavrusosSection data={data} />
    </>
  );
}

function ChavrusosSection({ data }: { data: AppData }) {
  const practice = usePractice();
  const toast = useToast();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();
  const live = practice.mergeData(data);
  const shliach = live.viewer.role === "shliach";
  if (!shliach && !live.viewer.canManage) return null;
  const mine = live.members.filter((member) => member.kind === "member" && member.role === "bochur" && (shliach ? member.leaderId === live.viewer.id : true));
  const hasAssignments = mine.some((member) => member.chavrusa);
  if (!showChavrusosUi(mine.length, practice.active && shliach, hasAssignments)) return null;
  const groups: Record<"A" | "B" | "none", TeamMember[]> = { A: [], B: [], none: [] };
  for (const member of mine) {
    if (member.chavrusa === "A" || member.chavrusa === "B") groups[member.chavrusa].push(member);
    else groups.none.push(member);
  }

  function assign(id: string, chavrusa: Chavrusa | null) {
    setError("");
    setBusy(id);
    if (practice.active) {
      practice.setBochurChavrusa(id, chavrusa);
      setBusy("");
      toast({ title: "Saved in practice mode" });
      return;
    }
    start(async () => {
      const result = await setBochurChavrusaAction(id, chavrusa);
      setBusy("");
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <section className="panel mb-4 rounded-3xl p-4 ring-1 ring-primary/20" aria-label="Chavrusos">
      <h2 className="font-heading text-xl font-semibold text-foreground">Chavrusos</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Split your bochurim into two groups, A and B. Each group gets its own daily planner. Shared days stay visible to both.
      </p>
      {practice.active && mine.filter((member) => member.id.startsWith("practice-bochur-")).length > 0 && live.members.filter((member) => member.kind === "member" && member.role === "bochur" && !member.id.startsWith("practice-bochur-") && (shliach ? member.leaderId === live.viewer.id : true)).length < CHAVRUSA_MIN_BOCHURIM ? (
        <p className="mt-2 text-sm text-muted-foreground">Practice: try assigning chavrusos. On the live app this section appears once you have 4 bochurim.</p>
      ) : null}
      {error ? <div className="my-2"><Notice>{error}</Notice></div> : null}
      <p className="mt-2 text-xs text-muted-foreground">A: {groups.A.length} · B: {groups.B.length} · Unassigned: {groups.none.length}</p>
      <ul className="mt-3 divide-y">
        {mine.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={member.name} src={member.avatarUrl} className="size-10 text-xs" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{member.name}</p>
                {member.id.startsWith("practice-bochur-") ? <p className="text-xs text-muted-foreground">Practice only</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Chavrusa for ${member.name}`}>
              {([["", "Unassigned"], ["A", "A"], ["B", "B"]] as const).map(([value, label]) => {
                const current = member.chavrusa ?? "";
                const active = current === value;
                return (
                  <button
                    key={value || "none"}
                    type="button"
                    disabled={busy === member.id}
                    aria-pressed={active}
                    className={cn("min-h-11 rounded-full px-3 text-sm ring-1", active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground ring-border")}
                    onClick={() => assign(member.id, value === "A" || value === "B" ? value : null)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
