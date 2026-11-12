# Changelog

## 1.8.54
- Possible duplicates are found by scanning the live book when it loads, not only during CSV import. Contacts are flagged for a same or similar address (same house number, with street suffixes and spaces normalized), the same phone (including Phone 2 and Phone 3), the same email, or a similar name after titles like Mr./Mrs./Dr. are ignored, with typo tolerance and common nicknames. Each match shows the reason (for example, same address, similar name, same phone). Soft-deleted contacts and pairs marked **Not a duplicate** are skipped. Visibility still follows RLS by state. Nothing is merged or deleted. Import uses the same matcher.


## 1.8.53
- Bot-written contact notes now display as **CORA Connect note**, not **Grok note**. New notes are prefixed with `CORA Connect note:`. Existing `Grok note:` lines are still recognized and shown with the same CORA Connect note label, not as a Summer 5786 visit or project.


## 1.8.52
- Contact-level notes written by Grok now display as **Grok note**, not as a Summer 5786 (or other project) visit. They stay on the contact, not in visit notes. Each `Grok note:` line is shown as its own note. Existing user-written contact notes are unchanged and still appear as Summer 5786 when they were never copied onto a visit. Going forward, notes the bot adds are prefixed with `Grok note:`.


## 1.8.51
- Contacts have **Phone 2** and **Phone 3**. These are nullable columns `phone2` and `phone3` on `public.people` (the same table as the existing `phone` field). They appear on the contact form and contact detail, in the admin Contacts CSV export, and in the import template (`phone`, `phone2`, `phone3`). The Text / WhatsApp composer and **Copy all phone numbers** include every number, deduped and normalized to +1. Bochurim see them when they can already see phone numbers (the `people_visible` view still redacts them when `can_view_contact()` is false). RLS on `people` is unchanged. `change_log` already records `people` as JSON, so the new columns are captured. Beta practice still does not write to the database.


## 1.8.50
- Text / WhatsApp composer (admins and shluchim, including Beta **View as shliach**): **Send through Twilio** opens https://www.twilio.com/try-twilio in a new tab. A short note says anyone can make their own account: “Want to send texts from your own number? Make a free Twilio account, then ask Cora to connect it.” Sending is not built yet. A server flag checks whether `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` are set, so this button can later switch to real sending without a redesign. Those env vars are not set today.
- Settings (Account) for admins and shluchim gets a small **Texting (Twilio)** card: status **Not connected**, a **Create a Twilio account** link to the same page, and the same note. No fields for keys or tokens. Bochurim do not see the button, the note, or the card (including View as bochur).


## 1.8.49
- **Bulk outreach from Contacts**, for admins and shluchim (not bochurim; Beta **View as shliach** works in practice, with no database writes). A sticky bar has the selected count, **Select all** (current filters), **Clear**, **Email**, and **Text / WhatsApp**. Checkboxes stay available for other roles that already used them (for example a bochur building a route).
- Email composer: four editable templates (visit announcement, including “Hi {first name}, Chabad of {state} is sending yeshiva students to visit {state}…”, plus Chanukah/holiday visit, follow-up thank you, and “we're in the area”), with `{first name}` / `{state}` placeholders. **Copy draft**, **Copy all email addresses** (comma-separated, with a skip count), and **Open in email app** (mailto with BCC; a warning if the link is too long). Sending from the CRM is not built yet — admins see a short “Send from CRM coming soon” note. There is no email provider configured.
- Text / WhatsApp: the same templates in a shorter form, plus **Copy message**, **Copy all phone numbers**, and per-contact **SMS** (`sms:` with the body) and **WhatsApp** (`wa.me`) buttons. US numbers are normalized to +1. Contacts without a phone or email are skipped and counted.
- The **Help me write** AI helper is not in this release. Vercel has no working provider key (AI Gateway reports that a credit card is required), so the button is left out until that is set up.


## 1.8.48
- Bochurim can no longer download a CSV, including in Beta **View as bochur**. The Home Visits **CSV** button, Contacts **Export**, Reports **Download** (legacy page), and the Import **Download template** control are hidden for that role. Admins and shluchim keep their existing exports: Contacts Export stays admin-only; Home (and Reports) CSV stay available to admins and shluchim. Every export now goes through a server action / `/api/export`, which returns 403 for a real bochur or View as bochur.


## 1.8.47
- Beta practice: shliach sharing now carries over into **View as bochur** for the same state. The Settings default (“Share new contacts with bochurim by default”) is the baseline, and each contact’s **Share with bochurim** checkbox overrides it. Sharing on shows the contact to the bochur; sharing off hides it. All of this stays in sessionStorage; **Reset** clears it; Exit does not. The practice banner has a same-state View as bochur / View as shliach switch, shows the state for both roles, and the Beta page remembers the last state you picked so Exit → open the other role keeps the same territory.


## 1.8.46
- Home Visits first tile: **Include removed** checkbox next to Include deferred, remembered per user (off by default). When it is on, the denominator is the full live book (`deleted_at IS NULL` only, 155) and the 10 removed contacts (Not Jewish / Probably doesn't exist) count in X as visited. The “Excluding 10…” helper is hidden. When it is off, the tile stays `X of 145` with the helper, as in 1.8.44.


## 1.8.45
- **Chavrusos.** Once a shliach has 4 or more bochurim, Settings → My Team gets a Chavrusos section to assign each bochur to A or B (or leave him unassigned). Assignments go through a security-definer RPC (`set_bochur_chavrusa`); only that shliach or a Cora admin can change them. A bochur cannot change his own assignment.
- Daily planner has an All / Shared / Chavrusa A / Chavrusa B switch. Existing days stay **shared** (`chavrusa` is null) and remain visible to both groups. New days created while on A or B are tagged to that group; All and Shared create a shared day. A shliach can retag a day. Bochur A sees A + shared; bochur B sees B + shared; an unassigned bochur sees only shared. Per-day “can see” / “can edit” still apply.
- `planner_days` unique key is now `(org_id, date, chavrusa)` with null treated as shared, so A, B, and Shared can each have the same date. Mendel’s existing 13 days were not rewritten — only the new nullable column was added (all remain shared). Items follow their day.
- RLS uses `my_chavrusa()` (no self-referencing policies). Write policies are INSERT/UPDATE/DELETE only, so a hidden-but-editable day no longer leaks into a bochur’s SELECT. Works in Beta practice as shliach (example bochurim if he has fewer than 4) and as bochur (Viewing as Chavrusa A/B).


## 1.8.44
- Home Visits counts only **live** households (`deleted_at IS NULL`). Soft-deleted contacts no longer inflate the first tile (the 443 figure included 298 deleted rows). The active denominator is live minus tagged removed (`155 − 10 = 145`). X is unique live, non-removed households with a completed visit, plus deferred when Include deferred is on. The same `deleted_at` filter applies to New contacts found, Removed, activity tiles, and the people list. Shliach soft-hidden contacts stay hidden from that viewer. Load queries `deleted_at IS NULL` so a missing field cannot leak deleted rows.


## 1.8.43
- Tutorial step 10 (Log a visit): the pen on the first contact now has `data-tour` in both card and table views, the tour waits about 2 seconds for the list to render, and the copy is “Tap the pen on any contact to log a visit.” Other steps audited for every role — bochur “Suggest edit” is now on the first contact in the list (it was only inside a closed contact card).
- Optional **Practice mode** toggle on the Tutorial intro and in the tour bar, for every role. When it is on, each step can be done against a local sandbox of example contacts (not real data), reusing the practice overlay and `assertNotPreview` (sandbox cookie) so no write reaches the database. Banner: “Practice mode: nothing you do here is saved.” Detected actions show “Nice, you did it!” Exiting the tutorial or turning practice off clears the sandbox.
- Home Visits first tile uses the **active** denominator (`X of 145`). X excludes removed contacts. Helper: “Excluding 10 which were removed (not Jewish or doesn't exist)”, with the live count. Include deferred still applies. Other tiles have no helper note.
- Shliach planner defaults stay in sync: Settings and the Daily planner both have “Bochurim can see the planner” and “Bochurim can edit the planner.” Toggling either side sets every existing day's per-day checkbox to match, then a day can still be changed individually. The Settings edit toggle had only saved the pref and left planner days unchanged. Same write-through in Beta practice as shliach (and Tutorial practice).


## 1.8.42
- Shliach-facing checkboxes no longer appear in the normal Cora **admin** UI. “Share with bochurim” is gone from Contacts list, cards, contact detail, and the edit form. Daily planner no longer shows “Bochurim can see the planner / this day” or “Bochurim can edit this day.” Settings defaults (share new contacts, bochurim see/edit the planner) stay shliach-only, as before.
- Those controls belong only to the **shliach** role, including Beta **View as shliach**. In practice mode, toggles take effect immediately in **View as bochur** (contact appears or disappears, planner day shows or hides, edit is allowed or blocked). Practice state stays in sessionStorage across switching views and Exit until **Reset**.
- Admin Tutorial drops the Share with bochurim step (18 steps; shliach 18, bochur 14). Planner and Beta copy point admins to View as shliach for those checkboxes.
- **Beta is Cora-admin only** until launch. It does not appear in the sidebar or mobile More sheet for shliach or bochur; visiting `/beta` redirects them to Home. Shliach and bochur tutorials have no Beta step. User-facing copy those roles can see no longer mentions Beta (including the shliach Share with bochurim tutorial line).
- Home Visits tiles: drop the small helper note (“out of N · excludes R removed…”) from **New contacts found** and **Removed: not Jewish / not existent**. Only the first **Visits** tile keeps that helper.


## 1.8.41
- Optional **Tutorial** under More (sidebar and mobile More sheet) for every role. Never auto-shown.
- Guided walkthrough of the real CRM, with separate steps for admin, shliach, and bochur. Spotlight + Next/Back/Exit and “Step X of N”; fallback card if a control is off screen. Read-only — no data changes, example text only.
- Resume: `profiles.tutorial_step` / `tutorial_done` (migration 038) plus localStorage fallback. Exit midway and the tab continues there; Start over is offered.

## 1.8.40
- Home Visits people list: default page size **10** (newest first); pager unchanged. Contacts page stays at 25.

## 1.8.39
- Home Visits people list: only **completed** contacts by default; **deferred** rows appear only when Include deferred is checked (same checkbox as the coverage tile). Removed/tagged contacts never appear in the list.

## 1.8.38
- Home Visits: restore **Include deferred** under the coverage tile (localStorage, default off). Remove separate Completed/Deferred tiles. Keep 1.8.37 active-denominator helper text on the **first three** tiles only (Visits, New contacts found, Removed). People list paginates like Contacts (25 default; 10/25/50 + shared Pager); green/amber status colors kept.
- Maine Summer 5786: fill `visited_by` = “Mendel Baitelman & Mendele Lustig” on remaining rows (deferred + any still blank); notes untouched.
- New visits: BEFORE INSERT trigger + SECURITY DEFINER helper auto-snapshots `visited_by` from the contact’s state shliach’s assigned bochurim (project-matched), including the logger if a bochur; else logger name. Format `A & B` / comma for 3+. Blank/editable in the visit form; existing rows unchanged.

## 1.8.37
- Home Visits tile math (Mendel): first **Visits** tile = touched (completed + deferred + removed tags) out of **full** total including removed. Dropped Include deferred toggle. **Completed** / **Deferred** tiles show `X of active`; every tile after Visits shows helper `out of N · excludes R removed (not Jewish / doesn't exist)`. Activities, new contacts, removed unchanged otherwise; All projects + state filters respected.

## 1.8.36
- Home: **All projects** back at the top of the project filter (default stays the current/most recent project). Bochur stays locked. Under All projects, tiles and people list aggregate across projects; people list newest-first, one row per person with latest visit.
- Activity tiles / visit dialog chips / people-list activities: Challah 🍞, Menorah/package 📦, Tefillin = small inline SVG (box + straps); Mezuzah and Write-in keep existing icons.
- (Include deferred toggle shipped briefly; replaced in 1.8.37 by revised Visits tile math.)

## 1.8.35
- Home › Visits: **Removed: not Jewish / not existent** tile (count from Not Jewish / Probably doesn't exist tags); tap opens Contacts tagged view. Delete contact offers removal reasons (tag vs hard delete).
- Home › Visits: status tile **Completed X / Deferred Y**; people list includes deferred; green/amber row colors + legend.
- Beta: practice sandbox — View as shliach/bochur checkboxes, toggles, and buttons are interactive; changes stay in sessionStorage only (never the DB). Banner: “Practice mode: changes here aren't saved.” Reset button. Live effects (unshare hides contact in View as bochur; planner day visibility/edit updates).

## 1.8.34
- Visits: `visited_by` on contact history. Maine Summer 5786 visits set to “Mendel Baitelman & Mendele Lustig” (notes untouched). Shown as Visited by in contact form, visit history, and Home Visits people list.

## 1.8.33
- Audit/backup: `public.change_log` + SECURITY DEFINER triggers on user-data tables (insert/update/delete). Admins can read; clients cannot write. Shliach soft-hide unchanged; hard deletes logged. Restore how-to in `docs/RESTORE.md`.

## 1.8.32
- Home › Visits: **New contacts found** tile (after `NEW_CONTACTS_SINCE`, no imports), scoped by project + admin state; tap opens Contacts filtered to those. `created_by` / `created_at` set on every household add path.
- Shliach: **My Team** moves into Settings (tab); removed from sidebar / mobile menu; `/team` redirects to Settings. Admins keep `/team`. Applies in Beta View as shliach.

## 1.8.31
- Home › Visits: drop All projects — a project is always selected (current/most recent; bochur locked). Visits tile shows unique contacts visited in that project out of visible contacts (e.g. `40 of 155 contacts`) with a progress bar; activity tiles and people list follow the project. Admin All states still OK.

## 1.8.30
- Admin version badge: compact inline pill (white, w-fit) hugging `v1.8.30 · Nov 9, 6:20 PM` — no longer stretches full width in the header.

## 1.8.29
- Settings › Theme: checkbox **Match colors to my photo** next to the background upload. Client canvas sample (no new deps) pulls dominant/accent colors, panel tint, overlay strength, and light/dark from the picture; WCAG contrast kept for text and buttons. Saved on the profile with the theme; uncheck returns to the chosen preset.

## 1.8.28
- Settings › Theme: upload your own full-page background photo (every role, including bochur Account-only). Client resize to ~1920px JPEG, stored in `backgrounds/<uid>/…` with own-only Storage RLS; URL on `profiles.background_url`. Cover render with a light overlay; Remove photo returns to the preset.

## 1.8.27

- Home: Dashboard renamed to Home everywhere; first item in the sidebar. `/dashboard` still works.
- Mobile: bottom-nav More sheet lists every sidebar item (Home first, My Team, Settings, Map, Beta) in desktop order.
- Visits box: people list reads from contact history (the visits log was soft-deleted). Activity tiles always show, including 0.
- Feedback: admins can delete messages (confirm + multi-select); RLS `feedback_delete` via `is_admin()`.

## 1.8.26

- Dashboard: one combined **Visits** box (activity tiles + people list). Activity tiles always show Tefillin, Menorah/package, Mezuzah, Challah, Write-in, and Total — including 0. Bento layout: compact stat tiles, wider content boxes. Separate Visit activities box removed.

## 1.8.25

- Planner: “Let bochurim edit the daily planner by default” + per-day “Bochurim can edit this day” (RLS via `editable_by_bochurim`).
- Bochur contacts: live RLS now requires share **and** shliach territory (both live RLS and Beta preview were wrong before). Beta “View as bochur” has a state picker and filters client-side like shliach.
- Bochur dashboard: personal tiles — people he visited, his activity totals, new people he found (`households.created_by`, default `auth.uid()`; visits already had `created_by`/`visitor_id`). Reports + activities unchanged.
- Bochur visit edit/delete: only visits tagged with his `project_id` (new column on `visits` / `contact_visits`); other projects read-only; cannot delete contacts.
- Suggested contact edits: bochur “Suggest edit” → pending rows; shliach/admin Dashboard “Suggested edits” with Approve/Reject (RLS + security-definer apply/reject).
- Share with bochurim: quick checkbox on every contact card/row and on the contact detail/edit form (was only buried in the edit form as “Shared with bochurim”); defaults from Settings; read-only in Beta.
- Admin Feedback: shows sender name, role, state, email, and date via `feedback_admin_rows()` (older rows without a sender show Unknown).

## 1.8.24

- Planner: shliach pref “Bochurim can see new planner days by default” (default on); per-day “Bochurim can see this day”; top-level “Bochurim can see the planner” syncs all days + Settings. Bochur Daily schedule shows only visible days (RLS).
- Dashboard: shared Project (+ State for admin) filter bar; Reports (Recently visited, Visited column, CSV) + Visit activities for every role; admin also keeps Feedback and Households by state. Sidebar Reports removed; `/reports` redirects to Dashboard.
- My Team: one Cora admins & approvals box (admins no longer duplicated on the roster).

## 1.8.23

- Bochur dashboard: project visit count plus locked Reports table and activity totals for his project (no project dropdown).
- Merge Users into My Team (single nav); `/users` redirects. Admins get team list + approvals/invites, then Participating bochurim, then Shluchim. Shliach sees only his bochurim. Bochur has no My Team. Reflects in Beta.

## 1.8.22

- Shliach soft-hide contacts (admins still see + filter/restore); share contacts with all bochurim; shliach prefs for default share and “Let bochurim edit the planner”.
- Bochur Daily schedule in nav (view-only unless shliach toggle is on) with Google/Apple Maps start links; Settings is Account-only for bochurim.
- Bochur signup project + My Team project picker; dashboard Reports + visit activity totals; visit activity chips on the visit dialog.
- Profiles RLS uses `my_leader_id()` (no recursive profiles subqueries). Migration 024/025.

## 1.8.21

- My Team: the main team list stays at the top. Participating bochurim and Shluchim now sit below it.

## 1.8.20

- Beta (admins only): a Beta page under More in the sidebar (and under More in the phone avatar menu). Open a read-only copy of the whole app as a bochur, or as a shliach for a picked state (Maine, New Hampshire, or Wisconsin). A banner with Exit stays on screen; every write is blocked with "Preview only". Role views come from the same present() path used live.
- Map and Beta sit in a More group at the bottom of the sidebar. On phones they are under More in the avatar menu.
- Feedback (all roles): the top-bar Feedback button no longer shows a phone number. You type a message and press Send. Messages save to a new feedback table. Admins see a Feedback card on the Dashboard (newest first, with mark read and archive). Shluchim and bochurim do not see that card. Feedback is read-only in Beta preview.
- Sign up: a required State dropdown (Maine, New Hampshire, Wisconsin). The state is saved on the profile territory so a shliach only sees that state. RLS already scopes by territory.

## 1.8.19

- Dashboard (all roles): "Visits over time" and the shliach "Bochurim visits" card are gone. "Recent visits" shows all of today's visits (America/New_York), newest first, scoped by role, with an empty state.
- Admin Dashboard: Visit reactions and the More box are gone.
- My Team: a prominent "Participating bochurim" box at the top.
- Settings > Chabad house: start latitude/longitude and Map starting state are hidden. Stored values stay for Plan a trip.

## 1.8.18

- Plan a trip: saving is sturdier. If a save fails (for example because Cora Connect was updated while the page was open) you now get a clear message instead of nothing, and your plan is kept so you can reload and save again. New "Save all days as routes" button.
- Plan a trip: each day's route name is editable, with a default like "Chanukah 5787 · Day 1 · Kennebunkport, Biddeford".
- Plan a trip: times are optional. Untick "Fit between times" (or leave minutes per visit blank) and Cora just orders the stops and shows drive times, with no leave or arrival times.
- Plan a trip: choose any number of days from 1 to 14.
- Dashboard for shluchim and bochurim: removed Households by state, Recent visits, Visit reactions and the More box. "Visits over time" is now "Bochurim visits", a list of every visit your bochurim logged, newest first.
- Settings, Reports, My Team and Log out are in the side bar on computers and in the picture menu at the top on phones.
- "New contacts" counts only contacts added by hand from now on (not existing contacts, not imports).
- A short line under each page title says what the page is for.
- Settings > Account > Theme: pick Classic green, Ocean blue, Warm sand, Royal purple, Soft light or Dark mode. It's saved to your account.

## 1.8.17

- Settings > Account: add, change or remove your profile picture. It is cropped to a square and shows in the side bar, the top bar on phones, and My Team. Each person can only change their own picture.

## 1.8.16
- Saved routes: a "Plan a trip" button. "Delete all" is gone. Tick routes (on phones, tap Select first) and use "Delete selected (N)"; it asks first and lists the route names. There is no select-all. The main buttons are all the same green.
- Reports: the Scheduled column is gone. A new Visited column shows the projects each contact was visited for (completed visits), and it's in the download too.
- My Team: the Bochurim section always shows for admins ("No bochurim yet" when empty), with each bochur's status, expiry, Extend/Disable, and the shliach he is under. Admins can change his shliach.
- Dashboard for shluchim and bochurim: "New contacts per project" and "Visits per project" cards with a project picker (All or one project), remembered on this device. The households-added, visits-this-month, routes and team cards, Quick actions and Top categories are gone.
- Dashboard for Cora Connect admins: the same two cards with Project and State filters, plus a breakdown table (states × projects, or flipped) for visits or new contacts, with totals. Tap a number to set the filters.
- Navigation: "More" is gone. Dashboard is in the side bar and the phone bar. Reports, My Team, Users, Settings and Log out are in a "More" box at the bottom of the Dashboard; Settings is also in the side bar. Bochurim get Reports and Settings in their phone bar.
- The bell and the gear are gone from the top bar.
- Only admins see the version and "Updated" time.
- Settings: the Categories, Projects and Custom fields tabs are gone (nothing was deleted). Organization and Chabad House name are now one field: "Chabad of [state]" (admins can pick Cora). Log out is on the Account tab.
- The side bar logo has a clear background now.

## 1.8.15
- New "Plan a trip" (Saved routes → Plan a trip): pick cities (sorted by distance, plus nearby stops within a slider distance), 1–5 days with dates, a start place (the Chabad House or the last place you used, or type one), return to start, minutes per visit, and a start or finish time per day.
- Add extra stops or events (like a menorah lighting) with an address and an optional fixed time and day. The day is planned around the fixed time.
- Pick a project; contacts already on another route in that project are skipped unless you choose "Include anyway".
- Each day shows when to leave, arrival times, miles, driving time, sunset, and warnings, with a small map. Move a stop to another day or remove it and the day is recalculated. Save a day as a route, add it to a planner day, or open it in Google Maps (in parts).

## 1.8.14
- Daily planner: when adding a route to a day (or changing an item to a different route), routes already planned on another day say so in the picker ("Already planned · Fri, Dec 4"). Picking one shows "This route is already on Fri, Dec 4" with Add anyway or Cancel. It never blocks you.
- The route picker no longer makes the page scroll sideways on phones.

## 1.8.13
- Behind the scenes: the AI check can now be reached without signing in (it only reports whether AI is available). Nothing changes for users.

## 1.8.12
- Behind the scenes: a small check that tells us whether the app can use AI (for the upcoming "Ask AI for a route"). Nothing changes for users yet.

## 1.8.11
- Map: new "Color by route" mode (on by default). Each saved route you can see gets its own color; its pins take that color and show the stop number. Contacts on no route are gray. A contact on more than one route takes the newest route's color with a "+1" badge.
- Map key lists every route with its color, project and stop count, with checkboxes to show or hide each, a project filter, "Only routes" and "Not on a route" toggles, and optional light lines joining each route's stops in order. On phones it's in the ⋯ sheet.
- Pin popups list the routes the contact is on, with links.

## 1.8.10
- Each route now shows the cities it covers as small chips under its name (for example "York 11"), in stop order with a stop count. Shown on the Saved routes list (desktop and phone), the route page header, and planner route items. Long lists show the first few plus "+N more"; tap it to see all, or hover for the full list.
- Route page: after saving an edit, the new name and project show right away.

## 1.8.9
- Saved routes list: every route now has a pencil Edit button (desktop rows and phone cards) that opens a quick edit to rename the route and change its project, with an "Edit stops" link to the full editor. Saves are read back and confirmed with a toast.
- The ⋯ menu on each row also has "Edit name or project" and "Edit stops".
- Opening a route with ?edit=1 goes straight into the editor.

## 1.8.8

- Edit a saved route: the route page has an Edit button. You can rename the route, change its project, add stops (search by name, street or city, or Add a city to add all of a town's contacts, skipping ones already on the route), remove stops, move them with the arrows (or drag on a computer), and press Re-optimize order. Nothing changes until you press Save; Cancel leaves the route as it was. Saving checks the database and shows Route saved, or an error. If someone else deletes the route while you edit, you get an error instead of a new copy. Stops on contacts you can't see are left on the route as they were.
- After you save a new route (Build on map, Pick contacts, New route by city, or from the contact list), you stay where you are. The selection clears, and the Route saved message has a View link.
- New route by city: tick as many cities as you want (Select all and Clear are there). The sort and miles work as before. It shows "N cities · M contacts", and Create route makes one route with all of them, in a quick driving order across the cities.
- Already on a route: once a project is chosen (it starts with the project of your newest route, and every builder has a Project menu), contacts already on another route for that project are marked "Already on “route” · project". On Build on map they have a violet dashed ring. Before saving you see "N contacts are already on another … route" and can choose Skip them (the default) or Include anyway. Routes for other projects, Unsorted routes and routes you can't see don't count.

## 1.8.7

- On phones, the bottom menu bar no longer covers the end of a page. Pages now leave room for the bar and the phone's home-bar area, so the last items on a route (like the Google Maps parts and the map) can be scrolled fully into view.

## 1.8.6

- Start route: Google Maps links now keep every stop. The old link style quietly dropped stops past 9 (and past 3 in a phone browser). Long routes are split into parts of 10 stops, shown as "Part 1 of 3: stops 1–10". Each part starts at the last stop of the part before, and a Next button moves on to the following part. On a computer there is also one link for the whole route (up to 25 places). Apple Maps works the same as before.

## 1.8.5

- New route by city: the starting-city menu (shown for By distance and Nearest-next chain) now has Type a city or address…. You can type any town or address, like Portland, ME or a street address, even if it isn't in the list. The cities are sorted by miles from that place. If the place can't be found, a message says so. Your last 5 typed places are kept under Recent on this device.
- In the city picker, typing a city with no contacts now shows No contacts in [city].

## 1.8.4

- Routes > New route by city has a new sort menu: A–Z, By distance and Nearest-next chain. By distance sorts the cities by straight-line miles from a starting city you pick, showing the miles next to each one (for example Kennebunk · 4 mi). Nearest-next chain orders the cities so each one is the closest to the one before it.
- City locations come from the town center (OpenStreetMap, cached for 30 days). When a town can't be found, it uses the average location of that city's contacts. Nothing is saved to the database. Works on the phone too.

## 1.8.3

- Daily planner: each day now shows its Jewish holidays next to the date and Hebrew date, using diaspora rules and Chabad wording. Saturdays say Shabbos.
- A holiday that starts at night shows on the day its evening begins. For example, Friday Dec 4 shows First night of Chanukah, and Shabbos Dec 5 shows 1st day of Chanukah · 2nd night.
- Chabad dates are included: Yud Kislev, Yud Tes Kislev, Chof Kislev, Hei Teves, Chof Daled Teves, Yud Shvat, Yud Alef Nissan, Gimmel Tammuz, Yud Beis and Yud Gimmel Tammuz, Chof Av and Chai Elul.
- Planner items can now be edited. Tap the pencil on any item to open the same form, already filled in: title, time, address and notes, or the chosen route for a route item. Save keeps the item in its place, and Cancel closes the form. If saving fails, you'll see an error message. Only admins can change the planner, as before.

## 1.8.2

- Contacts filters: the sort menu now reads All instead of Sort by when nothing is picked. Choosing All clears that filter. Tags, Visits and Possible duplicates work the same as before. This applies on desktop and in the phone filters.

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
