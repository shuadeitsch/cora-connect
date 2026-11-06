import { redirect } from "next/navigation";
import { BetaView } from "@/components/beta-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Beta" };

export default async function BetaPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  if (data.viewer.role !== "admin" && !data.viewer.preview) redirect("/households");
  // In preview, Beta is hidden from the role nav; admins reach it after Exit.
  if (data.viewer.preview) redirect("/dashboard");
  return <BetaView />;
}
