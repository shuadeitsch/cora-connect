import { redirect } from "next/navigation";
import { PlanTrip } from "@/components/plan-trip";
import { loadPlanner } from "@/lib/planner";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Plan a trip" };

export default async function PlanTripPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  if (!data.viewer.canCreateRoute) redirect("/saved-routes");
  const planner = data.viewer.canManage ? await loadPlanner() : { days: [] };
  return <PlanTrip data={data} plannerDates={planner.days.map((day) => day.date)} />;
}
