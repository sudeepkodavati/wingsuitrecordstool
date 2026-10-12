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
  - One event can't have two records with the same zone, state and type.
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
- **PDF export**: portrait US Letter, with event details and the roster table, including membership
  status and page numbers.
- **Organizer profiles** (no login): on first visit you enter your name. Events remember which
  profile created them, and only that profile can edit or delete the event or change its pool.
  Other profiles have view and export access only. This is a convenience guard, **not security**.

Out of scope for now: login, database, non-USPA memberships.

## Architecture

```
client/  React 18 + TypeScript + Tailwind (Vite)
  src/state/eventOps.ts     pure event/skydiver operations (ownership, validation, numbering)
  src/state/*Context.tsx    React state, persisted to browser localStorage
  src/lib/                  validation, membership status, dates, storage, PDF download
server/  Node + Express + TypeScript
  POST /api/events/pdf      validates the event (zod) and renders the roster PDF (pdfkit)
  POST /api/records/pdf     renders one record's PDF (skydiver table + formation grid)
  GET  /api/health
```

**Storage**: all data lives in the browser's `localStorage` (keys `wsr:v1:*`). It stays on that
browser and device. Clearing site data erases it, and it is not shared between people. Because the
server stores nothing, the client sends the full event to the server when it exports a PDF.

## Running

Requires Node 16.14 or newer. Dependencies are pinned to versions that support Node 16; see
[Upgrading](#upgrading).

```bash
npm install
npm run dev        # client http://localhost:5173 (proxies /api) + server http://localhost:3001
npm test           # server (vitest + supertest) and client (vitest + Testing Library)
npm run typecheck
npm run build && npm start   # production: server on :3001 serves the built client
```

## Upgrading

The toolchain is held back because this machine runs Node 16. On Node 20 or newer, upgrade to
Vite 6+, Vitest 3+ and React Router 7. That clears the current `npm audit` findings, which are
all dev-server or test-only issues, or apply to React Router features this app doesn't use (SSR,
user-supplied link targets).

## Known limitations

- The PDF uses built-in Helvetica, which covers Latin characters (for example `María`, `Zoë`) but
  not non-Latin scripts (Cyrillic, CJK). To support those, embed a Unicode TTF in `server/src/pdf.ts`.
- If the same event is edited in two browser tabs at once, the last write wins.
