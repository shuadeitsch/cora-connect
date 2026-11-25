# Changelog

## 1.9.16
_Updated Nov 25, 2026, 10:35 AM (New York time)._
- **Greeting for two initials:** a contact like "S. & G. Wayne-Workman" is now greeted "Hi S. and G. Wayne-Workman" instead of "Hi S.". Applies everywhere the CRM builds a greeting.

## 1.9.15
_Updated Nov 25, 2026, 10:34 AM (New York time)._
- **Mass text ("Message this state") sends one text per contact, to the best number.** It picks a known mobile first, then a mobile VoIP line, then a number with no lookup yet, and never texts a landline or a fixed (home/cable) VoIP line. Contacts with only landline or home lines are listed as skipped. Before, it texted every number on the contact.
- **Right greeting in mass messages.** The wizard now uses the same greeting as the rest of the CRM ("Hi Richard", "Hi Mr. and Mrs. Skelton"), so no one gets "Hi Mr.!".
- **Cleaner audience.** Removed contacts (Not Jewish, Probably doesn't exist, Deceased) are never included; an "Exclude summer homes (N)" box starts from the project's summer-home setting; and each preview has a "Don't send to this person" box.
- **Server checks** refuse a text to a removed contact or to a number saved as a landline or home phone line.
- **Line types saved on contacts** (new `people.phone_line_types`, migration 066), filled in for Maine from the earlier phone lookups (no new lookups were run).

## 1.9.14
_Updated Nov 20, 2026, 3:36 PM (New York time)._
- **New admin-only "Permissions" tab in Settings** (next to Summer home settings). One on/off switch for each thing a Shliach or a Bochur can do. Everything starts on, exactly like today. Switches (Shliach): edit contacts, log visits, create/edit routes, edit the Daily planner, use the Pre-planner, export contacts, remove contacts, share with his bochurim. Switches (Bochur): log visits, create/edit routes, see the Daily planner, edit the Daily planner (still needs his shliach to allow it too), use the Pre-planner, see visit history/notes, see phone/email. Messaging stays admin-only and is shown as read-only info, along with each shliach's own planner/sharing choices. Saved in a new `role_permissions` table (migration 064); turning one off hides it in the app, is refused by the server, and is blocked in the database for planner, routes, visits and the Pre-planner.
- **Pre-planner has two sections: Outreach and Tasks.** A State picker sits at the top (admins choose a state or All states; everyone else is locked to their own state). **Outreach** is everything that was in the Pre-planner (Reached out, Confirmed visits, Inbox, Calls), unchanged. **Tasks** is a simple follow-up list: "+ New task" with the task (required), optional phone and email (tap-to-call and mailto links only; nothing is sent from the CRM), "Where it's holding", next follow-up date and state, plus a done checkbox. Sorted by next follow-up with overdue ones highlighted in red; tap a task to edit, mark it done, or delete it (with a confirm). Saved in a new `preplanner_tasks` table (migration 065) with state-based row-level security like contacts. Turning off the Pre-planner switch hides both sections.

## 1.9.13
_Updated Nov 20, 2026, 3:36 PM (New York time)._
- **New replies now alert you right away.** The CRM checks for new texts and WhatsApp replies every few seconds. A small toast appears ("New text reply from …") with a View link, and the Pre-planner menu item, the Inbox tab, the Reached out tab and the contact's card and thread show a count or "New reply".
- **Cause:** nothing refreshed the unread count while the page was open, and opening the Inbox automatically opened (and marked read) the newest conversation, so a reply could be cleared before you saw it. The Inbox now opens with no conversation selected, and a thread is marked read only when you open it.

## 1.9.12
_Updated Nov 20, 2026, 3:22 PM (New York time)._
- **Simpler CRM, ten changes.**
- **Summer homes button:** the sun icon is now a small "Summer homes" button with the same All contacts / Hide summer homes choice.
- **One wording for visits:** "Log visit" everywhere (was Visit, Report, Log a visit). The card button "Contact" is now "Details".
- **Cleaner contact cards:** "Unsorted" no longer repeats on a card (a visit with no project shows its date or "Visit"). A bochur's page is titled "Contacts".
- **One main button per card:** Log visit stays on the card; Details, Pre-planner, History and Suggest an edit moved into a "⋯" menu so nothing is cut off on phones.
- **Plain wording** in the Log visit and Pre-planner forms. The two "how they were reached" questions are now one (saved data is unchanged and still compatible).
- **Short New contact form:** name plus phone or address; email, more phones/addresses, visits, tags and sharing are under "More details". Editing a contact still shows everything.
- **Bug fix:** "Log visit" on a route stop (and on the map) opens that contact's visit form instead of sending you to the Dashboard.
- **One "New route" button** asks which kind (Build on map, Pick contacts, By city, Plan a trip). Map now sits next to Routes in the menu.
- **Twilio admin panel** (admins only) moved from the top of the Daily planner to the bottom.
- **Assigning a bochur's project in My Team is smooth and reliable.** The Project dropdown used to sit inside the "Assign shliach" label (two dropdowns in one label, so taps hit the wrong one), appeared only for admins (a shliach could not set his own bochur's project), was disabled while saving and snapped back until the page reloaded, and a failed save (for example a bochur with no shliach, or a save blocked by permissions) was silent. Now each has its own dropdown (admins and the bochur's shliach), the choice shows at once and stays put, you get "Project saved" / "Project removed", and a failed save goes back with a plain message.
- **My Team:** one Status column (instead of two), one role list when inviting (Cora Connect admin, Shliach, Bochur, Visitor, Limited; a bochur still needs his shliach and waits for that shliach's approval), and sign-up asks only for what applies to your role (state for a shliach, project for a bochur, nothing extra for an admin).

## 1.9.11
_Updated Nov 20, 2026, 2:55 PM (New York time)._
- **Settings polish on phones.** On the messaging cards the status dot now sits beside the title, the status text gets its own full-width line, and Reconnect Gmail / Sync now sit on a row below it. The Settings tabs now scroll sideways instead of wrapping.

## 1.9.10
_Updated Nov 20, 2026, 2:50 PM (New York time)._
- **New admin-only "Summer home settings" tab in Settings.** The "Summer homes by project and state" card moved there from the messaging section. Same behavior.
- **Messaging settings simplified.** One compact card each for Email, WhatsApp, Texts and Calls with a plain status line (for example "Email: Connected as maine@chabadora.com", "Texts: Waiting for carrier approval"). Reconnect Gmail and Sync now sit on the Email card. Sender lists, domain addresses, email templates, the text-from choice and the channel list are behind a collapsed Details on each card.
- **Removed:** the Twilio signup box and its A2P note, the optional Gmail Pub/Sub push instructions, and the long intro paragraphs.

## 1.9.9
_Updated Nov 20, 2026, 2:43 PM (New York time)._
- **Invite someone directly as a bochur.** The invite screen now offers **Bochur** next to Cora Connect admin and Shliach. Picking it requires choosing his shliach. When he signs up with that invite he is created as a bochur under that shliach (view-only, no editing) and stays **pending until that shliach approves him in My Team**; admin approval does not skip that. After inviting, a note says "Invited as bochur under <shliach>. He'll show as pending until <shliach> approves him in My Team." (migration 063 adds the shliach to invites and teaches the signup function about bochur invites; an invite without a shliach is refused.) To turn an existing account into a bochur, use approval and pick his shliach as before.
- **Clearer pending label.** In Participating bochurim, a bochur waiting on his shliach now says "Pending <shliach name>'s approval" (e.g. "Pending Rabbi Wilansky's approval") when an admin or another shliach is looking. It says "Pending your approval" only when you are his shliach.

_Versioning: the patch number stops at 99 and the middle number stops at 9. After X.Y.99 comes X.(Y+1).0, and after X.9.99 comes (X+1).0.0 (so 1.9.99 is followed by 2.0.0). `node scripts/next-version.mjs` prints the next version._

## 1.9.8
_Updated Nov 20, 2026, 2:37 PM (New York time)._
- **Summer-home default per project and state.** New admin-editable setting (Settings: "Summer homes by project and state"). When the project or state changes in the map route builder, New route by city, Pick contacts, the route editor, Plan a trip or the Dashboard, "Exclude summer homes" starts from that setting; no setting means All, as before. A manual flip holds until the project or state changes again.
- **Seeded for Maine and New Hampshire:** Summer 5786 and Summer Circuit 2026 include summer homes; Chanukah 5787 excludes them. Wisconsin and everything else are unset.
- **Shows what applies.** Small text near the summer control reads like "Chanukah 5787: excluding summer homes". When an admin uses a project in a state with no setting, a one-time Include / Exclude summer homes question appears and saves the answer (or "Ask later").

## 1.9.7
_Updated Nov 20, 2026, 2:33 PM (New York time)._
- **"Only summer homes" removed everywhere.** The sun toggle in the top bar (and its saved setting) now has just **All contacts** and **Hide summer homes**. Anyone whose browser had "Only summer homes" saved now sees all contacts again. The hide option on every screen stays.

## 1.9.6
_Updated Nov 20, 2026, 2:31 PM (New York time)._
- **"Summer only" removed.** The summer-home control in the map route builder, New route by city, Pick contacts, the route editor, Plan a trip and the Dashboard visit progress box is back to two choices: **All** or **Exclude summer homes (N)**, remembered per device. Devices that had "Summer only" saved fall back to All.

## 1.9.5
_Updated Nov 19, 2026, 8:06 PM (New York time)._
- **Calling now lives in the Pre-planner.** The Calls page and its menu item are gone. The Pre-planner has a new **Calls** tab (next to Reached out, Confirmed visits and Inbox) listing every call with date, length, outcome, notes and the recording player. **Call** buttons stay on the Reached out cards, and the Inbox conversation header now has one next to Confirm visit. Like messaging, calling is admin-only.
- **Contacts page is back to plain phone info.** The Calls history and CRM Call button are removed from the contact detail, which has its simple phone link again, and route stops go back to a plain phone link too.

## 1.9.4
_Updated Nov 19, 2026, 8:07 PM (New York time)._
- **Summer choice on the visit progress box.** The Dashboard's "X of Y contacts visited" box now has the same **All / Exclude summer homes / Summer only** choice, using the same remembered per-device setting as the route screens. Both the visited count and the total respect it.
- **Version numbering.** Patch stops at .99 and the middle number at 9: 1.8.100 to 1.8.103 are now 1.9.0 to 1.9.3, this release is 1.9.4, and after 1.9.99 comes 2.0.0. `scripts/next-version.mjs` encodes the rule.

## 1.9.3 (1.8.103)
_Updated Nov 19, 2026, 8:02 PM (New York time)._
- **Summer homes: All / Exclude / Summer only.** The summer-home control in the map route builder, New route by city, Pick contacts, the route editor and Plan a trip is now a three-way choice with counts: **All**, **Exclude summer homes (N)** or **Summer only (N)**, so both can't be on at once. It shows only households tagged "Summer home" when set to Summer only, and the choice is remembered on this device.

## 1.9.2 (1.8.102)
_Updated Nov 19, 2026, 7:59 PM (New York time)._
- **Confirm a visit from the Inbox.** In a Pre-planner Inbox conversation, the header now has a **Confirm visit** button (admins, like the rest of messaging). It opens the same date, time and notes form as the Reached out cards and saves through the same confirm step, so the visit lands in **Confirmed visits** (the Pre-planner switches to that tab) and shows in the Daily planner on that day. If the contact isn't on the Reached out list yet, it is added and confirmed in one step (reached by the channel of the conversation). If a visit is already confirmed, the header shows "Visit confirmed Tue, Nov 24 at 3:00 PM" with an **Edit** button instead.

## 1.9.1 (1.8.101)
_Updated Nov 19, 2026, 7:56 PM (New York time)._
- **Call people from the CRM, in your browser.** A **Call** button now sits next to every phone number on a contact (all numbers, including extra phones), on the Pre-planner Reached out cards and on route stops. It opens a small call panel: Calling, Ringing, Connected with a timer, Mute, Keypad and Hang up. Calls go out one at a time from the Cora number +1 207-977-2968 and only to numbers saved on a contact. The person you call hears "This call may be recorded." before you are connected, and every call is recorded.
- **Every call is logged.** After hang up, pick what happened (Answered, No answer, Left voicemail, Wrong number, Busy, Not interested, Call back later) and add notes; No answer and Busy are pre-filled from the phone network. Each contact shows a **Calls** history with date, length, outcome, notes and a player for the recording (streamed only to signed-in people who can see that contact). A new **Calls** page lists everything, including unknown callers.
- **Incoming calls.** Calls to +1 207-977-2968 ring the browsers of admins who have the CRM open and offer Answer / Decline; if nobody picks up, the caller can leave a voicemail, which is saved in the Calls log. Calling is limited to the same roles as messaging (MESSAGING_ROLES; admins by default). If the microphone is blocked, the panel explains how to allow it. Where browser calling is off, the button opens the phone's dialer instead.

## 1.9.0 (1.8.100)
_Updated Nov 19, 2026, 7:55 PM (New York time)._
- **Messaging is admin-only for now.** Shluchim and bochurim no longer see or can use any messaging: the Pre-planner **Message** button and sheet (email, text, WhatsApp, tap-to-send), the **Inbox** tab and unread counts, replies, Gmail connect and sync, and the messaging channel list are hidden for them (not just disabled), and the server refuses their sends, replies, thread reads and Inbox actions. The rest of the Pre-planner (list, state filter, select and remove, confirm visit) works as before.
- **One switch to turn it on later:** set the `MESSAGING_ROLES` environment variable (default `admin`), for example `admin,shliach,bochur`, then redeploy. All messaging (and the upcoming in-browser calling) checks `viewer.canMessage` on screen and `canMessageRole(role)` in `lib/messaging-access.ts` on the server.

## 1.8.99
_Updated Nov 19, 2026, 7:55 PM (New York time)._
- **Admin-only Twilio panel on the Daily planner.** Shows the live Twilio balance, this month's and all-time usage with costs (voice minutes, texts, WhatsApp, recordings, phone numbers, total charged) and a rough "balance should last about X" estimate from this month's pace. Twilio's own numbers are cached about 5 minutes and marked "Live from Twilio".
- **Top-up settings and Payments log (entered by hand).** Twilio doesn't share auto-recharge settings or payment history, so admins note the threshold and recharge amount and log each payment themselves; these are marked "Entered by hand" and stored in new admin-only tables (RLS). Nothing here changes Twilio billing.
- **Strictly admins.** The panel is only rendered for real admins (not Beta View), the data comes from `/api/admin/twilio`, which checks the admin role on the server and answers 403 to everyone else without calling Twilio, and the Twilio keys never leave the server.

## 1.8.98
_Updated Nov 19, 2026, 7:49 PM (New York time)._
- **Exclude summer homes when building routes.** A new "Exclude summer homes (N)" switch in the map route builder, New route by city, Pick contacts, the route editor and Plan a trip leaves households tagged "Summer home" out of the stops and counts. It is off by default and remembered on this device, shared by all of those screens. Only the whole summer-home household is dropped; a contact's main address is always kept.
- **See past completed and deferred visits.** Every contact in those flows shows its most recent outcome as a badge ("Completed Nov 12" green, "Deferred Oct 3" orange); cities show "N completed / N deferred" counts. A new **Past visits** menu (show all / hide completed / hide deferred / only deferred) is remembered on this device. On the map, completed pins are green with a check and deferred pins dark orange with a D, with a small key beside the filters.

## 1.8.97
_Updated Nov 19, 2026, 7:45 PM (New York time)._
- **Inbox cleaned up.** Message bubbles now wrap long words, links and emails instead of being cut off, have a sensible width (about 80%), and the conversation scrolls inside its own pane (opening at the latest message). The conversation list shows the name, a short time or date, the channel and a clean 1-2 line preview with an ellipsis, with the unread badge on its own so nothing overlaps; the list scrolls on large screens.
- **Email bubbles are tidy.** Quoted reply history ("On ... wrote:", lines starting with ">", Original Message / From: blocks), "Sent from my iPhone" and signature blocks are hidden, with a **Show full message** / **Hide quoted text** toggle. The whole message is always kept and shown if nothing else would be left.
- **Reached out cards are smaller.** Less padding, smaller headings and tighter spacing so more fit on screen; buttons stay 44px tall for tapping.
- **Contacts page no longer messages.** Removed from the Contacts page: "Message this state", "Message… (WhatsApp, Text, Email)", "Message selected", the bulk **Email** and **Text / WhatsApp** buttons, the WhatsApp button on every contact row and card (added in 1.8.83), and the three messaging dialogs behind them. In the contact detail: the Messages thread and reply box, and the Text, WhatsApp and Email buttons are gone. The phone **Call** button stays, and emails now show as plain text. Messaging is done from the Pre-planner Message sheet and the Inbox.

## 1.8.96
_Updated Nov 19, 2026, 7:29 PM (New York time)._
- **Every email path now greets the same way.** The Contacts email wizard, the Outreach dialog (single and group) and the shared name fill in `lib/outreach.ts` use the same greeting as the Message sheet, including their previews: couples ("Hi Adam and Isabelle!"), titles with a surname ("Mr. and Mrs. Smith"), families ("Cohen family"), and "there" only when no name exists. The full-name placeholder now uses the name as saved, titles included.

## 1.8.95
_Updated Nov 19, 2026, 7:27 PM (New York time)._
- **Greetings now always use the name on file.** With first names: "Hi Adam and Isabel!". With only titles and a surname: "Mr. and Mrs. Smith", "Dr. and Dr. Cohen", "Dr. and Mrs. Katz", "Rabbi and Mrs. Levi", "Dr. Cohen". Families: "The Cohen Family" becomes "Hi Cohen family!". "there" is used only when there is no usable name at all. Same greeting in the preview, email, text, WhatsApp, tap-to-send and the WhatsApp template.

## 1.8.94
_Updated Nov 19, 2026, 7:25 PM (New York time)._
- **Greetings fixed for couples.** A name like "Adam & Isabelle Johnson" or "Adam and Isabel Johnson" now greets as "Hi Adam and Isabelle!" (it used to fall back to "there"). "Mr. & Mrs. Eric Lusty" still greets as "Eric", titles (Mr., Mrs., Dr., Rabbi) are skipped, and families or unusable names still say "there".
- **One greeting everywhere.** The email preview, the email itself, texts, WhatsApp, tap-to-send and the WhatsApp template's {1} (which used to take the first word of the name, so "Mr." for "Mr. Tom Rosen") now all use the same greeting name.
- **The Message preview shows the filled-in greeting** for the first selected person, with **Previous / Next** buttons to flip through recipients.

## 1.8.93
_Updated Nov 19, 2026, 7:23 PM (New York time)._
- **Pre-planner state filter.** A **State** selector (All states plus each state that has contacts) sits at the top of the Pre-planner. It filters the list, the tab counts and Select all, and the chosen state becomes the default state when you open **Message**. The choice is remembered on that device. Shluchim who only see one state don't get the selector (they stay locked to their state). It takes the full width on phones.

## 1.8.92
_Updated Nov 19, 2026, 7:19 PM (New York time)._
- **WhatsApp visit template swapped.** The earlier draft (cora_maine_visit_students_utility) had gone to Meta as Marketing, so it was deleted and replaced by **cora_maine_visit_date_town** (Utility, "Visit with date and town"), which is waiting for Meta approval. The template list uses the new name; nothing else changed.

## 1.8.91
_Updated Nov 19, 2026, 7:19 PM (New York time)._
- **Fixed: saving any inbound message failed** (texts, WhatsApp and email replies). The database function that stores an incoming message referred to itself incorrectly and, when starting a Reached out row, wrote the time as text into a time column (migration 059). Together with the email-matching fix in 1.8.90 this is why no reply ever reached the Inbox. The six Nov 19 test replies from info@chabadora.com and mendelgreisman@gmail.com were recovered and are in the Inbox now. Removed the temporary Gmail diagnostic.

## 1.8.90
_Updated Nov 19, 2026, 7:17 PM (New York time)._
- **Fixed: email replies never matched a contact.** The database lookup that matches a sender's email address to a contact failed on every call ("column reference email is ambiguous"), and the Gmail sync swallowed the error, so no email reply was ever attached to a contact (migration 058). It also now skips deleted contacts and prefers live ones when a test address exists twice.
- The Gmail sync no longer relies only on Gmail's change history: every few minutes it also checks the last 3 days of Inbox mail and picks up anything not yet stored (deduped by Gmail message id), so a stale or skipped sync pointer cannot lose replies.
- If the Gmail sync fails (expired sign-in, missing permission, Gmail error), admins now see a red **Gmail sync failed: reason** line at the top of the Inbox instead of nothing.

## 1.8.89
_Updated Nov 19, 2026, 7:05 PM (New York time)._
- **Email templates trimmed.** The saved email templates are now just **Follow-up thank you** and **Chanukah visit**. Removed: Visit announcement, Chanukah / holiday visit, and We're in the area (also removed from the built-in drafts so they don't come back; migration 059). Their full rows are saved on the box for recovery. WhatsApp (Twilio) templates are untouched.

## 1.8.88
_Updated Nov 19, 2026, 7:04 PM (New York time)._
- **New email template: "Chanukah visit"** (subject "A Chanukah visit from Chabad of Maine"), signed Mendel / Chabad of Maine, with paragraph breaks kept. It starts "Hi {first_name}!" and each person's own first name is filled in per recipient, using "there" when there is no usable first name (titles like Mrs. are skipped). It shows in the Template picker of the Message sheet (migration 058, also added to the built-in drafts). Nothing was sent.

## 1.8.87
_Updated Nov 19, 2026, 6:57 PM (New York time)._
- **Unknown senders are no longer dropped.** Texts and WhatsApp messages from a number that matches no contact, and Gmail messages addressed to the Cora mailbox from an address that matches no contact or sent thread, are now kept (migration 057). Gmail skips obvious newsletters, notifications, no-reply and bulk mail (List-Unsubscribe, Precedence, auto-replies, promotions and updates tabs). In the Inbox, admins get an **Unknown sender (N)** tab showing the number or email, channel, time and message, with **Attach to contact** (search a contact; optionally save the number or email on them, then the message moves into their conversation), **Create new contact** (name required, number or email prefilled) and **Dismiss**. Admins only for now; the sender is hidden for anyone who cannot see contact info. Incoming texts and WhatsApp messages now also match a contact's extra (4th and later) phone numbers.

## 1.8.86
_Updated Nov 19, 2026, 6:54 PM (New York time)._
- **Fixed: the Pre-planner Message button was grey.** It was disabled whenever the Pre-planner list was empty (all entries had been removed), so there was no way to message anyone from that page. The button is now always available. When the Pre-planner is empty, the Message sheet opens on **Specific people** so you can search and pick who to message.
- **No more silent grey buttons.** When Send is disabled in the Message sheet, a short line under it says why (no Gmail connected, texting not approved yet, WhatsApp API not set up, template not approved, nobody ticked, or nobody in the audience).

## 1.8.85
_Updated Nov 19, 2026, 6:46 PM (New York time)._
- **WhatsApp templates can now have more than one variable.** The CRM reads each template's variables from Twilio. {{1}} is the first name as before, {{2}} is the contact's town (city) and {{3}} is the visit date and time. One-variable templates (Chanukah, Visit) work exactly as before.
- New template **cora_maine_visit_students_utility** ("Visit with date and town", WhatsApp utility, with Yes / Another time / Not interested buttons) was submitted to Meta; it shows in the WhatsApp template list and is usable once approved.
- In the Message sheet, a **Visit date/time** box appears for templates that need it (leave it blank to use each contact's scheduled visit from the pre-planner). The template preview shows every value filled in. Contacts with no town, or no visit time, are skipped and listed with the reason; the server also refuses to send them.
- The message log now stores the full filled-in text and all template values for each WhatsApp send (it used to store only the first name). Delivery status callbacks are unchanged.
- Replies that are button taps (Yes / Another time / Not interested) now show in the Inbox (the button text is used when the reply has no body).

## 1.8.84
_Updated Nov 19, 2026, 6:46 PM (New York time)._
- **Email replies now reach the Inbox even when they come from a different address.** Replies were only attached to a contact if the sender's address exactly matched the email saved on that contact, and anything else was silently dropped. So a reply from your personal address (or an alias or forward) to an email we sent never showed up. The Gmail sync now also matches a reply to the email we sent by its Gmail conversation, and files it in that contact's existing thread (migration 056). Replies from saved addresses work as before.

## 1.8.83
_Updated Nov 19, 2026, 7:00 PM (New York time)._
- **Tap-to-send from your own WhatsApp.** New **Tap-to-send (my WhatsApp)** choice in the Message sheet. Pick the audience as usual (state, cities, reached or new, or specific people), write one message, and use `{first_name}`, `{name}` or `{city}` (new Insert buttons add them; the message starts with "Hi {first_name}," by default). Each person's copy is filled in with their name, skipping titles (Mrs. Ruth Gordon becomes Ruth) and saying "there" when there is no usable first name. The queue shows one person at a time: name, number, the exact message, a big **Open in WhatsApp** button (your WhatsApp app on a phone, WhatsApp Web on a Chromebook), then **Sent / Next** or **Skip**, with "N of M" and a progress bar. **Pause** keeps your place; reopening the Message sheet offers **Resume**. Tapping Sent / Next logs a "WhatsApp (manual)" message on the contact. The CRM never sends anything and opens nothing by itself.
- **WhatsApp button on every contact** (list rows, cards, and the contact detail): opens a chat with the WhatsApp number, else the first valid phone, with "Hi <first name>," already typed.
- The Message sheet audience now also leaves out Not Jewish and Probably doesn't exist contacts (Deceased was already out); the Summer home switch still applies.

## 1.8.82
_Updated Nov 19, 2026, 6:40 PM (New York time)._
- **Real delivery status for texts and WhatsApp.** Every send now asks Twilio to report back (a signed status callback, migration 055), and the message log updates to Delivered, Read, or Failed. A Failed message shows in red with a plain reason, for example code 63049: "WhatsApp (Meta) didn't deliver this marketing message." A message never goes backwards (Delivered/Read is not overwritten by an older Sent). The two WhatsApp sends from Nov 19, 6:00 PM were checked against Twilio and now show Failed (63049).
- **Pre-planner Inbox fixed.** Long names, emails and messages now wrap or cut off with "..." instead of spilling out of their boxes, the unread count no longer gets pushed out of view, and the reply box and Send button stay inside the panel on phones, Chromebooks and desktops.
- **Pre-planner: select several and remove.** Each row has a checkbox, plus **Select all** (the entries on the tab you are viewing), a count, and **Remove N from pre-planner** with a confirmation. This only takes them off the Pre-planner list; the contacts stay in the CRM.

## 1.8.81
_Updated Nov 19, 2026, 6:15 PM (New York time)._
- On the contact add/edit form, phone numbers now work like addresses. There is one **Phone** field by default and an **Add another phone number** button; each click adds another phone field, and every extra one has a **Remove** button. The old fixed "Phone 2" and "Phone 3" boxes are gone. The first number is the primary one, and numbers are kept in the order shown (blank ones are dropped when you save). Editing a contact that already has several numbers shows all of them.
- A contact can now have more than three numbers. The first three are stored as before; the 4th and later go in a new `extra_phones` list (migration 054, which also updates the masked people view and search). Texts and WhatsApp go to every number (deduped by the last 10 digits), search finds any number (digits only or formatted), the Contacts phone filter and search box include them, duplicate detection and Keep-both merges include them, and the contact CSV export has a new last column `extra_phones`. CSV import still reads only phone, phone2 and phone3.

## 1.8.80
- New **Deceased** tag, alongside Not Jewish and Probably doesn't exist, and it works the same way: set it on the contact's edit form (a Deceased button in Tags), shown as a badge, in the Tags filter ("Tagged contacts" then Deceased), and in the CSV export and import. Deceased contacts stay off the main list, routes, reports and the Pre-planner like the other tags, and are also left out of the Message sheet's audience so nobody is messaged. Contacts BeenVerified or public records list as deceased were reviewed against visit history: those with no answered visit were tagged; those who answered the door were left alone with a note.

## 1.8.79
- New **Summer home** tag, separate from Not Jewish / Probably doesn't exist (those keep behaving as before). Summer home contacts stay fully active and visible. Set it with the **Summer home** button next to Tags on a contact's edit form; it shows as a blue badge. A new **sun button in the top bar** is one global switch that follows you across pages: **All contacts**, **Hide summer homes**, or **Only summer homes**. It applies to Contacts, Pre-planner, the Message sheet audience, map and route planning, reports and dashboard counts, messages, and search. It is saved in your browser session, so it stays on until you change it. The Contacts filter panel (also used by Create route on the map and Plan a trip) has an **Exclude summer homes** checkbox, and an open route has a **Remove N summer homes from this route** button. Ten likely summer homes were tagged from their notes and public records.

## 1.8.78
- Editing a visit from a contact's visit history now updates that same visit instead of adding a new one. Visits that live on the contact history (added from the contact form, imports, or earlier edits) were not found by the edit save, so it created a fresh visit with a new id and left the original untouched. The save now finds the history row by its id and changes Visited, reaction, notes, date, status, activities and project in place. If the visit can't be found at all, it says so instead of creating a new one. Editing a visit from the log-a-visit list also updates the project when Visited names a project.

## 1.8.77
- Texts and WhatsApp now go to every number on a person (WhatsApp field, phone, phone 2, phone 3), not just the first. Duplicates are removed by the last 10 digits. In the Message sheet each number is its own recipient row, showing the name and the number, and each can be checked or unchecked on its own. `{name}` personalization is the same, the WhatsApp phone queue lists each number, and Results show which number each message went to. Email is unchanged. The older Message-this-state wizard does the same. Each contact is still marked as reached out once, and a reply from any of a person's numbers still matches them.

## 1.8.76
- Search (the bar at the top, or Ctrl/⌘ K) now finds a contact by anything saved on it: name, street, city, state or ZIP (or a full address like “12 Main St, Portland”), phone in any format or digits only, email, project, tags, notes, household members’ names, visit notes and reactions, other addresses, and Pre-planner notes. Matching is partial and not case-sensitive. Each result shows what matched, like “Address: 12 Main St · Portland, ME”. It searches on the server (new `search_contacts` function with trigram indexes, migration 053), so it stays fast and only returns contacts you can see: state scoping, masked phones and email, and visit-history permission all apply.

## 1.8.75
- The **Message** sheet is no longer limited to people already in the Pre-planner. It now has a **Who to message** panel: pick a state (admins choose any state or All states, defaulting to Maine; a shliach is limited to his own), then **All contacts** or **Specific contacts** (search and tick). For All contacts you can combine **Cities** (multi-select, with counts) with **Everyone / Not reached out yet / Already reached out**. The recipient list is pre-checked with Select all / Clear all and per-person uncheck, and people with no phone/email or who opted out show in the skipped list. The WhatsApp template picker, approved-only gating, and `{name}` personalization are unchanged. Opened from the Pre-planner it starts on “Already reached out”; opened from Contacts (new **Message…** button) it starts on “Not reached out yet”.
- Large sends go server-side in batches of 5 with a live “Sending 20 of 120” progress and a per-person Sent/Failed result, so they do not time out. Anyone messaged is added to the Pre-planner as reached out (with how they were reached and a note) if not already there, so “Already reached out” stays accurate.


## 1.8.74
- The Pre-planner **Message** sheet’s WhatsApp option now lists live Twilio Content templates whose names start with `cora_` (including **Chanukah visit** / `cora_maine_chanukah` and `cora_maine_visit`). Each one shows a name-filled preview and its Meta approval status (pending, approved, or rejected). Only an approved template can be sent, using that template’s ContentSid and `{{1}}` as the person’s first name. Until Meta approves a selected template, sending stays gated to a free-form message within 24 hours of a contact’s reply. New `cora_` templates appear automatically from Twilio; `TWILIO_WHATSAPP_CONTENT_SID` is still the fallback default.

## 1.8.73
- WhatsApp in the Pre-planner **Message** sheet can now send through the Twilio WhatsApp API (`whatsapp:+12079772968`) using Content template `cora_maine_visit` (`{{1}}` is the person’s name). Until Meta approves that template, sending is gated and only a free-form message is allowed within 24 hours of a contact’s reply; the sheet shows the approval status. Replies go to `/api/webhooks/twilio/whatsapp` (the WhatsApp sender webhook), so they can attach to the Pre-planner without changing the SMS Messaging Service webhook.

## 1.8.72
- Settings › Messaging settings no longer shows a stack of red error alerts after Connect Gmail: a successful connect is a green confirmation, and Resend/domain-setup notes are informational (Gmail does not need Resend). Text-from settings also load correctly again (the query had been ordering by a column that table does not have).
- The Pre-planner has a **Message** button that opens a mass-message sheet for the people currently in view. Pick Email, Text, or WhatsApp, a template or your own message (use `{name}` or `{first name}`), uncheck anyone to leave out, and see who is skipped for a missing email or phone. Email sends through that state's default Gmail channel. Texting stays disabled, with a note that it turns on once Twilio approves the campaign, until `SMS_SENDING_ENABLED` is set to true. WhatsApp is a send-from-phone queue: each person gets a **Send on WhatsApp** button that opens a pre-filled `wa.me` link; when you send (or skip), it is logged on that entry and the next person is shown. A later Twilio WhatsApp API sender (`WHATSAPP_API_SENDING_ENABLED` and `TWILIO_WHATSAPP_FROM`) can replace the queue with one-click sending. Each send is personalized and logged on that Pre-planner entry.

## 1.8.71
- Added a **Maine texting** channel for +1 (207) 977-2968, active and the default text channel for Maine. Settings now has a **Messaging settings** tab (renamed from Email templates) for Gmail, domain From addresses, Texting (Twilio) status, messaging channels, and templates. Those sections are no longer on the Account tab. Connect Gmail and its status messages open this tab.

## 1.8.70
- Texting credentials can now be set on Vercel (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, and `TWILIO_MESSAGING_SERVICE_SID`). Outbound texts use the Messaging Service so they go through the registered A2P campaign once it is approved. Settings › Account notes that US texting stays pending until that campaign is approved. Incoming SMS is received at `/api/webhooks/twilio/sms`.


## 1.8.69
- Public **Privacy Policy** and **Terms** pages are at `/privacy` and `/terms`, without signing in, so a Twilio A2P campaign can link to them. They are issued by Chabad of Maine (CORA). The privacy page covers what we collect (name, phone, email, and visit notes), use only for community outreach, that we never sell or share phone numbers or SMS opt-in data for marketing, message frequency and rates, STOP and HELP, data security, and an effective date of November 15, 2026. The terms page covers the outreach SMS program, opt-in, opt-out, HELP, rates, and carrier limits, and links to the privacy page and info@chabadora.com.


## 1.8.68
- Settings no longer treats a Gmail messaging channel or a domain From address as a connected Gmail inbox. If Connect Gmail did not save an account, the success notice is not shown. An unlinked Gmail channel says it still needs to be attached. If Google rejects the OAuth client secret, Settings tells an admin to update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on Vercel.


## 1.8.67
- Connect Gmail now stays on the public site URL so the return from Google and the connect cookie use the same host, and it no longer pre-selects the person's CRM login email, so an admin can choose maine@chabadora.com (or another mailbox) in Google's account picker. If connect fails, Settings › Account shows why (denied, expired link, or an error) instead of failing silently. The Google return path is no longer sent to the login page, which had dropped the connection before it could be saved.


## 1.8.66
- Gmail replies no longer wait for the daily cron. A signed-in user hitting **POST /api/gmail/sync** pulls new mail on that organization's connected Gmail channels through the history API (incremental, one sync at a time per inbox). The app calls it when Inbox, the Pre-planner, or a contact card opens, and about every two minutes while the app is open and visible (debounced). The daily Vercel cron stays as a backstop. Admins have a **Sync now** button on Settings and on Inbox.
- Optional Google Pub/Sub push is documented for Saturday's checklist and is not required: topic `cora-connect-gmail-push`, publisher grant for `gmail-api-push@system.gserviceaccount.com`, and push subscription URL `https://outreach-crm-brown.vercel.app/api/webhooks/gmail/push`. See `docs/gmail-pubsub.md` and the note in Settings.


## 1.8.65
- Two-way messaging is in the CRM, behind **Setup needed** until the credentials for that channel are in the environment. Admins connect, disconnect, or swap channels in Settings (Gmail, domain email through Resend, Twilio text, and Twilio WhatsApp). A channel can be org-wide or assigned to a shliach, and can be the default for one or more states. Start with one dedicated email (maine@chabadora.com) and one dedicated phone number; more can be added later.
- **Message this state** (on Home and Contacts), or **Message selected**, opens a campaign: pick one or more channels, per-channel templates and placeholders, a per-person preview, and a confirm step. **Skip people already contacted (this project)** is on by default and lists who was skipped and why (no address, opted out, or already reached in this project, including earlier `outreach_sends` and Pre-planner entries). Each person gets their own message. Beta, Tutorial, and practice mode never send.
- Replies arrive in an **Inbox** tab on the Pre-planner and on the contact card. Inbound SMS and WhatsApp come in through signature-checked Twilio webhooks; Gmail is synced on a daily Vercel cron (and a push endpoint, or a Bearer call to the cron route, if you need it more often). A reply is matched to the contact by email or phone, attached to a thread, added to that contact's Pre-planner Reached-out notes (or a new entry), and marked **Replied**. You can read the thread and answer on the same channel. Unread counts show on the Pre-planner sidebar item and Inbox tab. Home adds Emailed, Texted, WhatsApped, and Replied counts.
- Email unsubscribe is unchanged. SMS honors STOP and UNSTOP; WhatsApp honors opt-out. Business-initiated WhatsApp outside the 24-hour window asks for a Meta-approved template name or Content SID and variables. Sends are logged; inbound ingest is idempotent on the provider message id.


## 1.8.64
- A Pre-planner reach-out can now be marked with more than one channel (Email, Text, WhatsApp, Phone call, In person, Other). Existing single values are kept as a one-item list.
- The Pre-planner sidebar item sits directly above Routes.
- Each person can drag the sidebar buttons (and the pages in the phone menu) into their own order. On a phone, long-press a page and drag; on a Chromebook, drag the handle. The order is saved on the account and on this device. **Reset order** puts the list back to the default (Pre-planner above Routes).


## 1.8.63
- When an admin changes the email of someone who has not accepted the invite or signed in yet, the login email is updated to match and the invite is resent to the new address only (never the old one). A toast says **Invite resent to** that address.
- Pending and invited people have a **Resend invite** action on the team and users screens. Sending uses the app's sign-in email (a magic link). Each send is stamped on the invite or profile so it appears in `change_log`.


## 1.8.62
- You can send personalized email from the CRM. Pick contacts (the current selection or filter), choose a template, and each person gets their own email with their name and the other placeholders filled in ({first name}, {last name}, {full name}, {state}, {city}, and so on). Preview steps through the list and lets you edit one recipient's copy. Contacts without an email, and people who have opted out, are skipped and counted. A confirm screen shows the count, then Send. Each message is a separate email (no shared To or CC). Progress and per-recipient results are shown. Sends are throttled. Each send is logged in `outreach_sends` (method, from, to, status, error) and `change_log`. Beta and Tutorial never send or write.
- **Gmail:** each user can connect one or more of their own Google accounts (gmail.send only) and pick which connected account sends, so the mail comes from that address and lands in its Sent folder. Refresh tokens are stored encrypted on the server, are private to that user, and are never sent to the client. There is a Disconnect option. If the Google OAuth client is not in the environment yet, Connect Gmail is disabled with a Setup needed note for admins.
- **Domain sending:** mail can be sent through Resend from an admin-chosen From address. **info@chabadora.com** and **maine@chabadora.com** are offered; admins can add more in Settings. If the Resend key is missing, that method is disabled with a Setup needed note. Domain emails include an unsubscribe footer; the opt-out is stored on the person (`email_opt_out`) and later sends skip them.
- The Open in email **Send from** list also includes **info@chabadora.com** and **maine@chabadora.com**.
- On Contacts (and the Map / route pickers), the scattered filter buttons and chips are replaced by one **Filters** dropdown. Inside, every filter is a checkbox, grouped (visit status, has email/phone, project/season, tags, state, cities, and the other existing filters), and combinable with the same AND/OR logic as before. The panel stays open while you tick boxes and applies live; it closes only on an outside tap, Done, or Esc. The button shows a count badge, and there is Clear all. On phones it opens as a bottom sheet. Sort stays its own control.
- The Pre-planner is now two stages. **Reached out** is for any contact you reached, not only those asking for a visit: when you reached them (date and time), how, the follow-up channel, a timestamped notes log, and a project (default Chanukah 5787). A visit date is not required yet. **Confirm visit** moves an entry to **Confirmed visits** and requires a visit date and time; the reach-out history is kept. Only confirmed, unscheduled entries appear on the Daily planner **Requested visits** strip. The page has two tabs with counts. Each entry is tied to a project so Home can count them correctly.
- Home adds two CRM-styled stat boxes, **Reached out** and **Confirmed visits**, using the same canvas tiles as the activity boxes. Counts follow the dashboard project and state filters (defaulting to Chanukah 5787, and still respecting each user's state scope).


## 1.8.61
- A **Pre-planner** sidebar page (under More on phones) holds contacts who said they are ready for a visit. From a contact card, or with a bulk select action, add them with a required requested date and time, how they reached out (Email, Text, WhatsApp, Phone call, In person, or Other), and notes for the back-and-forth. Entries can be edited or removed, and the list is sorted by that date and time. Admins see the contacts in their states; each shliach sees only his.
- When the Daily planner is showing a day that has unscheduled Pre-planner requests, a highlighted **Requested visits** strip appears at the top of that day with the requested time and an **Add to this day** button. That adds the visit to the planner at that time, marks the entry as scheduled, and hides it from that day's strip. Merging two contacts moves Pre-planner entries onto the surviving contact. Additive schema with RLS and `change_log`. Beta and Tutorial still do not write to the database.


## 1.8.60
- Contacts can be ordered by **Has email** or **Has phone** (contacts with an address or any of phone / phone2 / phone3 come first, then name). Filters are now independent and can be combined: Has email, Has phone, Completed, Deferred, Not visited, plus Tags, Seasons, Possible duplicates, and Deleted by shliach. Different kinds of filters use AND (Has phone + Deferred). Completed + Deferred (or any mix of visit statuses) uses OR. Has email + Has phone shows contacts with both. Active filters appear as chips with a one-tap **Clear filters**.
- When composing an email, a **Send from** picker lets each user save their own sender addresses (private to them). The last address used is remembered. If the chosen address is Gmail or Google Workspace, **Open in Gmail** opens Gmail compose for that account. Otherwise the mail app opens, with a hint to switch to the chosen address. The chosen from-address is recorded in `outreach_sends`.
- A **Text from** setting, next to Send from, chooses **Phone's messaging app** (the usual SMS link) or **Google Voice** with that user's number. Mendel's account is set to Google Voice (347) 770-1863. Choosing Google Voice copies the message and the recipient number, shows "Message copied, paste it in Google Voice," and opens Google Voice messages in a new tab. WhatsApp still uses wa.me, with a note that it sends from the number WhatsApp is registered to. The sender is logged in `outreach_sends`. Beta and Tutorial still do not write to the database.



## 1.8.59
- When you order contacts by Visited, or sort/filter by Visits (including on the Map and when picking contacts for a route or bulk select), actually visited contacts come first, then Deferred, then contacts with no real visit. Within each group the current order is kept (name, or the latest visit label then name for the Visited order). Removed visits do not count. A contact with both a completed visit and a deferred visit stays in the visited group. The only stored statuses are Completed (shown as Visited) and Deferred; a real visit with no status saved counts as visited.



## 1.8.58
- When you pick an email or text template for a contact, the subject and message open already filled in (name, state, and so on) so you can change that one message without changing the saved template. **Reset to template** puts the filled draft back. Sending is still the existing Open in email app, copy, SMS, and WhatsApp flow, now using your customized text. Those sends are recorded in `outreach_sends` and `change_log`.
- Admins can create, edit, and delete the templates themselves under Settings › Email templates. The four built-in drafts are saved for the organization so they can be changed. Shliachim can use the templates but not manage them. RLS limits reads to the organization and writes to admins. Beta and Tutorial still do not write to the database.
- The top-right search box now says **Search CORA Connect**, including its label for screen readers.



## 1.8.57
- Home puts **Visit activities** all the way at the top, above the other dashboard boxes. Each of the seven activities (Nice conversation, Tefillin, Shabbos candles, Menorah, Package, Challah, Mezuzah) is its own small stat box, using the CRM background and brand colors rather than a white panel. The row wraps on phones and sits in one line on wider Chromebooks. Counting and project/state filters are unchanged. The **Removed: not Jewish / not existent** box is unchanged.



## 1.8.56
- Every visit on a contact is fully editable. On the contact form, Visited, date, reaction, notes, who visited, and status could already be changed; **What happened** activity chips are now on that form too. Visit history had been view-only (except Remove); it now has Edit, so you can change an existing visit without opening the whole contact. Edits go through the usual save, so `change_log` records them.
- Each visit has **What happened** chips, on new and existing visits, in this order: Nice conversation, Tefillin, Shabbos candles, Menorah, Package, Challah, and Mezuzah. Chosen activities show on the visit in History. Home has a **Visit activities** box, styled like the other stat boxes, with a total for each of those categories. It counts only live visits that were not removed, and follows the dashboard's project and state filters: an admin can view every state they can access, and a shliach sees only his state. The existing **Removed: not Jewish / not existent** box is unchanged. Older wordings such as “Put on tefillin” still count under Tefillin. Activities are stored in `activities` on `contact_visits` (already present) and on `visits`. Merge already moves the whole visit row, so activities go with it. Beta and Tutorial still do not write to the database.



## 1.8.55
- A contact can hold more than one address. The first address stays where it is; additional addresses (street, city, state, zip, and an optional label like Winter home or Business) are stored in `extra_addresses` on the household. The contact card shows every address, with a map/directions link for each when the main address has one. **Add another address** adds a new one, and extras can be edited or removed. This works on phones and Chromebooks. Search and the possible-duplicates scan look at the extra addresses too. Edits are written through the usual contact save, so `change_log` records them. Beta and Tutorial still do not write to the database.
- Merging two contacts now moves every visit from both cards onto the surviving contact, including visits that had been removed (soft-deleted). Values the surviving card is missing — an extra address, empty phone or email slots, and notes — are copied from the other card and never overwritten.
- After merging a pair or marking it **Not a duplicate** from Possible duplicates, the app stays on that list. The handled pair drops off and the next one shows. Scroll position is kept when possible.


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
