# Changelog

## 1.6.2

- Map shows a pin for every contact. Contacts without saved map coordinates are now looked up by their street address (US Census), or placed at their town center when the address can't be matched. Lookups are remembered, so the map stays fast. Nothing is saved to the contact.
- The map's filter bar now has the same controls as Contacts: state tabs, Sort by (with Tags, Visits and Possible duplicates), Cities, search and All contacts. Hidden tags stay hidden on the map too.
- The old map filters (schedules, categories, projects, Due now) were removed.

## 1.6.1

- The sign-in, sign-up, and reset password screens show the Cora Connect logo, larger and centered, on a clear background.
- Those screens no longer have the reload button or the photo credit line at the bottom.

## 1.6.0

- The admin role is now called Cora Connect admin everywhere: Users, My Team, the dashboard, sign-up, and the waiting room.
- The Users page shows each person's current role as a badge.
- The two role buttons on each row are replaced by Change role. It opens a small chooser for Cora Connect admin or Shliach, with the state picker for a shliach, and asks you to confirm before it changes anything.
- New accounts waiting for approval show the same choice, Cora Connect admin or Shliach with his states, and an Approve button for that choice, plus Reject.

## 1.5.9

- The phone button in the top bar is now Feedback. Tap it to email info@chabadora.com, or call or text 347-770-1863.
- The name card at the bottom of the side bar shows the state you are looking at, such as Maine, and says All states only when all states are showing. The Contacts title follows the same tab.
- The sign-in, sign-up, and reset password screens no longer show the version number and update time. Inside the app it still shows.

## 1.5.8

- Reactions is gone from the Sort by menu. It now has Tags, Visits, and Possible duplicates.
- New Cities menu next to Sort by when a state is picked, such as Maine. It lists every city in that state in A–Z order, with how many contacts each has, and a search box. Tick one city or several. It works together with Sort by, starts at All cities, resets when you change state, and All contacts clears it.

## 1.5.7

- The sort order is back as its own small menu next to Sort by: Name A–Z, Name Z–A, Newest, City, State, or Visited. All contacts sets it back to Name A–Z.
- Sort by now has four choices: Reactions, Tags, Visits, and Possible duplicates. Visits opens a second menu with All visits, Not visited, and each season, newest first.
- The Probably doesn't exist tag is recognized however it is typed, such as probably not existent, probably non-existent, nonexistent, or does not exist. Before, those spellings were dropped on import as an unknown tag. Contacts with that tag stay off the main list and All contacts, the same way Not Jewish contacts do, and show when that tag is picked under Tags.

## 1.5.6

- Tapping an address opens a small menu to open it in Google Maps, Apple Maps, or Waze. It works on the contact page, the contact cards and table rows, route stops, and the map's contact card. When a contact has map coordinates, those are used. Otherwise the full address is used.
- In the contacts table, the Visited column shows every visit, newest first, as small chips colored by reaction. The two newest fit on one line, and a +N chip opens the full list, so rows stay short.
- The contacts page has one Sort by menu instead of several filters: Reactions, Tags, Possible duplicates, All visits, and each season from the projects list, such as Chanukah 5787 and Summer 5786. Choosing Reactions or Tags shows a second menu to pick which one. The All contacts button next to it clears every filter and the search and shows everyone. Removed visits don't count.
- Export moved to the top right, next to Import and New contact.
- A contact added or imported with Visited left blank counts as Not visited. Sort by has a Not visited choice that lists contacts with no visit, or only visits with a blank Visited. Those contacts show Not visited in the Visited column and on their card, and they are not counted in All visits or in visit counts.

## 1.5.5

- Every visit in Visit history can be removed, including a visit logged from the Visit button that only shows on Reports and an old visit saved on the contact itself. The trash button shows for anyone who can edit that contact and for the person who logged the visit.
- Removing a visit also takes it off Reports and the dashboard. Undo brings it back everywhere.
- Removing an old visit saved on the contact clears its Visited, reaction, and notes on that contact. Undo puts them back.

## 1.5.4

- A single visit can be removed from a contact. In Visit history, each visit has a trash button. It asks "Remove this visit?" before removing it, and you can undo it right after. The person who logged the visit and anyone who can edit that contact can remove it. The visit is hidden, not erased.
- The Cora Connect logo in the left side bar fills the full width of the bar.

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
