import { redirect } from "next/navigation";
import { RouteBuilder } from "@/components/route-builder";
import { getAppData } from "@/lib/session";

export const metadata = { title: "New route" };

export default async function NewRoutePage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  if (!data.viewer.canCreateRoute) redirect("/saved-routes");
  return <RouteBuilder data={data} />;
}
