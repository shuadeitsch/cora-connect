import { redirect } from "next/navigation";

export const metadata = { title: "My Team" };

/** Users merged into My Team (1.8.23). */
export default function UsersPage() {
  redirect("/team");
}
