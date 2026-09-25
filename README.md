# Uni Schedule → ICS

A single-file, no-build web app that turns a messy university timetable
(with odd/even-week classes) into a standard `.ics` calendar file, plus
a `.vcf` contacts file for your professors. Everything runs in the
browser — no server, no account, no build step, no data leaves your
device.

## Deploy on GitHub Pages (2 minutes)

1. Create a new GitHub repository (public).
2. Upload `index.html` (plus `sw.js`, `favicon.ico`, `site.webmanifest`
   and the `icons/` folder) to the repository root (drag-and-drop on
   github.com works, or `git add`, `git commit`, `git push`).
3. Go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to `Deploy from a
   branch`, branch `main`, folder `/ (root)`. Save.
5. Wait ~1 minute, then open the URL GitHub shows you
   (`https://<username>.github.io/<repo>/`).

Anyone can open that link and use the app with their own browser
storage — nothing is shared between users, nothing is uploaded anywhere.
To share a timetable with classmates, send them your **Export backup**
file; they load it with **Import backup**.

After the first visit the app works fully offline (a service worker
caches its files). A new deploy is picked up in the background and
shows on the next visit.

## How to use it

1. **Settings tab** — general (name, reminder, credits needed, time
   zone) and a single semester start/end plus how your faculty counts
   odd/even weeks, which the export uses to figure out recurrence.
2. **Classes tab** — click the **+** (empty table, or the "Add class"
   row at the bottom), or click any existing row (or its pencil icon),
   to open the same form: day, start/end time, full course name, a
   short acronym, type, professor, room, credits, and whether it
   happens every week, only on odd weeks, or only on even weeks. The
   table itself only ever shows a compact, read-only summary — all
   editing happens in that one form.
   - The checkbox on each row marks whether you're actually enrolled —
     unenrolled classes stay in your catalog (dimmed) but are left out
     of credits totals, conflict checks, the calendar view and every
     export.
   - The **All / Odd / Even** toggle filters which classes are shown.
   - The **Table / Calendar** toggle switches between the table and a
     weekly grid. In the calendar: hover empty space to see a faint
     preview of where a class would land, then click (for a 1-hour
     slot) or click-and-drag (to pick a longer range) and release to
     open it prefilled with that day/time. Drag an existing class to
     move it — it snaps directly into the target hour cell as you drag,
     rather than trailing a floating cursor ghost — or drag the handle
     at its bottom edge to resize it. Everything snaps to the hour.
     Double-click a class (or either half of an odd/even split block)
     to open it in the edit form.
   - **Touch** (phones, tablets): tap empty space to add a class there;
     press and hold (about 0.4 s) before dragging to move, resize or
     draw a range — a drag without the hold scrolls the page as usual.
     Double-tap a class to edit it. On phone-width screens the
     calendar shows one day at a time: pick it from the day chips
     (a dot marks days with classes) or swipe left/right.
   - Course names adapt to the space available: the table shows
     "Full name · ACR" when it fits, then just the full name, then just
     the acronym; calendar blocks show the full name when it fits and
     the acronym otherwise. Hover for the full name. This is plain
     in-browser JavaScript, re-evaluated whenever the layout resizes.
   - In the table, a divider line separates each day's classes.
   - A strip below the table/calendar appears only when something needs
     attention: enrolled credits that don't match what's needed, or
     enrolled classes that overlap in day/time. It's gone the moment
     both are fine.
   - On narrower windows (a half-width desktop split or a phone), lower
     priority columns (professor, room, credits, week, then type) are
     hidden one by one rather than forcing horizontal scrolling — the
     freed space goes to the Course column. Everything's still one tap
     away in the edit form (on phones the pencil icon is hidden too;
     tap the row instead), and the week's color still shows as a thin
     bar on the left of each row.
3. **Holidays tab** — add date ranges (winter break, national
   holidays...). Any class occurrence inside a range is skipped in the
   export.
4. The **⋯** menu (top right of the Classes tab) holds export .ics,
   export contacts, export backup, and import backup. The blue button
   in the toolbar is for adding a new class.
5. **Export .ics** — downloads the calendar file to import into Google
   Calendar, Apple Calendar, Outlook, Thunderbird, etc.
6. **Export contacts** — downloads a `professors.vcf` with one contact
   per unique professor name (deduplicated), with their courses and
   rooms in the note field.
7. **Export backup / Import backup** — a JSON snapshot of everything,
   in case you clear your browser data or switch devices.
8. The **undo** arrow in the topbar (or Ctrl/⌘+Z outside text fields)
   steps back through every change of this visit — edits, deletes,
   drags, holidays, settings, imports. The moon/sun icon next to it
   toggles a light/dark theme. The topbar spans the full width of the page and stays put
   while you scroll — there's no separate window frame or sidebar; the
   content area centers itself at any width, from a full desktop screen
   down to a half-width split or a phone.

## Details worth knowing

- **Overlap detection**: two enrolled classes only count as a real
  conflict if they're on the same day, at overlapping times, and could
  actually land on the same real date — an odd-week class and an
  even-week class in the same slot never conflict, since they
  alternate. In the All view's calendar, that alternating pair is
  drawn as one block split diagonally (orange corner dot for odd,
  green for even) instead of a false side-by-side conflict. Genuine
  conflicts are drawn side by side with a diagonal hatch pattern and a
  warning outline.
- **Odd/even weeks** (Settings → Odd / even weeks), three conventions:
  - *ISO calendar week number* — the default. Note that years with 53
    ISO weeks (e.g. 2026) put week 53 and week 1 back to back, both
    odd; the export follows that exactly.
  - *Week count from semester start* — the week containing the start
    date is week 1 (odd), then strictly alternating.
  - *…skipping holiday weeks* — same, but a week whose Monday–Friday
    all fall inside Holidays ranges isn't counted.

  When a class's weeks strictly alternate, it's exported as an "every
  2 weeks" series; otherwise as a weekly series with the off weeks
  excluded, so the file never drifts from the chosen convention.
- **Time zone** (Settings → Time zone): *None* keeps exported times
  "floating" — every calendar app shows 08:00 as 08:00 in its own
  zone. Picking a zone pins the classes to it (with a `VTIMEZONE`
  holding that zone's real summer-time changes for the semester), so
  they show at the right moment on devices set to another zone. It's a
  named IANA zone rather than a bare "UTC+2" because both
  summer-time switches (late October, late March) fall inside a
  semester; a fixed offset would move classes by an hour after them.
- **Reminders**: the Settings reminder applies to every exported event
  as a `VALARM` popup alarm.
- **Colors**: each class "type" (Course, Seminar, Lab...) gets a
  consistent color, shown in the table and exported as the event
  `COLOR`/`CATEGORIES`, recognized by Google Calendar, Apple Calendar
  and Outlook.
- **Date format**: dates are always shown and typed as `DD.MM.YYYY`,
  whatever the browser's language — native date fields follow the
  browser's locale (US English shows `MM/DD/YYYY`) and ignore the
  page's language, so the app shows its own text field instead. Type
  `28.09.2026`, `28/9/2026` or just `28092026` (dots are added as you
  type, so a phone's number pad works), or use the calendar icon for
  the browser's date picker. An impossible date (e.g. `31.02.2026`) is
  rejected and the previous one kept. Stored and exported data is
  unchanged.
- **Keyboard**: table rows and calendar blocks are focusable (Tab);
  Enter opens the edit form, Escape closes it and returns focus, and
  Enter in a text field saves.
- **Contacts via WebDAV/CardDAV**: a static site can't run its own
  CardDAV server, so "Export contacts" produces a standard `.vcf` file
  instead. Any CardDAV-backed address book (iCloud, Google Contacts,
  Nextcloud, Thunderbird...) can import a `.vcf` directly into itself,
  which is the practical equivalent of adding them over WebDAV.

## Files

- `index.html` — the entire app (HTML/CSS/JS, no external dependencies
  at all — system fonts only, no CDN calls).
- `sw.js` — the service worker that makes the app work offline.
- `favicon.ico` (16/32/48 px), `icons/` (16/32 px PNG favicons, 180 px
  `apple-touch-icon.png`, 192/512 px app icons and a 512 px maskable
  icon) and `site.webmanifest` — the app icon set. All links use
  relative paths, so they work under a GitHub Pages project URL.
  Upload these alongside `index.html` when deploying.

## Tests

Browser tests (Playwright) cover the export rules, undo, import, table
layout, and calendar mouse/touch/keyboard interactions, plus offline
mode. They run on every push via GitHub Actions; locally:

```sh
npm ci
npx playwright install chromium
npm test
```

`package.json` exists only for the tests — the app itself still has no
build step or dependencies.
