import {
  alreadyContacted,
  bestTextNumber,
  phoneDigits,
  planCampaignAudience,
  smsOptOutCommand,
  toE164,
  withinWhatsAppWindow,
} from "../lib/messaging";
import { greetingFirstName, whatsappMeLink, whatsappMeDigits } from "../lib/whatsapp";
import { normalizeNavOrder, DEFAULT_NAV_HREFS } from "../lib/nav-order";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

assert(phoneDigits("+1 (207) 555-0100") === "2075550100", "phone last 10");
assert(toE164("207-555-0100") === "+12075550100", "e164");
assert(whatsappMeDigits("207-555-0100") === "12075550100", "wa digits");
assert(whatsappMeLink("207-555-0100", "Hi {name}") === "https://wa.me/12075550100?text=Hi%20%7Bname%7D", "wa link");
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
{
  const base = { id: "p", householdId: "h", name: "Mr. & Mrs. Richard Skelton", householdName: "x" };
  const p1 = { ...base, phone: "(207) 555-0001", phone2: "207-555-0002", phone3: "2075550003", phoneLineTypes: { "2075550001": "landline", "2075550002": "fixedVoip", "2075550003": "mobile" } };
  assert(bestTextNumber(p1) === "+12075550003", "best skips landline and fixed VoIP");
  const p2 = { ...base, phone: "2075550001", phone2: "2075550004", phoneLineTypes: { "2075550001": "landline" } };
  assert(bestTextNumber(p2) === "+12075550004", "unknown beats landline");
  const p3 = { ...base, phone: "2075550005", phone2: "2075550006", phoneLineTypes: { "2075550006": "nonFixedVoip" } };
  assert(bestTextNumber(p3) === "+12075550006", "known mobile VoIP beats unknown");
  const p4 = { ...base, id: "p4", phone: "2075550001", phoneLineTypes: { "2075550001": "landline" } };
  assert(bestTextNumber(p4) === null, "landline only: nothing to text");
  const plan = planCampaignAudience({ people: [p1, p4], families: ["sms"], skipAlready: false, facts: [] });
  assert(plan.ready.length === 1 && plan.ready[0].address === "+12075550003", "one text per person");
  assert(plan.skipped.length === 1 && /landline/i.test(plan.skipped[0].detail), "landline-only skipped");
}
{
  for (const name of ["Mr. & Mrs. Richard Skelton", "Dr. & Mrs. Alan Hymanson", "Mrs. Jody B Cyr", "Rabbi & Mrs. William Leffler", "Ms. Judy Bernstein"]) {
    const g = greetingFirstName(name);
    assert(!/^(mr|mrs|ms|dr|rabbi)\.?$/i.test(g.split(" ")[0]) || / /.test(g), `greeting for ${name}: ${g}`);
  }
}
assert(greetingFirstName("S. & G. Wayne-Workman") === "S. and G. Wayne-Workman", "two initials: " + greetingFirstName("S. & G. Wayne-Workman"));
console.log("messaging-test ok");
