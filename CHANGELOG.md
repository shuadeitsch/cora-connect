# Changelog

## 1.8.1

- Possible duplicates now have a Not a duplicate button. It's on the badge in the list, in the table, in the Possible duplicates sort and on the contact page. Pressing it clears the flag and remembers that the two contacts are different. Future imports and the duplicate matching skip that pair. The toast has Undo.
- The link to the other contact stays on the note.
- Admins can use it, and so can anyone who can edit the contact. A shliach can use it only on his own contacts. Bochurim can't. The database enforces this.
- New duplicate rule: two contacts are flagged only if they share an address (street and city), a phone or an email. A matching or similar name alone no longer flags them when both have different addresses. A name match still flags when one of them has no address. This applies to imports and to the suggested closest match.
- Cleaned up existing flags: cleared the possible-duplicate flag on 7 contacts whose only match was the name, with different addresses. Every flag that shares an address, phone or email was kept.

## 1.8.0

- New account types: Shliach and Bochur. The database enforces the rules, not just the screens.
- Shliach: sees and edits contacts in his own state, plus his own contacts and his bochurim's. He can add and update visits. He can't delete contacts, import or export. Routes and map pins show only his contacts. He sees his own routes and his bochurim's.
- Bochur: a Cora Connect admin approves him first and picks his shliach. Then the shliach approves him in My Team. His access lasts one month from that approval. In My Team his shliach can tap Extend 1 month or Disable at any time.
- A bochur starts with nothing. His shliach selects contacts in the list and taps Share with bochur. On a shared contact the bochur sees everything, including earlier visits by others, and can log visits. He can't edit contact info. Unsharing hides that contact from him again. He can build routes only from shared contacts.
- Expired or disabled accounts can't see anything.
- Cora Connect admins keep the same access as before.

## 1.7.10

- Map, Routes and Daily planner are now main items in the side bar, above More, so you no longer have to open More to find them. On phones, the bottom bar reads Contacts, Map, Routes, Planner, More.
- Possible duplicates now say why they were flagged, for example "Same address and name as Dr. Alan Hymanson". You can tap the other contact's name to open it. If the import didn't record a match, the note says "Flagged on import" and names the closest match.
- Daily planner: new one-tap "Add day before" (top) and "Add day after" (bottom) buttons fill in the date and show its Hebrew date. When the planner is empty, "Add day" adds today. You can still type any other date at the top.

## 1.7.9

- Contacts: the color of a visit chip (like "Summer 5786") now shows only how the visit went, for every project. Green with a check means the visit was completed. Red with a crossed circle means it was deferred. Gray with a dash means no status was saved. The same colors are used in the Visited column, the phone cards, the contact page, and Visit history.
- Reactions keep their own colors, so they never look like a visit status. Very happy is now purple, and Very cold / angry is now pink.
- Editing a contact no longer changes a visit with no status into Completed.

## 1.7.8

- Phones: Routes > Build on map now uses the whole screen for the map. The page header and the bottom menu are hidden on this screen. Use the back arrow to leave.
- One small bar at the bottom has Tap pins / Draw box, how many are selected, Create route (once you pick someone), and a ⋯ button.
- ⋯ opens a sheet with search, state, Sort by, tags, cities, List (contacts with checkboxes), Select shown, Undo last, Clear selection, and Show hints. Close it with the X, a swipe down, or a tap on the map. Picking Tap pins or Draw box there closes it right away.
- The hint is now a short line at the top that you can close with its X.
- The New route box opens at the bottom of the screen with big buttons.
- Map page on phones: the filters and the map key moved behind a ⋯ button, so the map is not covered.
- Computers, tablets and Chromebooks look the same as before.

## 1.7.7

- Fixed: on Build on map, pressing Create route opened the "New route" box behind the map, so you could not see it. The next tap closed it and nothing was saved. The box now shows on top of the map on phones, Chromebooks and computers.
- Saving a route now says "Route saved" and opens the route. The app only does this after the route and all its stops are really saved. If anything goes wrong, you get a clear red message and stay on the same step, so you can try again.
- Delete all on the Routes page now says how many routes it will delete for everyone. It is hidden when there are no routes.

## 1.7.6

- Build on map: picking pins and drawing boxes now works with a mouse, a finger, or a pen, including Chromebook touchscreens. Pins are bigger and easier to hit, and a slightly shaky tap still counts.
- A short line under the buttons says what to do: "Tap pins to add them" or "Drag on the map to draw a box".
- New List button shows every contact on the map with a checkbox, so you can add people even without touching the map. It opens beside the map on big screens and above the buttons on phones.

## 1.7.5

- Fixed: on Routes > Build on map, clicking or tapping a pin sometimes did nothing. This happened when the pins were redrawn during the click, for example when more addresses finished loading. Quick taps on two pins could also zoom the map instead. Picking a pin now always works. Draw box selects what is inside the box and adds to what is already picked. The map stays still while you draw, with a mouse or a finger.
- Routes page: new Pick contacts button, next to Build on map and New route by city. Filter by state, Sort by, Cities, or search. Tick the contacts you want, or Select all shown, then Create route.
- The main Map page no longer creates routes. The Create Route button, the route panel, and the Add to route buttons on pins are gone. The Map page is for looking. To make a route, go to Routes.

## 1.7.4

- Build on map now has two clear modes you switch between: Click pins and Draw box. Click pins adds or removes one contact at a time. Draw box selects everyone inside the box you drag. The map stays still while you draw, with a mouse or a finger. Each new box adds to what is already selected. In Click pins mode, hold Shift and drag to draw a box too.
- Daily planner events can now have an address (optional). Tap the address to open it in Google Maps, Apple Maps, or Waze.

## 1.7.3

- Projects are now only Summer 5786, Chanukah 5787, and Unsorted (no project), everywhere they are listed or chosen: the Visits menu under Sort by, the visit form, new route dialogs, import, settings, and route labels. Contacts, visits, and routes tied to any other project show as Unsorted. No data was changed.
- Users page: a clear list of everyone who can use Cora Connect, with name, email, account type (and a shliach's states), status (Approved, Pending, Disabled, Expired), and expiry date. It opens on Everyone when no one is waiting.
- My Team (admins): a Shluchim list. Tap a shliach to see the people under him, with email, status, and expiry. Shows "No shluchim yet" when there are none.
- The Feedback button in the top bar is now just an icon. It offers one option: Call 347-770-1863.

## 1.7.2

- New Daily planner in the side bar. Each day shows the date and the Hebrew date (for example, Saturday, December 5, 2026 · 25 Kislev 5787). It starts with Dec 5 to Dec 11, 2026.
- Admins can add a day (pick a date), remove a day, and add or remove saved routes and events on any day. Events have a title, an optional time, and notes. A route on a day links to the route.
- Everyone approved in Cora Connect can see the planner.
- Database migration `015_daily_planner.sql` adds two new tables (planner days and planner items). Existing tables and access are unchanged.

## 1.7.1

- Fixed: saving a new route failed with "new row violates row-level security policy" for everyone, so Build on map, Build route from Contacts, and New route by city never saved. New routes are now saved in a way the database's access rules accept. No access rules were changed.
- If a route can't be saved, the message now says why in plain words (no access, connection dropped) instead of the database error.

## 1.7.0

- An invite now approves the person automatically when they create their account. The role, permissions, and shliach territory chosen on the invite are applied right away. No extra step on Users.
- My team invite offers Cora Connect admin or Shliach (with states, and optional areas). Visitor and Limited stay available. The confirmation text no longer says to wait for approval.
- Sign-up and sign-in copy match the new invite flow. Allowlisted emails without an invite still wait for approval. Preapproved admins are unchanged.
- Database migration `014_invite_auto_approve.sql` stores invite territory and updates `sync_profile_from_auth`.

## 1.6.3

- Three ways to make a route, and each one is saved by name in Saved routes:
  - Build on map (Routes page): the map with the same filters as Contacts. Tap pins to pick or unpick them, or turn on Select area and drag a box around several. The tray shows how many are selected, with Select shown and Clear. Then Create route, name it, and save.
  - From Contacts: tick contacts and choose Build route. Name it, save, and the route opens.
  - New route by city (Routes page): pick a state tab and a city (with counts). The route gets every contact in that city that shows on the contact list.
- New routes are put in order nearest-first from your start point, using the same map points as the Map page.
- Start route on a saved route: type a starting address or tap Use my location. The app works out the quickest stop order from there and lists it. Then Open in Google Maps (long routes are split into parts of 10 stops, with Next leg), or Open in Apple Maps one stop at a time with Next stop. Save this order keeps the new order on the route.
- Saved route maps now show pins for every stop.


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
