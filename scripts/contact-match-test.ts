import { compareHasEmail, compareHasPhone, contactHasEmail, contactHasPhone, matchesVisitStatusFilters } from "../lib/contact-match";
import { gmailComposeHref, googleVoiceCopy, isGoogleSender, openEmailHref } from "../lib/outreach";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

const withEmail = { name: "Ann", people: [{ email: "ann@x.com", phone: "", phone2: "", phone3: "" }] };
const withPhone = { name: "Bea", people: [{ email: "", phone: "207-555-0100", phone2: "", phone3: "" }] };
const withPhone2 = { name: "Cal", people: [{ email: "", phone: "", phone2: "207-555-0101", phone3: "" }] };
const withBoth = { name: "Dee", people: [{ email: "d@x.com", phone: "", phone2: "", phone3: "207-555-0102" }] };
const withNone = { name: "Eve", people: [{ email: "  ", phone: "", phone2: "", phone3: "" }] };

assert(contactHasEmail(withEmail) && !contactHasEmail(withPhone) && contactHasEmail(withBoth) && !contactHasEmail(withNone), "email presence");
assert(!contactHasPhone(withEmail) && contactHasPhone(withPhone) && contactHasPhone(withPhone2) && contactHasPhone(withBoth) && !contactHasPhone(withNone), "phone/phone2/phone3 presence");

const byEmail = [withNone, withEmail, withBoth].sort(compareHasEmail);
assert(byEmail.map((row) => row.name).join(",") === "Ann,Dee,Eve", `has email first: ${byEmail.map((row) => row.name)}`);
const byPhone = [withNone, withPhone, withPhone2].sort(compareHasPhone);
assert(byPhone.map((row) => row.name).join(",") === "Bea,Cal,Eve", `has phone first: ${byPhone.map((row) => row.name)}`);

const completed = { visited: "Summer 5786", status: "completed" as const };
const deferred = { visited: "Summer 5786", status: "deferred" as const };
assert(matchesVisitStatusFilters([completed], { visitCompleted: true }), "completed alone");
assert(!matchesVisitStatusFilters([completed], { visitDeferred: true }), "completed fails deferred-only");
assert(matchesVisitStatusFilters([completed], { visitCompleted: true, visitDeferred: true }), "completed OR deferred includes completed");
assert(matchesVisitStatusFilters([deferred], { visitCompleted: true, visitDeferred: true }), "completed OR deferred includes deferred");
assert(matchesVisitStatusFilters([], { visitNotVisited: true }), "not visited");
assert(!matchesVisitStatusFilters([completed], { visitNotVisited: true }), "visited fails not-visited");
assert(matchesVisitStatusFilters([completed], { visitCompleted: true, visitNotVisited: true }), "completed OR not visited");
assert(matchesVisitStatusFilters([completed], { seasons: ["Summer 5786"] }), "season alone requires a visit in that season");
assert(!matchesVisitStatusFilters([completed], { seasons: ["Chanukah 5787"] }), "wrong season");
assert(matchesVisitStatusFilters([deferred], { visitDeferred: true, seasons: ["Summer 5786"] }), "deferred in that season");

assert(isGoogleSender("me@gmail.com"), "gmail.com is Google");
assert(isGoogleSender("me@googlemail.com"), "googlemail is Google");
assert(!isGoogleSender("me@chabad.org"), "other domain is not Google unless marked");
assert(isGoogleSender("me@chabad.org", true), "Workspace when marked");

const gmail = gmailComposeHref({ authuser: "me@gmail.com", emails: ["a@x.com", "b@y.com"], subject: "Hi there", body: "Line one" });
assert(gmail.startsWith("https://mail.google.com/mail/?"), `gmail host: ${gmail}`);
assert(gmail.includes("authuser=me%40gmail.com"), `authuser: ${gmail}`);
assert(gmail.includes("view=cm") && gmail.includes("fs=1"), `compose flags: ${gmail}`);
assert(gmail.includes("su=Hi+there") || gmail.includes("su=Hi%20there"), `subject: ${gmail}`);
assert(gmail.includes("bcc="), `bcc for many: ${gmail}`);
const one = gmailComposeHref({ authuser: "me@gmail.com", emails: ["a@x.com"], subject: "Hi", body: "Body" });
assert(one.includes("to=a%40x.com"), `to for one: ${one}`);

const opened = openEmailHref({ from: "me@gmail.com", emails: ["a@x.com"], subject: "Hi", body: "Body" });
assert(opened.google && opened.href.includes("mail.google.com"), "gmail open");
const mailto = openEmailHref({ from: "me@chabad.org", emails: ["a@x.com"], subject: "Hi", body: "Body" });
assert(!mailto.google && mailto.href.startsWith("mailto:"), "mailto fallback");

assert(googleVoiceCopy("(207) 555-0100", "Hi Sarah") === "(207) 555-0100\n\nHi Sarah", "voice copy has number then message");

console.log("contact match and outreach send-from ok");
