import { redirect } from "next/navigation";
import { HouseholdsView } from "@/components/households-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Contacts" };

type Query = Record<string, string | string[] | undefined>;

function text(params: Query, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function flag(params: Query, key: string) {
  const value = text(params, key);
  return value === "1" || value === "true";
}

export default async function HouseholdsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const data = await getAppData();
  if (!data) redirect("/login");
  const params = await searchParams;
  return (
    <HouseholdsView
      data={data}
      openNew={flag(params, "new")}
      openImport={flag(params, "import")}
      initialDue={flag(params, "due")}
      initialFound={flag(params, "found")}
      initialProject={text(params, "project")}
      initialState={text(params, "state")}
      focusId={text(params, "focus")}
    />
  );
}
