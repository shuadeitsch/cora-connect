import { buildSeed } from "../lib/seed";
import { present } from "../lib/present";
import { DEMO_PASSWORD, DEMO_USERS } from "../lib/demo-accounts";
import { hashPassword } from "../lib/password";

const today = "2026-10-20";
const db = buildSeed(new Date(`${today}T12:00:00Z`));
const failures: string[] = [];
function check(cond: unknown, message: string) {
  if (!cond) failures.push(message);
}

check(db.households.length >= 60, "expected at least 60 households");
check(db.visits.length >= 40, "expected at least 40 visits");
check(db.routes.length === 8, "expected 8 routes");
check(db.users.length === 8, "expected 8 sample users");
check(new Set(db.households.map((h) => h.name)).size === db.households.length, "household names should be unique");
check(db.households.every((h) => h.lat != null && h.lng != null), "every seeded household should have coordinates");
check(db.people.every((p) => p.phone === "" || p.phone.includes("555")), "phones must be fictional 555 numbers");
check(db.people.every((p) => p.email === "" || p.email.endsWith("@example.com")), "emails must use example.com");
check(db.users.every((u) => u.passwordHash === hashPassword(DEMO_PASSWORD)), "demo password hash mismatch");
check(!JSON.stringify(db).includes("wilansky"), "seed must not copy real account names from screenshots");

const levi = db.users.find((u) => u.email === DEMO_USERS[0]!.email)!;
const rivka = db.users.find((u) => u.email.startsWith("rivka"))!;
const sara = db.users.find((u) => u.email.startsWith("sara"))!;
const adminView = present(db, levi, "demo", today);
const limitedView = present(db, rivka, "demo", today);
const saraView = present(db, sara, "demo", today);

check(adminView.stats.visitsThisMonth >= 5, `visits this month ${adminView.stats.visitsThisMonth}`);
check(adminView.stats.householdsThisMonth >= 3, "households this month");
check(adminView.households.some((h) => h.dueState === "overdue"), "need overdue households");
check(adminView.households.some((h) => h.dueState === "due"), "need households due this week");
check(adminView.stats.reactions.warm + adminView.stats.reactions.happy > 0, "need reactions");
check(limitedView.households.length > 0 && limitedView.households.length < adminView.households.length, "limited user should see only a route");
check(limitedView.households.every((h) => h.people.every((p) => !p.phone && !p.email && !p.whatsapp)), "limited user must not receive contact info");
check(limitedView.visits.every((v) => !v.details && !v.reaction), "limited user must not receive visit history");
check(saraView.households.some((h) => h.people.some((p) => p.phone)), "sara can view contact info on her route");
check(adminView.members.length >= 8, "admin sees the team");
check(limitedView.members.length === 0, "limited user does not receive the roster");
check(adminView.routes.every((r) => r.stops.every((s) => adminView.households.some((h) => h.id === s.householdId) || db.households.some((h) => h.id === s.householdId))), "route stops should point at households");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(
  `ok households=${db.households.length} visits=${db.visits.length} overdue=${adminView.households.filter((h) => h.dueState === "overdue").length} due=${adminView.households.filter((h) => h.dueState === "due").length} thisMonth=${adminView.stats.visitsThisMonth}`,
);
