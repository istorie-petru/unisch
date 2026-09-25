# Uni Schedule → ICS

A single-file, no-build web app that turns a messy university timetable
(with odd/even-week classes) into a standard `.ics` calendar file, plus
a `.vcf` contacts file for your professors. Everything runs in the
browser — no server, no account, no build step, no data leaves your
device.

## Deploy on GitHub Pages (2 minutes)

1. Create a new GitHub repository (public).
2. Upload `index.html` (plus `favicon.ico`, `site.webmanifest` and the
   `icons/` folder) to the repository root (drag-and-drop on
   github.com works, or `git add`, `git commit`, `git push`).
3. Go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to `Deploy from a
   branch`, branch `main`, folder `/ (root)`. Save.
5. Wait ~1 minute, then open the URL GitHub shows you
   (`https://<username>.github.io/<repo>/`).

Anyone can open that link and use the app with their own browser
storage — nothing is shared between users, nothing is uploaded anywhere.

## How to use it

1. **Settings tab** — general (name, reminder, credits needed) and a
   single semester start/end, which the export uses to figure out
   recurrence.
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
     weekly grid (which shows each class's acronym, since space is
     tight). In the calendar: hover empty space to see a faint preview
     of where a class would land, then click (for a 1-hour slot) or
     click-and-drag (to pick a longer range) and release to open it
     prefilled with that day/time. Drag an existing class to move it —
     it snaps directly into the target hour cell as you drag, rather
     than trailing a floating cursor ghost — or drag the handle at its
     bottom edge to resize it. Everything snaps to the hour.
     Double-click a class (or either half of an odd/even split block)
     to open it in the edit form.
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
8. The moon/sun icon at the right of the topbar toggles a light/dark
   theme. The topbar spans the full width of the page and stays put
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
- **Odd/even weeks**: based on the ISO-8601 calendar week number (the
  convention most European timetables already use), not on counting
  weeks from the semester start. If your university numbers weeks the
  other way round, just flip which parity you assign per class.
- **Reminders**: the Settings reminder applies to every exported event
  as a `VALARM` popup alarm.
- **Colors**: each class "type" (Course, Seminar, Lab...) gets a
  consistent color, shown in the table and exported as the event
  `COLOR`/`CATEGORIES`, recognized by Google Calendar, Apple Calendar
  and Outlook.
- **Date/time format**: the page is set to `lang="ro"`, so browsers
  display native date/time pickers in the European `DD.MM.YYYY` / 24h
  format rather than the US `MM/DD/YYYY` / AM-PM format. This depends
  on browser support; the underlying data is unaffected either way.
- **Contacts via WebDAV/CardDAV**: a static site can't run its own
  CardDAV server, so "Export contacts" produces a standard `.vcf` file
  instead. Any CardDAV-backed address book (iCloud, Google Contacts,
  Nextcloud, Thunderbird...) can import a `.vcf` directly into itself,
  which is the practical equivalent of adding them over WebDAV.

## Files

- `index.html` — the entire app (HTML/CSS/JS, no external dependencies
  at all — system fonts only, no CDN calls).
- `favicon.ico` (16/32/48 px), `icons/` (16/32 px PNG favicons, 180 px
  `apple-touch-icon.png`, 192/512 px app icons and a 512 px maskable
  icon) and `site.webmanifest` — the app icon set. All links use
  relative paths, so they work under a GitHub Pages project URL.
  Upload these alongside `index.html` when deploying.
