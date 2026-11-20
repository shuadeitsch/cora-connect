import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CallRowView } from "@/components/call-history";
import { getAppData } from "@/lib/session";
import { listRecentCallsAction } from "@/lib/voice-actions";

export const metadata = { title: "Calls" };
export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  if (!data.viewer.canMessage) redirect("/dashboard");
  const calls = await listRecentCallsAction();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Calls" crumb="Calls" description="Every call made or received through the CRM, with notes and recordings. Calls from numbers that aren't saved on a contact show the number." />
      {calls.length ? (
        <ul className="grid gap-2">
          {calls.map((row) => (
            <li key={row.id} className="panel rounded-2xl p-3">
              <p className="mb-1.5 text-sm font-semibold text-foreground">{row.contactName ?? `Unknown caller ${row.contactNumber}`}</p>
              <ul><CallRowView row={row} /></ul>
            </li>
          ))}
        </ul>
      ) : <p className="panel rounded-3xl px-4 py-10 text-center text-sm text-muted-foreground">No calls yet.</p>}
    </div>
  );
}
