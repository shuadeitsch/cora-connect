"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice, PageHeader } from "@/components/page-header";
import { ScrollRegion } from "@/components/scroll-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAccountApprovalAction } from "@/lib/actions";
import { ACCOUNT_STATUS_LABEL, FOCUS_STATES, OWNER_EMAIL, ROLE_LABEL, sameState } from "@/lib/constants";
import type { AppData, ApprovalDecision, TeamMember } from "@/lib/types";

function splitList(value: string) {
  return value.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean);
}

function territoryText(member: TeamMember) {
  const states = [...new Set(member.territory.map((row) => row.state))].join(", ");
  const areas = [...new Set(member.territory.map((row) => row.area).filter(Boolean))].join(", ");
  return { states, areas };
}

export function UsersView({ data }: { data: AppData }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { states: string; areas: string }>>({});
  const [, start] = useTransition();
  const accounts = useMemo(
    () => data.members.filter((member) => member.kind === "member"),
    [data.members],
  );
  const pendingCount = accounts.filter((member) => member.status === "pending").length;
  const rows = filter === "pending" ? accounts.filter((member) => member.status === "pending") : accounts;

  function draftFor(member: TeamMember) {
    return drafts[member.id] ?? territoryText(member);
  }

  function decide(id: string, decision: ApprovalDecision, territory?: { states: string[]; areas: string[] }) {
    setError("");
    setPendingId(id);
    start(async () => {
      const result = await setAccountApprovalAction(id, decision, territory);
      setPendingId("");
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Users" crumb="Users" />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        New accounts wait here. Approve a Cora admin, who sees every shared contact, or a shliach with the states he covers. A shliach only sees his own people, plus shared contacts in that territory.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant={filter === "pending" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("pending")}>
          Pending ({pendingCount})
        </Button>
        <Button type="button" variant={filter === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("all")}>
          All accounts
        </Button>
      </div>
      {error ? <div className="mb-3"><Notice>{error}</Notice></div> : null}
      <div className="panel overflow-hidden rounded-3xl">
        <ScrollRegion>
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr className="border-b">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="hidden px-3 py-2 font-medium xl:table-cell">Email</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="hidden px-3 py-2 font-medium xl:table-cell">Territory</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((member) => {
                const locked = member.email.toLowerCase() === OWNER_EMAIL;
                const busy = pendingId === member.id;
                const draft = draftFor(member);
                const showTerritory = !locked && (member.status === "pending" || member.role === "shliach");
                return (
                  <tr key={member.id} className="border-b align-top last:border-0">
                    <td className="px-3 py-3 font-semibold text-foreground">
                      {member.name}
                      <div className="text-xs font-normal text-muted-foreground xl:hidden">{member.email}</div>
                    </td>
                    <td className="hidden px-3 py-3 text-muted-foreground xl:table-cell">{member.email}</td>
                    <td className="px-3 py-3">{ROLE_LABEL[member.role] ?? member.role}</td>
                    <td className="hidden px-3 py-3 text-muted-foreground xl:table-cell">
                      {member.role === "shliach"
                        ? [...new Set(member.territory.map((row) => row.area ? `${row.state} · ${row.area}` : row.state))].join(", ") || "No territory yet"
                        : "—"}
                    </td>
                    <td className="px-3 py-3">{ACCOUNT_STATUS_LABEL[member.status]}</td>
                    <td className="px-3 py-3">
                      {locked ? <span className="text-xs text-muted-foreground">Cora admin</span> : (
                        <div className="grid justify-end gap-2">
                          {showTerritory ? (
                            <div className="grid gap-1 sm:grid-cols-2">
                              <div className="flex flex-wrap gap-1 sm:col-span-2">
                                {FOCUS_STATES.map((state) => {
                                  const parts = splitList(draft.states);
                                  const on = parts.some((part) => sameState(part, state.name));
                                  return (
                                    <button
                                      key={state.code}
                                      type="button"
                                      aria-pressed={on}
                                      className={on ? "h-8 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground" : "h-8 rounded-full bg-muted px-3 text-xs font-medium text-foreground"}
                                      onClick={() => {
                                        const next = on
                                          ? parts.filter((part) => !sameState(part, state.name))
                                          : [...parts, state.name];
                                        setDrafts({ ...drafts, [member.id]: { ...draft, states: next.join(", ") } });
                                      }}
                                    >
                                      {state.name}
                                    </button>
                                  );
                                })}
                              </div>
                              <Input
                                value={draft.states}
                                placeholder="States, e.g. Maine, Unsorted"
                                aria-label={`States for ${member.name}`}
                                onChange={(event) => setDrafts({ ...drafts, [member.id]: { ...draft, states: event.target.value } })}
                              />
                              <Input
                                value={draft.areas}
                                placeholder="Areas, optional"
                                aria-label={`Areas for ${member.name}`}
                                onChange={(event) => setDrafts({ ...drafts, [member.id]: { ...draft, areas: event.target.value } })}
                              />
                            </div>
                          ) : null}
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button type="button" className="h-8 rounded-full px-3" disabled={busy} onClick={() => decide(member.id, "admin")}>Cora admin</Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-full px-3"
                              disabled={busy}
                              onClick={() => decide(member.id, "shliach", { states: splitList(draft.states), areas: splitList(draft.areas) })}
                            >
                              Shliach
                            </Button>
                            {member.status === "pending" ? (
                              <Button type="button" variant="outline" className="h-8 rounded-full px-3" disabled={busy} onClick={() => decide(member.id, "reject")}>Reject</Button>
                            ) : null}
                            {member.status === "approved" ? (
                              <Button type="button" variant="outline" className="h-8 rounded-full px-3" disabled={busy} onClick={() => decide(member.id, "disable")}>Disable</Button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-sm text-muted-foreground">
                    {filter === "pending" ? "No accounts are waiting for approval." : "No accounts yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollRegion>
      </div>
    </div>
  );
}
