import { redirect } from "next/navigation";
import { ReportsView } from "@/components/reports-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Reports" };

type Query = Record<string, string | string[] | undefined>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const data = await getAppData();
  if (!data) redirect("/login");
  const params = await searchParams;
  const household = params.household;
  const flag = params.new;
  const householdId = Array.isArray(household) ? household[0] ?? "" : household ?? "";
  const start = Array.isArray(flag) ? flag[0] : flag;
  return <ReportsView data={data} startNew={start === "1" || start === "true"} householdId={householdId} />;
}
