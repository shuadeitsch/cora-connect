import Link from "next/link";
import { ClipboardList, LogOut, Settings, ShieldCheck, Users } from "lucide-react";
import { logoutAction } from "@/lib/actions";
import { Greeting } from "@/components/greeting";
import { AdminBreakdown } from "@/components/admin-breakdown";
import { ContactsPerProject, VisitsPerProject } from "@/components/visits-per-project";
import { REACTIONS, reactionMeta, statusMeta } from "@/lib/constants";
import { formatMedium } from "@/lib/format";
import type { AppData } from "@/lib/types";
import { VisitsLog } from "@/components/visits-log";

export function DashboardHome({ data }: { data: AppData }) {
  const { stats, viewer } = data;
  const maxBar = Math.max(...stats.activity.map((week) => week.count), 1);
  const reactionTotal = Object.values(stats.reactions).reduce((sum, count) => sum + count, 0);
  const stateCounts = new Map<string, number>();
  for (const household of data.households) {
    const key = household.state || "—";
    stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1);
  }
  const states = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxState = Math.max(...states.map(([, count]) => count), 1);

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <Greeting name={viewer.name} />

      {viewer.role === "admin" ? (
        <AdminBreakdown data={data} />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <ContactsPerProject data={data} />
          <VisitsPerProject data={data} />
        </section>
      )}

      {viewer.role === "admin" ? (
        <>
      <section className="grid gap-3 xl:grid-cols-3">
        <div className="panel rounded-3xl p-4 xl:col-span-2">
          <h2 className="font-heading text-xl font-semibold text-foreground">Visits over time</h2>
          {stats.activity.every((week) => week.count === 0) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No visits recorded yet. Start visiting households to see activity here.</p>
          ) : (
            <div className="mt-4 flex h-44 items-end gap-2">
              {stats.activity.map((week) => (
                <div key={week.label} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] font-medium text-foreground tabular-nums">{week.count}</span>
                  <div className="flex h-28 w-full items-end">
                    <div
                      className="w-full rounded-t-xl bg-primary/80"
                      style={{ height: `${Math.max(8, (week.count / maxBar) * 100)}%` }}
                      title={`${week.count} visits`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{week.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel rounded-3xl p-4">
          <h2 className="font-heading text-xl font-semibold text-foreground">Households by state</h2>
          {states.length ? (
            <ul className="mt-4 space-y-2.5">
              {states.map(([state, count]) => (
                <li key={state}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-foreground">{state}</span>
                    <span className="text-muted-foreground tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-2" style={{ width: `${(count / maxState) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Add households to see them by state.</p>
          )}
        </div>
      </section>


      <section className="grid gap-3 lg:grid-cols-2">
        <div className="panel rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-foreground">Recent visits</h2>
            <Link href="/reports" className="text-sm text-primary">View all</Link>
          </div>
          {stats.recentVisits.length ? (
            <ul className="mt-3 divide-y divide-border">
              {stats.recentVisits.map((visit) => {
                const reaction = reactionMeta(visit.reaction);
                return (
                  <li key={visit.id} className="flex items-start justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{visit.visitorName}</span>{" "}
                        {visit.status === "deferred" ? "deferred" : "visited"} {visit.householdName} {reaction?.emoji}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatMedium(visit.visitDate)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${statusMeta(visit.status).className}`}>
                      {statusMeta(visit.status).label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">No visits recorded yet.</p>
          )}
        </div>

        <div className="panel rounded-3xl p-4">
          <h2 className="font-heading text-xl font-semibold text-foreground">Visit reactions</h2>
          {!viewer.canViewHistory ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Reactions are hidden for your access.</p>
          ) : reactionTotal === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reactions yet.</p>
          ) : (
            <div className="mt-3 flex items-center gap-4">
              <Donut parts={REACTIONS.map((item) => ({ color: item.color, value: stats.reactions[item.id] }))} />
              <ul className="space-y-1 text-sm">
                {REACTIONS.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-foreground">{item.label}</span>
                    <span className="text-muted-foreground">{stats.reactions[item.id]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </section>

      <section className="panel rounded-3xl p-4" aria-label="More">
        <h2 className="font-heading text-lg font-semibold text-foreground">More</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <MoreLink href="/reports" icon={ClipboardList} label="Reports" />
          <MoreLink href="/team" icon={Users} label="My Team" />
          {viewer.canManage ? <MoreLink href="/users" icon={ShieldCheck} label="Users" /> : null}
          <MoreLink href="/settings" icon={Settings} label="Settings" />
          <form action={logoutAction}>
            <button type="submit" className="flex min-h-12 w-full items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 text-sm font-medium text-muted-foreground hover:bg-muted"><LogOut className="size-4" /> Log out</button>
          </form>
        </div>
      </section>
        </>
      ) : (
        <VisitsLog data={data} />
      )}
    </div>
  );
}

function MoreLink({ href, icon: Icon, label }: { href: string; icon: typeof Users; label: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-background/40 px-3 text-sm font-medium text-foreground hover:bg-muted">
      <Icon className="size-4 text-primary" />
      {label}
    </Link>
  );
}

function Donut({ parts }: { parts: { color: string; value: number }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  let cursor = 0;
  return (
    <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90">
      {parts.map((part) => {
        const length = (part.value / total) * circ;
        const dash = `${length} ${circ - length}`;
        const offset = -cursor;
        cursor += length;
        return (
          <circle
            key={part.color}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={part.color}
            strokeWidth="12"
            strokeDasharray={dash}
            strokeDashoffset={offset}
          />
        );
      })}
    </svg>
  );
}
