import { redirect } from "next/navigation";
import { UsersView } from "@/components/users-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  if (!data.viewer.canManage) redirect("/households");
  return <UsersView data={data} />;
}
