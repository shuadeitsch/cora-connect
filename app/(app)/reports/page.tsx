import { redirect } from "next/navigation";

export const metadata = { title: "Reports" };

/** Reports live on the Dashboard now (1.8.24). */
export default function ReportsPage() {
  redirect("/dashboard");
}
