# Wingsuit Skydiving Records Tool

Helps skydiving organizers and judges manage wingsuit record events: create an event, build its
skydiver pool, and export the roster to PDF.

## Release 1 scope

- **Record events**: name, drop zone, city/state, start–end dates, aircraft, organizer contact,
  Local Judge / S&TA contact, remote judges, and notes.
- **Skydiver pool**: first name, last name, optional nick name, USPA membership ID, membership expiration, USPA
  license number (optional; if entered it must be `D-12345` format, and `d12345` is normalized automatically).
  - Jumper numbers are assigned automatically, are sequential and unique per event, and are
    **never reused**. If #7 is removed, the next skydiver still gets #8.
  - A USPA membership ID can appear only once per event.
  - A **Videographer** checkbox (unchecked by default) marks camera flyers. They can be added to
    records but are never placed on the formation grid, and they are tagged in the roster, picker and PDF.
  - Expired memberships are allowed but flagged: **Expired** means it lapses before the event starts,
    and **Expires during event** means it lapses before the last day.
  - The roster and the record picker are sorted by first name, then last name, and show First name
    before Last name. Skydivers saved before names were split had
    their full name split automatically, with the last word becoming the last name.
- **Records**: each event can have several records, made up of:
  - **Zone**: National, State or USPA Open National. State also needs a US state, which starts on
    the event's state.
  - **Type**: WS - Large Formation (No-grip) Horizontal or Vertical, WS - Sequential Large Formation
    (No-grip) Horizontal or Vertical, or WS - Large Formation (Grip).
  - **Skydivers**: picked from the event pool, with search and select-all. A skydiver can be on
    several records. Removing someone from the pool also removes them from that event's records.
  - **Duplicate** opens a new-record form prefilled from a saved record (including every formation
    point). Nothing is saved until Create record, and an event can have several records with the
    same zone, state and type.
  - **Sequential formations**: the two *Sequential* types can have up to 20 formation points.
    "+ Add point" copies the last point exactly, so you only move the skydivers who change. Points
    can be removed, and all points share the record's skydivers and viewpoint. Other types keep a
    single grid; switching away from a sequential type keeps only Point 1 when you save.
  - **Point changes (75% rule)**: for sequential records, every change between consecutive points
    (1 → 2, 2 → 3, …) needs at least 75% of the formation skydivers (rounded up, videographers
    excluded) to change slot. This is a manual check: on each point from Point 2 on, the organizer
    ticks who changed slot since the previous point. New points start with no ticks. The record form
    shows the count for each change and flags a point's tab with ⚠ if it falls short. The record
    card shows "✓ Point changes OK" or which points fall short. It is a warning only; saving is
    still allowed.
  - **Record attempt date**: required, and must fall within the event's start–end dates. It is
    prefilled with the start date. Record cards warn if a record has no attempt date (records saved
    before this field existed) or if the event dates later change and leave it outside the range.
  - **Formation grid**: becomes active once non-videographer skydivers are picked. It is a square N × N grid
    (10 × 10 by default, 2–30, never smaller than needed to fit everyone). Each skydiver is shown as
    a wingsuit icon with their jumper number, and hovering shows their first name.
    - Icons can be dragged to another cell; dropping on another icon swaps the two.
    - On touch screens and keyboards, click an icon and then a cell, or use the arrow keys.
    - The layout is saved with the record, and a read-only view appears on the event page.
    - **Viewpoint**: Top-down (looking down from above) or Back-to-front (looking from behind, toward
      the front), each with its own pictogram. It shows beside the grid in the editor, the read-only
      view and the PDF. New records default to Top-down, or Back-to-front for Vertical types, until
      the organizer picks one. Older records default to Top-down.
    - New picks fill free cells starting from the **last** (bottom-right) cell and working backwards,
      in jumper-number order. If the grid shrinks, anyone left outside it moves to a free cell.
  - **Print PDF** on each record:
    - Titled "Zone: Type - N way" (or "State name: Type - N way" for State records), where N is
      the number of skydivers on the record, not counting videographers. The file name follows the
      title.
    - Details: event, organizer, drop zone, location, record attempt date, and Local and Remote
      Judge names, each with a badge showing their role.
    - **Participants** and **Videographers** tables (# , first and last name, USPA ID, license,
      expiration, status).
    - Two grids titled **Intended Formation**: one with icons, one with full names in the cells.
      Both show the viewpoint.
    - Sequential records: the title also ends with "- N-points" (or "- 1-point"). Under an
      **Intended Formation** heading, each point is printed as **Point #1**, **Point #2**, … with an
      icon grid and a names grid.
- **PDF export**: portrait US Letter, with event details and the roster table, including membership
  status and page numbers.
- **Accounts and roles** (Supabase Auth): email + password sign-in only. An admin creates every
  account and password in the Supabase dashboard; the app has no sign-up or password screens.
  - **admin**: sees and manages every event.
  - **organizer**: creates events and manages only the ones they created.
  - An account with no role can sign in but sees a "No access yet" screen.
  - These rules are enforced in the database (row level security), not just in the UI.
- **One-time import**: events saved in a browser before sign-in existed (localStorage) can be
  imported into the signed-in account, keeping jumper numbers, record skydivers and formation points.

- **Participant share links**: an event's owner (or an admin) can create a read-only link from the
  event page. Anyone with the link can open `/share/<token>` without signing in, and sees:
  - the event name, place and dates,
  - the organizer's name, and the judges' names and roles,
  - each record: type, zone, attempt date, participants, videographers, and every formation point
    with its viewpoint,
  - skydiver names and jumper numbers.

  It never shows USPA IDs, licenses, membership dates or status, phone numbers, emails or notes, and
  it has no PDF or edit buttons. **New link** replaces the token, so old links stop working, and
  **Stop sharing** turns the link off.

Out of scope for now: a judge role, non-USPA memberships.

## Architecture

A static React app talking directly to Supabase (Auth + Postgres). There is no server of our own.

```
client/  React 18 + TypeScript + Tailwind (Vite)
  src/state/AuthContext.tsx    Supabase session + the user's role (user_roles)
  src/state/EventsContext.tsx  validates input, calls the store, keeps events in React state
  src/data/supabaseStore.ts    reads/writes Supabase tables (row ↔ app types)
  src/data/memoryStore.ts      in-memory store for UI tests (built on state/eventOps.ts)
  src/lib/                     validation, membership status, dates, legacy import, PDF download
  src/pdf/documents.ts         roster and record PDFs, drawn in the browser with pdfkit
supabase/
  migrations/                  schema, row level security, grants, triggers
  seed.sql                     LOCAL ONLY: test admin + organizer accounts
  config.toml                  local stack settings (sign-ups off)
```

**Database**: `user_roles`, `events`, `skydivers`, `records` (formation points stored as JSON).
Row level security limits every row to admins or the event's creator. Anonymous visitors get no
table access: the only thing they can call is `get_shared_event(token)`, which returns the
participant subset of a shared event. The database also assigns jumper numbers (never reused),
rejects duplicate USPA IDs within an event, and removes a deleted skydiver from every record and
formation point.

**PDFs**: built in the browser with pdfkit's standalone build, which includes its fonts. That code
is about 1.5 MB (about 420 KB compressed), so it is downloaded only the first time someone clicks
Export or Print PDF; the first print takes a moment longer.

## Running

Requires **Node 22 or newer** (pinned in `.nvmrc`). With [fnm](https://github.com/Schniz/fnm),
running `fnm use` in the repo root switches to it. Add `eval "$(fnm env --use-on-cd)"` to your
shell profile to switch automatically.

```bash
npm install
npm run dev          # http://localhost:5173, using client/.env.local (your Supabase project)
npm test             # unit + UI tests (no database needed)
npm run typecheck
npm run build        # static site in client/dist
npm run preview      # serve the production build locally
```

`client/.env.local` (not committed):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

### Local Supabase (optional, needs Docker)

```bash
npm run db:start      # start the local stack; applies migrations + seed.sql
npm run dev:localdb   # app against the local stack (client/.env.localdb)
npm run test:db       # database permission tests against the local stack
npm run db:reset      # rebuild the local database from migrations + seed
npm run db:stop
```

Create `client/.env.localdb` with the local API URL (`http://127.0.0.1:54321`) and the
`PUBLISHABLE_KEY` printed by `npx supabase status`. The seed creates `admin@wingsuit.test` and
`organizer@wingsuit.test` with the password `local-dev-password`, for the local stack only.

If `db:start` hangs while pulling images, Docker's keychain credential helper may be waiting. The
images are public, so you can run it with an empty Docker config:
`DOCKER_CONFIG=$(mktemp -d) npx supabase start`.

## Supabase project setup (hosted)

1. **Project settings**: keep **Data API** on, and turn **Automatically expose new tables** off. The
   migration grants exactly what the app needs.
2. **Schema**: in the **SQL Editor**, run each file in `supabase/migrations/` once, in order:
   1. `20261012120000_initial_schema.sql`: tables, roles and row level security.
   2. `20261013090000_share_links.sql`: participant share links.
3. **Sign-ups off, email login on**: under **Authentication → Sign In / Providers**, turn off
   **Allow new users to sign up**, but keep the **Email** provider enabled. Disabling the Email
   provider would block password logins entirely.
4. **URLs**: under **Authentication → URL Configuration**, set the Site URL to where the app is hosted,
   and add `http://localhost:5173` to the redirect URLs for local use.
5. **Create a user**: **Authentication → Users → Add user → Create new user**, with email, password
   and **Auto Confirm User** ticked. Then give them a role in the SQL Editor:

   ```sql
   insert into public.user_roles (user_id, role, display_name)
   select id, 'organizer', 'Pat Organizer' from auth.users where email = 'pat@example.com';
   -- role is 'admin' or 'organizer'
   ```

6. **Reset a password** (there is no reset screen in the app):

   ```sql
   update auth.users
      set encrypted_password = extensions.crypt('new-password-here', extensions.gen_salt('bf'))
    where email = 'pat@example.com';
   ```

7. **Remove access**: `delete from public.user_roles where user_id = (select id from auth.users where email = '…');`
   The account can still sign in but sees "No access yet". An organizer who still owns events can't
   be deleted from Authentication until their events are deleted.

## Deploying to Vercel

`vercel.json` holds all the build settings:
- `npm ci`, then `npm run build`, serving `client/dist` on Node 22 (from `engines` in
  `package.json`).
- Every page path is rewritten to `index.html`, so `/events/<id>` and `/share/<token>` work when
  opened directly.
- Hashed `/assets/*` files are cached for a year, and a few basic security headers are added.

One-time setup:

1. Sign in at vercel.com with GitHub, choose **Add New → Project**, and import
   `sudeepkodavati/wingsuitrecordstool`. Leave **Root Directory** as `./`; the settings come from
   `vercel.json`.
2. Under **Environment Variables**, add both for Production and Preview:
   - `VITE_SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: `sb_publishable_…`
3. Click **Deploy**.
4. In Supabase, open **Authentication → URL Configuration** and set the **Site URL** to the Vercel
   address (for example `https://wingsuitrecordstool.vercel.app`).

After that, every push to `main` deploys to production, and other branches get preview URLs.
These variables are built into the JavaScript, so after changing one, redeploy (Deployments → ⋯ →
Redeploy).

Vercel's free Hobby plan is for non-commercial use; commercial use needs Pro.

Other static hosts (Netlify, Cloudflare Pages) work too: build with `npm run build`, serve
`client/dist`, and send every page path to `index.html`.

## Upgrading

The toolchain is current: Node 22, Vite 8, Vitest 5, TypeScript 7 and React Router 7. Tailwind is
still on v3.4. The remaining `npm audit` findings all come from Tailwind 3's build-time
dependencies (braces, micromatch, postcss-selector-parser); they never reach the deployed site.
Migrating to Tailwind 4 clears them.

## Known limitations

- The PDF uses built-in Helvetica, which covers Latin characters (for example `María`, `Zoë`) but
  not non-Latin scripts (Cyrillic, CJK). To support those, embed a Unicode TTF in `client/src/pdf/documents.ts`.
- If two people edit the same event at the same moment, the last save wins (other screens see the
  change after a page reload).
