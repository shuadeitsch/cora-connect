import { Greeting } from "@/components/greeting";
import { AdminBreakdown } from "@/components/admin-breakdown";
import { ActivityTotals } from "@/components/activity-totals";
import { ContactsPerProject, VisitsPerProject } from "@/components/visits-per-project";
import { DashboardReports } from "@/components/dashboard-reports";
import { FeedbackCard } from "@/components/feedback-card";
import type { AppData } from "@/lib/types";

export function DashboardHome({ data }: { data: AppData }) {
  const { viewer } = data;
  const stateCounts = new Map<string, number>();
  for (const household of data.households) {
    const key = household.state || "—";
    stateCounts.set(key, (stateCounts.get(key) ?? 0) + 1);
  }
  const states = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxState = Math.max(...states.map(([, count]) => count), 1);
  const admin = viewer.role === "admin" && !viewer.preview;
  const bochur = viewer.role === "bochur";

  if (bochur) {
    const projectId = viewer.projectId;
    const projectName = data.projects.find((p) => p.id === projectId)?.name;
    const visited = new Set<string>();
    for (const house of data.households) {
      if (projectId && house.projectId && house.projectId !== projectId) continue;
      const hit = house.contactVisits.some(
        (v) =>
          v.status === "completed" &&
          (!projectName || !v.visited.trim() || v.visited.trim().toLowerCase() === projectName.toLowerCase() || house.projectId === projectId),
      );
      if (hit) visited.add(house.id);
    }
    return (
      <div className="space-y-4 p-3 sm:p-6">
        <Greeting name={viewer.name} />
        <section className="panel rounded-3xl p-6 text-center" aria-label="Project visits">
          <p className="text-sm text-muted-foreground">{projectName ? `Visited in ${projectName}` : "People you visited"}</p>
          <p className="mt-2 font-heading text-5xl font-semibold tabular-nums text-foreground">{visited.size}</p>
          <p className="mt-1 text-sm text-muted-foreground">{visited.size === 1 ? "person" : "people"}</p>
        </section>
        <ActivityTotals data={data} />
        <DashboardReports data={data} />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <Greeting name={viewer.name} />

      {admin ? (
        <AdminBreakdown data={data} />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2">
          <ContactsPerProject data={data} />
          <VisitsPerProject data={data} />
        </section>
      )}

      <ActivityTotals data={data} />
      <DashboardReports data={data} />

      {admin ? <FeedbackCard /> : null}

      {admin ? (
        <section className="panel rounded-3xl p-4" aria-label="Households by state">
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
        </section>
      ) : null}
    </div>
  );
}
