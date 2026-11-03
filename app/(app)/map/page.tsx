import { redirect } from "next/navigation";
import { MapView } from "@/components/map-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Map" };

export default async function MapPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  return <MapView data={data} />;
}
