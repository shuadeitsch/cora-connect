import { redirect } from "next/navigation";
import { PlannerView } from "@/components/planner-view";
import { loadPlanner } from "@/lib/planner";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Daily planner" };

export default async function PlannerPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  const planner = await loadPlanner();
  return <PlannerView data={data} days={planner.days} loadError={planner.error} />;
}
