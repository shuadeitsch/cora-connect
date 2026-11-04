import { redirect } from "next/navigation";
import { BochurimPanel } from "@/components/bochurim-panel";
import { TeamView } from "@/components/team-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "My team" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const data = await getAppData();
  if (!data) redirect("/login");
  const params = await searchParams;
  if (data.viewer.role === "bochur") redirect("/households");
  return (
    <>
      <div className="px-4 pt-4 sm:px-6 sm:pt-6"><BochurimPanel data={data} /></div>
      <TeamView data={data} startInvite={params.invite === "1"} />
    </>
  );
}
