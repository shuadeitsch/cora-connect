import { redirect } from "next/navigation";
import { BetaView } from "@/components/beta-view";
import { getAppData } from "@/lib/session";

export const metadata = { title: "Beta" };

export default async function BetaPage() {
  const data = await getAppData();
  if (!data) redirect("/login");
  // Until launch, only a real Cora admin (not View as shliach/bochur) may open Beta.
  // Everyone else, including a typed /beta URL, goes to Home.
  if (data.viewer.role !== "admin" || data.viewer.preview) redirect("/dashboard");
  return <BetaView />;
}
