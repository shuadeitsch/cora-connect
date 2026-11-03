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

export function UsersView({ data }: { data: AppData }) {
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
        New accounts wait here. Approve a Cora Connect admin, who sees every shared contact, or a shliach with the states he covers. A shliach only sees his own people, plus shared contacts in that territory.
      </p>
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
                      {locked ? <span className="text-xs text-muted-foreground">Always Cora Connect admin</span> : member.status === "pending" ? (
                        <div className="grid justify-end gap-2">
                          <RoleChooser
                            member={member}
                            busy={busy}
                            submitLabel={(role) => role === "admin" ? "Approve as Cora Connect admin" : "Approve as Shliach"}
                            onApply={(role, territory) => decide(member.id, role, territory)}
                          />
                          <div className="flex justify-end">
                            <Button type="button" variant="outline" className="h-8 rounded-full px-3" disabled={busy} onClick={() => decide(member.id, "reject")}>Reject</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <ChangeRole member={member} busy={busy} onApply={(role, territory) => decide(member.id, role, territory)} />
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
    </div>
  );
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

type ChosenRole = "admin" | "shliach";

/** Pick Cora Connect admin or Shliach (with his states). With confirm, a second tap applies it. */
function RoleChooser({
  member,
  busy,
  confirm = false,
  submitLabel,
  onApply,
}: {
  member: TeamMember;
  busy: boolean;
  confirm?: boolean;
  submitLabel: (role: ChosenRole) => string;
  onApply: (role: ApprovalDecision, territory?: { states: string[]; areas: string[] }) => void;
}) {
  const [role, setRole] = useState<ChosenRole>(member.role === "shliach" ? "shliach" : "admin");
  const [draft, setDraft] = useState(() => territoryText(member));
  const [asking, setAsking] = useState(false);
  const parts = splitList(draft.states);
  const roleName = role === "admin" ? "Cora Connect admin" : "Shliach";
  const where = role === "shliach" && parts.length ? ` (${parts.join(", ")})` : "";

  function apply() {
    if (role === "admin") onApply("admin");
    else onApply("shliach", { states: parts, areas: splitList(draft.areas) });
    setAsking(false);
  }

  return (
    <div className="grid gap-2">
      <div className="inline-flex rounded-full bg-muted p-1" role="radiogroup" aria-label={`Role for ${member.name}`}>
        {(["admin", "shliach"] as const).map((value) => (
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
            {value === "admin" ? "Cora Connect admin" : "Shliach"}
          </button>
        ))}
      </div>
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
          <Button type="button" className="h-8 rounded-full px-3" disabled={busy} onClick={() => (confirm ? setAsking(true) : apply())}>
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
  onApply,
}: {
  member: TeamMember;
  busy: boolean;
  onApply: (role: ApprovalDecision, territory?: { states: string[]; areas: string[] }) => void;
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
          onApply={(role, territory) => { onApply(role, territory); setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}
