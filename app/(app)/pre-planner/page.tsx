import { redirect } from "next/navigation";
import { PreplannerHome } from "@/components/preplanner-home";
import { loadPreplannerTasks } from "@/lib/preplanner-task-actions";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Pre-planner" };

export default async function PreplannerPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  if (data.viewer.canPreplanner === false) redirect("/dashboard");
  const tasks = await loadPreplannerTasks();
  return <PreplannerHome data={data} tasks={tasks} />;
}
