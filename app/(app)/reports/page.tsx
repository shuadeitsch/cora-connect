import { redirect } from "next/navigation";

export const metadata = { title: "Reports" };

/** Reports live on the Dashboard now (1.8.24). An old "Log visit" link for one contact opens that contact's visit form on Contacts. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const household = Array.isArray(params.household) ? params.household[0] : params.household;
  if (household) redirect(`/households?visit=${encodeURIComponent(household)}`);
  redirect("/dashboard");
}
