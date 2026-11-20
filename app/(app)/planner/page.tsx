import { redirect } from "next/navigation";
import { PlannerView } from "@/components/planner-view";
import { loadPlanner } from "@/lib/planner";
import { getAppData } from "@/lib/session";
import { TwilioAdminPanel } from "@/components/twilio-admin-panel";
import { requireTwilioAdmin } from "@/lib/twilio-admin";

export const metadata = { title: "Daily planner" };

export default async function PlannerPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  if (data.viewer.role === "bochur" && data.viewer.canSeePlanner === false) redirect("/dashboard");
  const planner = await loadPlanner();
  const admin = (await requireTwilioAdmin()).ok;
  return <PlannerView data={data} days={planner.days} loadError={planner.error} adminPanel={admin ? <TwilioAdminPanel /> : null} />;
}
