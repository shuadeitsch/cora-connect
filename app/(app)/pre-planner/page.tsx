import { redirect } from "next/navigation";
import { PreplannerView } from "@/components/preplanner-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Pre-planner" };

export default async function PreplannerPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  return <PreplannerView data={data} />;
}
