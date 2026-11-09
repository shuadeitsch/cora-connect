"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice, PageHeader } from "@/components/page-header";
import { StatusPill, expiryText, memberStates } from "@/components/people-overview";
import { ScrollRegion } from "@/components/scroll-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setAccountApprovalAction } from "@/lib/actions";
import { FOCUS_STATES, OWNER_EMAIL, ROLE_LABEL, sameState } from "@/lib/constants";
import type { AppData, ApprovalDecision, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

function splitList(value: string) {
  return value.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean);
}

function territoryText(member: TeamMember) {
  const states = [...new Set(member.territory.map((row) => row.state))].join(", ");
  const areas = [...new Set(member.territory.map((row) => row.area).filter(Boolean))].join(", ");
  return { states, areas };
}

export function UsersView({ data, embedded = false }: { data: AppData; embedded?: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"pending" | "all">(() => (data.members.some((member) => member.kind === "member" && member.status === "pending") ? "pending" : "all"));
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [, start] = useTransition();
  const accounts = useMemo(
    () => data.members.filter((member) => member.kind === "member"),
    [data.members],
  );
  const pendingCount = accounts.filter((member) => member.status === "pending").length;
  const rows = filter === "pending" ? accounts.filter((member) => member.status === "pending") : accounts;

  const shluchim = accounts.filter((member) => member.role === "shliach" && member.status === "approved");

  function decide(id: string, decision: ApprovalDecision, territory?: { states: string[]; areas: string[] }, leaderId?: string) {
    setError("");
    setPendingId(id);
    start(async () => {
      const result = await setAccountApprovalAction(id, decision, territory, leaderId);
      setPendingId("");
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const intro = embedded ? (
    <div className="mb-3">
      <h2 className="font-heading text-lg font-semibold text-foreground">Cora admins &amp; approvals</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Cora Connect admins, pending signups, roles, and access — in one place. A bochur also needs his shliach to approve him under Participating bochurim.
      </p>
    </div>
  ) : (
    <>
      <PageHeader title="Users" crumb="Users" />
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        New accounts wait here. Approve a Cora Connect admin, a shliach with the state he covers, or a bochur with his shliach. A bochur then also needs his shliach to approve him in My Team.
      </p>
    </>
  );

  const body = (
    <>
      {intro}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant={filter === "pending" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("pending")}>
          Pending ({pendingCount})
        </Button>
        <Button type="button" variant={filter === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("all")}>
          Everyone ({accounts.length})
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
                <th className="px-3 py-2 font-medium">Account type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Expires</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((member) => {
                const locked = member.email.toLowerCase() === OWNER_EMAIL;
                const busy = pendingId === member.id;
                return (
                  <tr key={member.id} className="border-b align-top last:border-0">
                    <td className="px-3 py-3 font-semibold text-foreground">
                      {member.name}
                      <div className="text-xs font-normal text-muted-foreground xl:hidden">{member.email}</div>
                    </td>
                    <td className="hidden px-3 py-3 text-muted-foreground xl:table-cell">{member.email}</td>
                    <td className="px-3 py-3">
                      <RoleBadge member={member} />
                      {member.role === "shliach" ? <div className="mt-1 text-xs text-muted-foreground">{memberStates(member) || "No states yet"}</div> : null}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill member={member} />
                      <div className="mt-1 text-xs text-muted-foreground md:hidden">{member.expiresAt ? `Expires ${expiryText(member)}` : ""}</div>
                    </td>
                    <td className="hidden px-3 py-3 text-muted-foreground md:table-cell">{expiryText(member)}</td>
                    <td className="px-3 py-3">
                      {locked ? <span className="text-xs text-muted-foreground">Always Cora Connect admin</span> : member.status === "pending" && member.role === "bochur" && member.adminApprovedAt ? (
                        <div className="grid justify-end gap-2 text-right text-xs text-muted-foreground">
                          <span>Waiting for {accounts.find((item) => item.id === member.leaderId)?.name ?? "his shliach"} to approve in My Team</span>
                          <div className="flex justify-end">
                            <Button type="button" variant="outline" className="h-8 rounded-full px-3" disabled={busy} onClick={() => decide(member.id, "reject")}>Reject</Button>
                          </div>
                        </div>
                      ) : member.status === "pending" ? (
                        <div className="grid justify-end gap-2">
                          <RoleChooser
                            member={member}
                            busy={busy}
                            shluchim={shluchim}
                            submitLabel={(role) => role === "admin" ? "Approve as Cora Connect admin" : role === "bochur" ? "Approve as Bochur" : "Approve as Shliach"}
                            onApply={(role, territory, leaderId) => decide(member.id, role, territory, leaderId)}
                          />
                          <div className="flex justify-end">
                            <Button type="button" variant="outline" className="h-8 rounded-full px-3" disabled={busy} onClick={() => decide(member.id, "reject")}>Reject</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <ChangeRole member={member} busy={busy} shluchim={shluchim} onApply={(role, territory, leaderId) => decide(member.id, role, territory, leaderId)} />
                          {member.status === "approved" ? (
                            <Button type="button" variant="outline" className="h-8 rounded-full px-3" disabled={busy} onClick={() => decide(member.id, "disable")}>Disable</Button>
                          ) : null}
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
    </>
  );

  if (embedded) {
    return <section className="mt-4" aria-label="User management">{body}</section>;
  }
  return <div className="p-4 sm:p-6">{body}</div>;
}

function RoleBadge({ member }: { member: TeamMember }) {
  const label = ROLE_LABEL[member.role] ?? member.role;
  const tone =
    member.role === "admin"
      ? "bg-primary/10 text-primary ring-primary/30"
      : member.role === "shliach"
        ? "bg-amber-500/10 text-amber-800 ring-amber-500/30 dark:text-amber-200"
        : "bg-muted text-muted-foreground ring-border";
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", tone)}>{label}</span>;
}

type ChosenRole = "admin" | "shliach" | "bochur";
type Apply = (role: ApprovalDecision, territory?: { states: string[]; areas: string[] }, leaderId?: string) => void;

/** Pick Cora Connect admin or Shliach (with his states). With confirm, a second tap applies it. */
function RoleChooser({
  member,
  busy,
  confirm = false,
  submitLabel,
  shluchim,
  onApply,
}: {
  member: TeamMember;
  busy: boolean;
  confirm?: boolean;
  submitLabel: (role: ChosenRole) => string;
  shluchim: TeamMember[];
  onApply: Apply;
}) {
  const [role, setRole] = useState<ChosenRole>(member.role === "shliach" ? "shliach" : member.role === "bochur" ? "bochur" : "admin");
  const [leaderId, setLeaderId] = useState(member.leaderId ?? "");
  const [draft, setDraft] = useState(() => territoryText(member));
  const [asking, setAsking] = useState(false);
  const parts = splitList(draft.states);
  const roleName = role === "admin" ? "Cora Connect admin" : role === "bochur" ? "Bochur" : "Shliach";
  const where = role === "shliach" && parts.length ? ` (${parts.join(", ")})` : "";

  function apply() {
    if (role === "admin") onApply("admin");
    else if (role === "bochur") onApply("bochur", undefined, leaderId);
    else onApply("shliach", { states: parts, areas: splitList(draft.areas) });
    setAsking(false);
  }

  return (
    <div className="grid gap-2">
      <div className="inline-flex rounded-full bg-muted p-1" role="radiogroup" aria-label={`Role for ${member.name}`}>
        {(["admin", "shliach", "bochur"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            className={cn(
              "h-8 flex-1 whitespace-nowrap rounded-full px-3 text-xs font-medium",
              role === value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background",
            )}
            onClick={() => { setRole(value); setAsking(false); }}
          >
            {value === "admin" ? "Cora Connect admin" : value === "bochur" ? "Bochur" : "Shliach"}
          </button>
        ))}
      </div>
      {role === "bochur" ? (
        <select
          aria-label={`Shliach for ${member.name}`}
          className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
          value={leaderId}
          onChange={(event) => { setLeaderId(event.target.value); setAsking(false); }}
        >
          <option value="">Pick his shliach</option>
          {shluchim.map((item) => <option key={item.id} value={item.id}>{item.name}{memberStates(item) ? ` · ${memberStates(item)}` : ""}</option>)}
        </select>
      ) : null}
      {role === "shliach" ? (
        <div className="grid gap-1 sm:grid-cols-2">
          <div className="flex flex-wrap gap-1 sm:col-span-2">
            {FOCUS_STATES.map((state) => {
              const on = parts.some((part) => sameState(part, state.name));
              return (
                <button
                  key={state.code}
                  type="button"
                  aria-pressed={on}
                  className={on ? "h-8 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground" : "h-8 rounded-full bg-muted px-3 text-xs font-medium text-foreground"}
                  onClick={() => {
                    const next = on ? parts.filter((part) => !sameState(part, state.name)) : [...parts, state.name];
                    setDraft({ ...draft, states: next.join(", ") });
                    setAsking(false);
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
            onChange={(event) => { setDraft({ ...draft, states: event.target.value }); setAsking(false); }}
          />
          <Input
            value={draft.areas}
            placeholder="Areas, optional"
            aria-label={`Areas for ${member.name}`}
            onChange={(event) => { setDraft({ ...draft, areas: event.target.value }); setAsking(false); }}
          />
        </div>
      ) : null}
      {confirm && asking ? (
        <div className="rounded-2xl border border-border bg-muted/50 p-2 text-sm">
          <p className="text-foreground">Make {member.name} a {roleName}{where}?</p>
          <div className="mt-2 flex justify-end gap-1.5">
            <Button type="button" variant="outline" className="h-8 rounded-full px-3" onClick={() => setAsking(false)}>Cancel</Button>
            <Button type="button" className="h-8 rounded-full px-3" disabled={busy} onClick={apply}>Confirm</Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" className="h-8 rounded-full px-3" disabled={busy || (role === "bochur" && !leaderId) || (role === "shliach" && !parts.length)} onClick={() => (confirm ? setAsking(true) : apply())}>
            {submitLabel(role)}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChangeRole({
  member,
  busy,
  shluchim,
  onApply,
}: {
  member: TeamMember;
  busy: boolean;
  shluchim: TeamMember[];
  onApply: Apply;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-8 rounded-full px-3" disabled={busy}>Change role</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))]">
        <p className="mb-2 font-heading text-sm font-semibold text-foreground">Change role for {member.name}</p>
        <RoleChooser
          member={member}
          busy={busy}
          confirm
          submitLabel={() => "Apply"}
          shluchim={shluchim}
          onApply={(role, territory, leaderId) => { onApply(role, territory, leaderId); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}
