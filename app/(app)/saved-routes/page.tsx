import { redirect } from "next/navigation";
import { RoutesView } from "@/components/routes-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Saved routes" };

export default async function SavedRoutesPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  return <RoutesView data={data} />;
}
