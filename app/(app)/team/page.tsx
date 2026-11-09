import { redirect } from "next/navigation";
import { TeamView } from "@/components/team-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "My Team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const data = await getAppData();
  if (!data) redirect("/login");
  const params = await searchParams;
  if (data.viewer.role === "bochur") redirect("/households");
  // Shliach (including Beta View as shliach): My Team lives under Settings.
  if (data.viewer.role === "shliach") redirect(params.invite === "1" ? "/settings?tab=team&invite=1" : "/settings?tab=team");
  return <TeamView data={data} startInvite={params.invite === "1"} />;
}
