import {
  emailsForCopy,
  fillPlaceholders,
  groupFillVars,
  MAILTO_SAFE_LENGTH,
  mailtoBccHref,
  normalizeUsPhone,
  outreachPeople,
  phonesForCopy,
  smsHrefWithBody,
  whatsappHrefWithText,
} from "../lib/outreach";
import type { HouseholdView, Person } from "../lib/types";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function person(partial: Partial<Person> & { name: string }): Person {
  return {
    id: partial.id ?? partial.name,
    householdId: partial.householdId ?? "h",
    name: partial.name,
    gender: partial.gender ?? null,
    phone: partial.phone ?? "",
    phone2: partial.phone2 ?? "",
    phone3: partial.phone3 ?? "",
    email: partial.email ?? "",
    whatsapp: partial.whatsapp ?? "",
    sortOrder: partial.sortOrder ?? 0,
  };
}

function household(partial: Partial<HouseholdView> & { id: string; name: string }): HouseholdView {
  return {
    street: "",
    city: "",
    state: "ME",
    zip: "",
    country: "US",
    lat: null,
    lng: null,
    notes: "",
    projectId: null,
    projectName: null,
    scheduleCategoryId: null,
    scheduleName: "",
    intervalDays: null,
    categoryIds: [],
    categoryNames: [],
    tags: [],
    customFields: {},
    sharedWithCora: true,
    ownerId: null,
    deletedByShliachAt: null,
    deletedByShliachBy: null,
    deletedByShliachName: null,
    sharedWithBochurim: false,
    visitReaction: null,
    extraAddresses: [],
    possibleDuplicate: false,
    duplicateOf: null,
    duplicateOfName: null,
    duplicateMatchId: null,
    duplicateReason: "",
    canMarkNotDuplicate: false,
    contactVisits: [],
    latestVisited: "",
    latestReaction: null,
    visitCount: 0,
    createdAt: "",
    importBatchId: null,
    people: [],
    lastVisitAt: null,
    lastStatus: null,
    nextDue: null,
    dueState: "none",
    address: "",
    ...partial,
  };
}

const sarah = household({
  id: "1",
  name: "Sarah Cohen",
  state: "ME",
  people: [person({ name: "Sarah Cohen", email: "sarah@example.com", phone: "(207) 555-0100" })],
});
const david = household({
  id: "2",
  name: "David Levy",
  state: "WI",
  people: [person({ name: "David Levy", email: "", phone: "6085550101" })],
});
const noContact = household({
  id: "3",
  name: "No Info",
  state: "NH",
  people: [person({ name: "No Info" })],
});

const people = outreachPeople([sarah, david, noContact]);
if (people[0]?.firstName !== "Sarah" || people[0]?.state !== "Maine") fail(`first contact ${JSON.stringify(people[0])}`);
if (people[0]?.phones[0] !== "+12075550100" || people[0]?.waDigits[0] !== "12075550100") fail(`phone ${JSON.stringify(people[0])}`);

const emails = emailsForCopy(people);
if (emails.addresses.join(",") !== "sarah@example.com" || emails.skipped !== 2) fail(`emails ${JSON.stringify(emails)}`);
const phones = phonesForCopy(people);
if (phones.numbers.join(",") !== "+12075550100,+16085550101" || phones.skipped !== 1) fail(`phones ${JSON.stringify(phones)}`);

const extras = outreachPeople([
  household({
    id: "5",
    name: "Multi Phone",
    state: "ME",
    people: [person({ name: "Multi Phone", phone: "207-555-0100", phone2: "+1 (207) 555-0100", phone3: "207-555-0199" })],
  }),
]);
const extraPhones = phonesForCopy(extras);
if (extraPhones.numbers.join(",") !== "+12075550100,+12075550199" || extraPhones.skipped !== 0) fail(`extra phones ${JSON.stringify(extraPhones)}`);


const filled = fillPlaceholders("Hi {first name}, Chabad of {state} is visiting {state}.", { firstName: "Sarah", state: "Maine" });
if (filled !== "Hi Sarah, Chabad of Maine is visiting Maine.") fail(filled);

const group = groupFillVars(people);
if (group.firstName !== "there" || group.state !== "your area") fail(`group ${JSON.stringify(group)}`);
const sameState = groupFillVars(outreachPeople([sarah, household({ id: "4", name: "Other", state: "ME", people: [person({ name: "Other", email: "o@x.com" })] })]));
if (sameState.state !== "Maine" || sameState.firstName !== "there") fail(`same state ${JSON.stringify(sameState)}`);

if (normalizeUsPhone("207-555-0100")?.e164 !== "+12075550100") fail("10 digit");
if (normalizeUsPhone("+1 (207) 555-0100")?.waDigits !== "12075550100") fail("plus one");
if (normalizeUsPhone("55") !== null) fail("short number should skip");

const mail = mailtoBccHref({ emails: ["a@x.com", "b@y.com"], subject: "Hi there", body: "Line one" });
if (!mail.startsWith("mailto:?bcc=a%40x.com%2Cb%40y.com") || !mail.includes("subject=Hi%20there") || !mail.includes("body=Line%20one")) fail(mail);
if (mail.length > MAILTO_SAFE_LENGTH) fail("sample mailto should be short");

const sms = smsHrefWithBody("+12075550100", "Hi Sarah", "ios");
if (sms !== "sms:+12075550100&body=Hi%20Sarah") fail(sms);
const wa = whatsappHrefWithText("2075550100", "Hi Sarah");
if (wa !== "https://wa.me/12075550100?text=Hi%20Sarah") fail(wa);

console.log("outreach-test ok");
