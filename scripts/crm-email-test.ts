import { emailRecipientsFor, fillPlaceholders, lastNameFrom, personPlaceholderVars } from "../lib/outreach";
import type { HouseholdView, Person } from "../lib/types";

function assert(ok: unknown, message: string) {
  if (!ok) throw new Error(message);
}

assert(lastNameFrom("Mendel Greisman") === "Greisman", "last name");
assert(lastNameFrom("Mendel") === "", "single name has no last name");
const filled = fillPlaceholders("Hi {first name} {last name} ({full name}) in {city}, {state}", {
  firstName: "Sarah",
  lastName: "Cohen",
  state: "Maine",
  city: "Portland",
});
assert(filled === "Hi Sarah Cohen (Sarah Cohen) in Portland, Maine", `placeholders, got ${filled}`);

function person(partial: Partial<Person> & { id: string; name: string; email: string }): Person {
  return {
    householdId: "h1",
    gender: null,
    phone: "555-0100",
    phone2: "",
    phone3: "",
    whatsapp: "",
    sortOrder: 0,
    emailOptOut: false,
    ...partial,
  };
}

const house = {
  id: "h1",
  name: "Cohen family",
  state: "ME",
  city: "Portland",
  address: "1 Main St",
  zip: "04101",
  people: [
    person({ id: "p1", name: "Sarah Cohen", email: "sarah@example.com" }),
    person({ id: "p2", name: "Opted Out", email: "out@example.com", emailOptOut: true }),
  ],
} as HouseholdView;

const skippedHouse = {
  ...house,
  id: "h2",
  people: [person({ id: "p3", name: "No Email", email: "" })],
} as HouseholdView;

const built = emailRecipientsFor([house, skippedHouse], { subject: "Hello {first name}", email: "Hi {full name} in {state}" });
assert(built.ready.length === 1 && built.ready[0]!.email === "sarah@example.com", "one ready recipient");
assert(built.ready[0]!.subject === "Hello Sarah", `subject ${built.ready[0]!.subject}`);
assert(built.ready[0]!.body.includes("Sarah Cohen"), `body ${built.ready[0]!.body}`);
assert(built.skippedOptedOut === 1, "opted out skipped");
assert(built.skippedNoEmail === 1, "no email household skipped");
const vars = personPlaceholderVars(house.people[0]!, house);
assert(vars.lastName === "Cohen" && vars.email === "sarah@example.com", "recipient vars");
console.log("crm-email-test ok");
