import { isRemoteUpdate, shouldTrackField } from "../lib/app-update";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(shouldTrackField("input", "text", true), "a text field in a form is unsaved input");
assert(shouldTrackField("textarea", "", true), "a textarea in a form is unsaved input");
assert(shouldTrackField("select", "", true), "a select in a form is unsaved input");
assert(shouldTrackField("input", "checkbox", true), "a checkbox in a form is unsaved input");
assert(!shouldTrackField("input", "text", false), "search and filters outside a form are not unsaved input");
assert(!shouldTrackField("input", "search", true), "a search field is not unsaved input");
assert(!shouldTrackField("input", "hidden", true), "a hidden field is not unsaved input");
assert(!shouldTrackField("input", "submit", true), "a submit button is not unsaved input");

assert(!isRemoteUpdate("dev", "abc123"), "local dev does not nag for an update");
assert(!isRemoteUpdate("abc123", "abc123"), "the same build is current");
assert(!isRemoteUpdate("abc123", ""), "a missing remote build is not an update");
assert(isRemoteUpdate("abc123", "def456"), "a different deployed build is an update");

console.log("reload ok");
