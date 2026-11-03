# Changelog

## 1.5.3

- The logos swapped places. The top bar shows the Cora logo, and the left side bar shows the Cora Connect logo.

## 1.5.2

- The "Photo of 770" link is gone from the bottom of the side menu and the More menu. The photo credit stays on the /about page.

## 1.5.1

- Signing in works again. Since 1.5.0 the app stopped with an error right after login because it sorted route assignments by a column that table does not have. It now sorts them by route and user.

## 1.5.0

- Contacts can be filtered by tag. Probably doesn't exist is one of the choices, and choosing it lists those contacts even though they stay off the main list until then.
- The top-left header uses the CRM logo from public/crm-logo.jpeg. The sign-in card and the home-screen icon stay the Cora logo.
- Spreadsheet import reads a reaction column named Reactions, Reaction:, or Reaction when visited, and keeps Very happy, Warm, Neutral, Cold, and Very cold/angry when the cell differs only by case or spacing.
- A visit logged from the Visit button shows in that contact's history as soon as it is saved, and again after a reload.
- Visited is chosen as a season (Summer, Chanukah, Pesach, Tishrei, Purim, or Other) and a Hebrew year. It is still the same Visited text, stored as "Summer 5786".

## 1.4.3

- Spreadsheet reactions Happy, Warm, Neutral, Cold, and Not interested are kept. N/A stays blank. A later row for the same visit fills a reaction that was missing.
- Logging a visit writes it into that contact's visit history, so it shows up as soon as it is saved.

## 1.4.2

- The Tagged filter includes Probably doesn't exist when the apostrophe is curly or missing, and when it was typed as probobly dosent exist. Stored tags that match are rewritten to the official wording. Other tags and notes stay as they are.
- The top-left header uses the Cora Connect mark. The sign-in card and the home-screen icons are unchanged.

## 1.4.1

- The full-size Cora logo and desktop 770 background are back, and the 192 and 512 app icons load again.

## 1.4.0

- The import template and the copy-paste instructions no longer include Share with Cora. A new import uses the app's default sharing. An older file that still has that column still imports.
- Contacts can be tagged Not Jewish or Probably doesn't exist. Tagged contacts stay off the main list and show under Tagged, with a badge. Search and duplicate checks still find them. Opening or starting a route lists tagged contacts on that route or in the same town.
- Each visit has a status, Completed or Deferred. A blank or unrecognized status is Completed. Maine import notes that say Summer 5786 (date): Deferred were copied onto deferred visits. The original contact notes were left as written.

## 1.3.0

- Reload sits next to the version badge, including in the installed app where the browser has no reload button. It checks the service worker, activates a waiting update, clears stale caches, and reloads.
- When a newer deploy is on the server, the button reads "Update available". Reloading asks before discarding unsaved form edits.
- A contact's notes are labeled with the visit they belong to, including the visit date when there is one. Notes that were only stored on the contact, not on a visit, show as Summer 5786. The stored text is unchanged.

## 1.2.0

- Unsorted is a fourth state next to Maine, Wisconsin, and New Hampshire, on the admin tabs, the contact form, and shliach territory choices.
- The Unsorted tab also lists contacts with a blank state or a state that is not a US state. Contacts already stored as Maine, Wisconsin, New Hampshire, or another US state are left as they are.

## 1.1.1

- CSV import inserts a contact before any row that points at it with duplicate_of, so an exact duplicate in the same file no longer fails households_duplicate_of_fkey.
- A row that was saved is not reported as an error. The import summary keeps the counts from that save.

## 1.1.0

- Version badge in the header and on the sign-in card, with the update time in Eastern Time.
- Owner logo on the sign-in card, header, and sidebar. The green O is the app icon.
- A contact can hold many visits. The list shows the latest visit and a count. Follow-ups are no longer shown.
- Spreadsheet import keeps every row. A row becomes an extra visit only when it is the same person and a different Visited value. Other rows become their own contacts, flagged when they only loosely match.
- Delete several contacts at once, then undo to restore them and their visits.
- Chromebook recovery: public health and debug pages, a reset that clears the service worker, and a lighter background on smaller screens.
