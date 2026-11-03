# Cora

Cora Connect keeps household contacts for **Chabad Outreach to Rural America**. Cora admins see shared contacts from every state. Each shliach signs in to the contacts in his territory.

It is a clean-room app. The sample households, people, phones, and emails are fictional. Nothing here is copied from another product's code or customer data.

## Run it

Node 20 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The app talks to Supabase. There is no local JSON sign-in.

Apply `supabase/migrations/001_init.sql` through `014_invite_auto_approve.sql` in order (there is no `003`). `shuadeitsch@gmail.com` is marked an approved admin because that login already exists. An email with an open invite is approved automatically on signup with the invite's role, permissions, and (for a shliach) territory. Allowlisted emails without an invite stay pending until a Cora admin approves them on Users as a Cora Connect admin or a shliach (with states, and optional areas), except the addresses in `preapproved_admins`: `mendelgreisman@gmail.com` and `info@chabadora.com` are created as approved Cora admins. Approved Cora admins are equal. The app does not rank one admin above another. `005` adds Summer 5786 and Chanukah 5787, the share flag, and territory checks for shliach accounts. A Cora admin is not limited to a territory. `014` stores invite territory and auto-approves invited signups.

```bash
npm run check     # checks the fictional generator, not the live database
npm run seed:sql  # rewrite supabase/seed_demo.sql
```

## What you can do

- **Contacts** — the home screen. One contact is one person. The form asks for a name, phone, email, and address, plus a list of visits (Visited, Completed or Deferred, reaction, notes, and an optional date). Each note is labeled with its visit, such as Summer 5786, and the visit date when there is one. Notes that were never attached to a visit show as Summer 5786. Tags are Not Jewish and Probably doesn't exist. A tagged contact stays off the main list. Share with Cora can be left on or off. A Cora admin sees **Cora · All states**, with tabs for All states, Maine, Wisconsin, New Hampshire, and Unsorted. Unsorted also lists contacts with a blank or unrecognized state. The other three tabs still match only that state. A shliach sees only his state or states, and a contact with no state uses his territory state. Spreadsheet import keeps every row: the same person with a different Visited value is an extra visit, and every other row is its own contact. The template and the prompt for another model are on the Import screen (`docs/IMPORT_FORMAT.md`). Cora admins can export CSV and delete several contacts at once.
- **Users** — Cora admins approve allowlisted (non-invited) pending accounts as a Cora Connect admin or a shliach, and can change role or territory later. Invited people do not need this step.

Map, routes, visits, and charts stay in the app under More. There is no subscription or plan screen.

- **Map** — pins colored by due status, filters, and a route builder that orders stops from the Chabad House with a nearest-neighbor pass.
- **Saved routes** — open, reorder, or delete a route and follow the stops.
- **Reports** — log a completed or deferred visit with a reaction, note, and follow-up date. Filter and download CSV.
- **My team** — invite by email as a Cora Connect admin or a shliach (with states, and optional areas), or as visitor / limited. Visitor and limited keep the history, contact, and edit switches; limited only sees households on assigned routes. When the invited person creates their account, they are approved automatically with that role.
- **Settings** — Chabad House, categories, projects, custom fields, and your password on the Account tab.

The interface is its own design: warm paper in light mode, ink in dark mode, and frosted panels on the sidebar, top bar, menus, and map. The theme follows the system until you switch it. On a phone, Contacts and More sit in a bottom bar.

It installs as a PWA named Cora Connect. Chrome can offer Install app. On iPhone Safari, a one-time hint says to use Share → Add to Home Screen. The service worker caches the offline page and static files only. It does not cache signed-in pages or API responses. Reload, next to the version badge, checks for a new deploy and reloads. In the installed window that button is how you pick up an update, because there is no browser reload control. If a form has unsaved edits, it asks before discarding them. When a newer version is deployed, the button reads Update available.

## Environment

Copy `.env.example` to `.env.local`. Vercel needs the same public variables. No server-only secret is required for the deployed app.

| Variable | Required on Vercel | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Publishable key (a legacy anon key also works) |
| `NEXT_PUBLIC_AUTH_GOOGLE` | No | Set to `true` to show Continue with Google |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical origin for auth redirects. Empty uses the request host |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | Mapbox Streets tiles. Empty uses OpenStreetMap |

Do not put `SUPABASE_SERVICE_ROLE_KEY` on Vercel. The app never reads it.

## Supabase

Run this once, in the SQL editor or the Supabase SQL API:

`supabase/migrations/001_init.sql`

That file is idempotent. It creates the schema, row-level security, helper functions, the organization, default categories, projects, custom fields, and the admin allowlist. It does not insert households or people.

Optional fictional households, still with no logins:

`supabase/seed_demo.sql`

`admin_emails` is only a signup allowlist. It starts with `shuadeitsch@gmail.com`, `mendelgreisman@gmail.com`, and, after `002_approval.sql`, `shuadeitsch+cora@mail.grokbot.com`. The live project also has `info@chabadora.com` on that allowlist, so that address can create an account. Signing up with an open invite creates an approved account with the invite's role (and shliach territory when set) and marks the invite accepted. Signing up with an allowlisted address and no invite creates a pending account. It does not grant admin, unless the address is in `preapproved_admins`. `004_preapproved_chief_admins.sql` adds that table (row-level security on, no policies) and a before-insert trigger on `profiles`. `mendelgreisman@gmail.com` and `info@chabadora.com` are inserted as approved admins who can see history and contact details and edit. `014_invite_auto_approve.sql` adds invite territory columns and the auto-approve path. Any approved admin can still approve, reject, or disable other accounts from Users. There is no separate chief-admin role.

Password sign-in, password reset, and the Account tab use the first migration. Approval is `002_approval.sql`. Preapproved admins are `004_preapproved_chief_admins.sql`. Shliach access is `005_shliach_access.sql`. Invite auto-approve is `014_invite_auto_approve.sql`. Apply migrations in numeric order. There is no `003` file.

The background photograph of 770 Eastern Parkway is credited in `docs/CREDITS.md` and on `/about`.

Row-level security stays on. Limited members only see households on routes assigned to them. The `people_visible` and `visits_visible` views hide phone, email, WhatsApp, notes, and reactions when those permissions are off.

### Dashboard settings

Authentication → URL configuration:

- Site URL: the production origin, for example `https://your-app.vercel.app`
- Redirect URLs:
  - `http://127.0.0.1:43123/auth/callback`
  - `http://127.0.0.1:43123/auth/recovery`
  - `https://your-app.vercel.app/auth/callback`
  - `https://your-app.vercel.app/auth/recovery`
  - `https://*.vercel.app/auth/callback` and `https://*.vercel.app/auth/recovery` if preview deployments should sign in

Authentication → Providers → Email: enabled. That one provider covers password sign-in, magic links, and password reset. Leave sign-ups enabled so an invited person, or one of the two allowlisted admins, can create an account. The database trigger, not the Auth setting, decides who gets a profile. Set the minimum password length to 8 so it matches the form. Confirm email can stay on: after Create account, the person confirms the address, then signs in with the password they chose. For real volume, set custom SMTP under Authentication → Emails.

Authentication → Emails → Confirm signup, so the link works from any device:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
```

Authentication → Emails → Reset password:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
```

The reset link returns to `/auth/recovery`, then Settings → Account, where they choose a new password. The default templates still work when the link opens in the same browser.

Authentication → Emails → Magic Link: replace the default link so it works from any device, not only the browser that requested it:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink">Sign in to Cora Connect</a>
```

The default template still works when the link opens in the same browser. That link uses a one-time code stored in a cookie.

Authentication → Providers → Google: off unless you set `NEXT_PUBLIC_AUTH_GOOGLE=true`. Then enable Google here and paste the Google client id and secret. Authorized redirect URI in Google Cloud is the Supabase callback, `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.

## Deploy on Vercel

1. Import the repository. Framework preset: Next.js. No `vercel.json` is required.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add `NEXT_PUBLIC_AUTH_GOOGLE=true` only after Google is enabled in Supabase. Add `NEXT_PUBLIC_SITE_URL` only if you want every auth email to return to one canonical origin.
3. Deploy. SQL is not part of the Vercel build. Apply `supabase/migrations/001_init.sql`, then `002_approval.sql`, then `004_preapproved_chief_admins.sql`, then `005_shliach_access.sql` before asking anyone new to sign up.

## Map and geocoding

Pins and the route line are drawn with Leaflet. Household coordinates in the seed come from a small built-in gazetteer of rural towns, with a stable offset per street so two homes in one town do not stack. CSV import uses the same gazetteer. The contact form does not ask for latitude and longitude. Unknown cities are saved without a pin.
