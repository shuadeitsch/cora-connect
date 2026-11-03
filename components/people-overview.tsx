"use client";

import { ChevronDown } from "lucide-react";
import { ACCOUNT_STATUS_LABEL, ROLE_LABEL } from "@/lib/constants";
import { formatMedium } from "@/lib/format";
import type { AppData, TeamMember } from "@/lib/types";
import { cn } from "@/lib/utils";

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function memberStates(member: TeamMember) {
  return [...new Set(member.territory.map((row) => (row.area ? `${row.state} · ${row.area}` : row.state)))].join(", ");
}

/** Approved accounts past their end date show as Expired. */
export function memberStatus(member: TeamMember): { label: string; tone: string } {
  if (member.status === "approved" && member.expiresAt && member.expiresAt.slice(0, 10) < today()) {
    return { label: "Expired", tone: "bg-red-500/10 text-red-700 dark:text-red-300" };
  }
  const tone =
    member.status === "approved" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : member.status === "pending" || member.status === "invited" ? "bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : "bg-muted text-muted-foreground";
  return { label: ACCOUNT_STATUS_LABEL[member.status] ?? member.status, tone };
}

export function StatusPill({ member }: { member: TeamMember }) {
  const status = memberStatus(member);
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", status.tone)}>{status.label}</span>;
}

export function expiryText(member: TeamMember) {
  return member.expiresAt ? formatMedium(member.expiresAt.slice(0, 10)) : "—";
}

/** Admin view on My Team: each shliach, and the people whose leader he is. Only real accounts. */
export function ShluchimSection({ data }: { data: AppData }) {
  const accounts = data.members.filter((member) => member.kind === "member");
  const shluchim = accounts.filter((member) => member.role === "shliach").sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section className="mb-4 panel rounded-3xl p-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">Shluchim</h2>
      {shluchim.length ? (
        <ul className="mt-2 divide-y">
          {shluchim.map((shliach) => {
            const people = accounts.filter((member) => member.leaderId === shliach.id && member.id !== shliach.id);
            const states = memberStates(shliach);
            return (
              <li key={shliach.id}>
                <details className="group py-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-1 hover:bg-muted/60">
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">{shliach.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{shliach.email}{states ? ` · ${states}` : " · No states yet"}</span>
                    </span>
                    <StatusPill member={shliach} />
                    <span className="text-xs text-muted-foreground">{people.length} under him</span>
                  </summary>
                  <div className="mt-2 ml-7">
                    {people.length ? (
                      <ul className="grid gap-1.5">
                        {people.map((person) => (
                          <li key={person.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-foreground/8">
                            <span className="font-medium text-foreground">{person.name}</span>
                            <span className="text-xs text-muted-foreground">{person.email}</span>
                            <span className="text-xs text-muted-foreground">{ROLE_LABEL[person.role] ?? person.role}</span>
                            <StatusPill member={person} />
                            <span className="text-xs text-muted-foreground">Expires {expiryText(person)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No one under him yet.</p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">No shluchim yet.</p>
      )}
    </section>
  );
}
