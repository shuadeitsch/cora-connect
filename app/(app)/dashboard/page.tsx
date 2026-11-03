import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/dashboard-home";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  return <DashboardHome data={data} />;
}
