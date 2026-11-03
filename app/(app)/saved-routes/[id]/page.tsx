import { notFound, redirect } from "next/navigation";
import { RouteDetail } from "@/components/route-detail";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Route" };

export default async function RoutePage({ params }: { params: Promise<{ id: string }> }) {
  const data = await getAppData();
  if (!data) redirect("/login");
  const { id } = await params;
  const route = data.routes.find((item) => item.id === id);
  if (!route) notFound();
  return <RouteDetail data={data} route={route} />;
}
