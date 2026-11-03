import "server-only";
import { createClient, isSupabaseMode } from "@/lib/supabase/server";

export interface PlannerItem {
  id: string;
  dayId: string;
  kind: "route" | "event";
  routeId: string | null;
  title: string;
  time: string | null;
  notes: string;
  sort: number;
}

export interface PlannerDay {
  id: string;
  date: string;
  items: PlannerItem[];
}

export async function loadPlanner(): Promise<{ days: PlannerDay[]; error: string }> {
  if (!isSupabaseMode()) return { days: [], error: "The planner needs the live database." };
  const supabase = await createClient();
  const [days, items] = await Promise.all([
    supabase.from("planner_days").select("id, date").order("date"),
    supabase.from("planner_items").select("id, day_id, kind, route_id, title, time, notes, sort, created_at").order("sort").order("created_at"),
  ]);
  if (days.error || items.error) return { days: [], error: "Couldn't load the planner. Reload to try again." };
  const byDay = new Map<string, PlannerItem[]>();
  for (const row of items.data ?? []) {
    const item: PlannerItem = {
      id: row.id,
      dayId: row.day_id,
      kind: row.kind === "route" ? "route" : "event",
      routeId: row.route_id,
      title: row.title ?? "",
      time: row.time ? String(row.time).slice(0, 5) : null,
      notes: row.notes ?? "",
      sort: row.sort ?? 0,
    };
    byDay.set(item.dayId, [...(byDay.get(item.dayId) ?? []), item]);
  }
  return {
    days: (days.data ?? []).map((row) => ({
      id: row.id,
      date: row.date,
      items: (byDay.get(row.id) ?? []).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.sort - b.sort),
    })),
    error: "",
  };
}
