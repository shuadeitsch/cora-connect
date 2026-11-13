import {
  alreadyContacted,
  phoneDigits,
  planCampaignAudience,
  smsOptOutCommand,
  toE164,
  withinWhatsAppWindow,
} from "../lib/messaging";
import { normalizeNavOrder, DEFAULT_NAV_HREFS } from "../lib/nav-order";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

assert(phoneDigits("+1 (207) 555-0100") === "2075550100", "phone last 10");
assert(toE164("207-555-0100") === "+12075550100", "e164");
assert(smsOptOutCommand("STOP") === "stop", "stop");
assert(smsOptOutCommand("unstop please") === "start", "unstop");
assert(smsOptOutCommand("See you Friday") === null, "not a command");

const facts = [{ householdId: "h1", family: "email" as const, projectId: "p1" }];
assert(alreadyContacted(facts, "h1", "email", "p1"), "already emailed this project");
assert(!alreadyContacted(facts, "h1", "sms", "p1"), "not yet texted");

const plan = planCampaignAudience({
  people: [
    { id: "a", householdId: "h1", householdName: "Cohen", name: "Levi", email: "a@example.com", emailOptOut: false },
    { id: "b", householdId: "h2", householdName: "Levi", name: "Shmuel", email: "", phone: "2075550100" },
    { id: "c", householdId: "h3", householdName: "Opted", name: "Dan", email: "d@example.com", emailOptOut: true },
  ],
  families: ["email", "sms"],
  skipAlready: true,
  projectId: "p1",
  facts,
});
assert(plan.ready.some((item) => item.person.id === "b" && item.family === "sms"), "text ready");
assert(!plan.ready.some((item) => item.person.id === "a" && item.family === "email"), "skip already emailed");
assert(plan.skipped.some((item) => item.reason === "opted-out"), "opt out skipped");
assert(plan.skipped.some((item) => item.reason === "no-address"), "no email skipped");
assert(withinWhatsAppWindow(new Date().toISOString()), "inside window");
assert(!withinWhatsAppWindow(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()), "outside window");
assert(DEFAULT_NAV_HREFS.indexOf("/pre-planner") === DEFAULT_NAV_HREFS.indexOf("/saved-routes") - 1, "default nav");
assert(normalizeNavOrder([]).indexOf("/pre-planner") === normalizeNavOrder([]).indexOf("/saved-routes") - 1, "empty order");
console.log("messaging-test ok");
