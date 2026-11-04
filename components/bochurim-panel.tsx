"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { approveBochurAction, disableBochurAction, extendBochurAction } from "@/lib/bochur-actions";
import { formatMedium } from "@/lib/format";
import type { AppData, TeamMember } from "@/lib/types";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function stateOf(member: TeamMember, today: string) {
  if (member.status === "pending") return member.adminApprovedAt ? "Waiting for your approval" : "Waiting for a Cora Connect admin";
  if (member.status === "disabled") return "Disabled";
  if (member.status !== "approved") return member.status;
  if (member.expiresAt && member.expiresAt.slice(0, 10) < today) return `Expired ${formatMedium(member.expiresAt)}`;
  return member.expiresAt ? `Active until ${formatMedium(member.expiresAt)}` : "Active";
}

/** My bochurim: approve (after a Cora admin), extend a month, or disable. Admins see every bochur. */
export function BochurimPanel({ data }: { data: AppData }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [, start] = useTransition();
  const admin = data.viewer.canManage;
  const mine = data.members.filter((member) => member.kind === "member" && member.role === "bochur" && (admin || member.leaderId === data.viewer.id));
  if (data.viewer.role !== "shliach" && !admin) return null;
  if (!mine.length && !(data.viewer.role === "shliach")) return null;
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
    <section className="panel mb-4 rounded-3xl p-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">{admin ? "Bochurim" : "My bochurim"}</h2>
      {error ? <div className="my-2"><Notice>{error}</Notice></div> : null}
      {mine.length ? (
        <ul className="mt-2 divide-y">
          {mine.map((member) => {
            const leader = data.members.find((item) => item.id === member.leaderId);
            const waiting = member.status === "pending" && Boolean(member.adminApprovedAt);
            const canAct = admin || member.leaderId === data.viewer.id;
            return (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stateOf(member, today)}
                    {admin && leader ? ` · Shliach: ${leader.name}` : ""}
                  </p>
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
        <p className="mt-2 text-sm text-muted-foreground">No bochurim yet. When a Cora Connect admin approves a bochur for you, he shows up here for your approval.</p>
      )}
    </section>
  );
}
