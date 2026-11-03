import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { WaitingRoom } from "@/components/waiting-room";
import { formatMedium } from "@/lib/format";
import { getAppData, getCurrentUser } from "@/lib/session";
import { labeledVisitNotes } from "@/lib/visit-notes";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "approved") return <WaitingRoom name={user.name} email={user.email} status={user.status} />;
  const data = await getAppData();
  if (!data) redirect("/login");
  return (
    <Shell
      viewer={data.viewer}
      notifications={data.notifications}
      households={data.households.map((household) => ({
        id: household.id,
        name: household.name,
        city: household.city,
        state: household.state,
        tags: household.tags,
        notes: data.viewer.canViewHistory
          ? labeledVisitNotes(household.notes, household.contactVisits ?? [], formatMedium)
          : [],
      }))}
    >
      {children}
    </Shell>
  );
}
