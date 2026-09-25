// .ics export: week parity modes, series shape, RFC 5545 details, time zones.
const { test, expect } = require("@playwright/test");
const { course, appState, openWith, expandIcs, isoWeek, mondays } = require("./helpers");

// 2026 has 53 ISO weeks, so a winter semester crossing New Year has two odd
// ISO weeks back to back (53 and 1).
const SEMESTER = { semStart: "2026-09-28", semEnd: "2027-01-31" };
const ODD_MON = course({ id: "odd", parity: "odd" });
const EVEN_MON = course({ id: "even", parity: "even", start: "10:00", end: "12:00" });

async function exportIcs(page, settings, holidays){
  await openWith(page, appState({ courses: [ODD_MON, EVEN_MON], holidays: holidays || [], settings: Object.assign({}, SEMESTER, settings) }));
  return page.evaluate(()=> window.__uniSchedule.buildIcs());
}

test("ISO mode follows the real ISO week number across a 53-week year", async ({ page })=>{
  const ics = await exportIcs(page, { parityMode: "iso" });
  const got = expandIcs(ics);
  const all = mondays("2026-09-28", "2027-01-25");
  expect(got.odd).toEqual(all.filter(d => isoWeek(d) % 2 === 1));
  expect(got.even).toEqual(all.filter(d => isoWeek(d) % 2 === 0));
  // Week 53 and week 1 are both odd — the case a plain "every 2 weeks" rule gets wrong.
  expect(got.odd).toContain("2026-12-28");
  expect(got.odd).toContain("2027-01-04");
  expect(ics).toMatch(/UID:odd@[\s\S]*?RRULE:FREQ=WEEKLY;INTERVAL=1;/);
});

test("ISO mode keeps the clean every-2-weeks series when nothing breaks the alternation", async ({ page })=>{
  const ics = await exportIcs(page, { parityMode: "iso", semEnd: "2026-12-20" });
  expect(ics).toMatch(/UID:odd@[\s\S]*?INTERVAL=2;/);
  expect(ics).not.toMatch(/^EXDATE/m);
});

test("semester mode counts from the week containing the start date", async ({ page })=>{
  const ics = await exportIcs(page, { parityMode: "semester", semStart: "2026-09-30" }); // a Wednesday
  const got = expandIcs(ics);
  const all = mondays("2026-10-05", "2027-01-25"); // first Monday on/after the start
  // Week 1 (odd) is Mon 28 Sep – Sun 4 Oct, so Mon 5 Oct is week 2 (even).
  expect(got.even[0]).toBe("2026-10-05");
  expect(got.odd).toEqual(all.filter((_, i)=> i % 2 === 1));
  expect(got.even).toEqual(all.filter((_, i)=> i % 2 === 0));
  expect(ics).toMatch(/UID:odd@[\s\S]*?INTERVAL=2;/);
});

test("semester-skip mode does not count holiday weeks", async ({ page })=>{
  const holidays = [{ id: "h", label: "Christmas", start: "2026-12-21", end: "2026-12-27" }];
  const skip = expandIcs(await exportIcs(page, { parityMode: "semester-skip" }, holidays));
  // Week 13 (21–27 Dec) is skipped, so Mon 28 Dec is week 13 again: odd.
  expect(skip.odd).toContain("2026-12-28");
  expect(skip.odd).not.toContain("2026-12-21");
  expect(skip.even).toContain("2026-12-14");
  expect(skip.even).toContain("2027-01-04");
});

test("semester mode without skipping keeps counting through holidays", async ({ page })=>{
  const holidays = [{ id: "h", label: "Christmas", start: "2026-12-21", end: "2026-12-27" }];
  const plain = expandIcs(await exportIcs(page, { parityMode: "semester" }, holidays));
  expect(plain.odd).not.toContain("2026-12-21"); // holiday
  expect(plain.even).toContain("2026-12-28");    // week 14
});

test("DTSTAMP is UTC and times stay floating without a time zone", async ({ page })=>{
  const ics = await exportIcs(page, {});
  expect(ics).toMatch(/^DTSTAMP:\d{8}T\d{6}Z\r?$/m);
  expect(ics).toMatch(/^DTSTART:20261005T080000\r?$/m); // 28 Sep is ISO week 40 (even)
  expect(ics).not.toContain("VTIMEZONE");
});

test("time zone setting pins times and embeds the zone's real DST transitions", async ({ page })=>{
  const ics = await exportIcs(page, { timeZone: "Europe/Bucharest", parityMode: "semester" });
  expect(ics).toMatch(/^DTSTART;TZID=Europe\/Bucharest:20260928T080000\r?$/m); // semester week 1
  expect(ics).toMatch(/^X-WR-TIMEZONE:Europe\/Bucharest\r?$/m);
  // UNTIL must be UTC when DTSTART has a TZID.
  expect(ics).toMatch(/UNTIL=\d{8}T\d{6}Z/);
  // EU summer time ends Sun 25 Oct 2026, 04:00 local (EEST, +03) -> 03:00 (EET, +02).
  const vtz = ics.slice(ics.indexOf("BEGIN:VTIMEZONE"), ics.indexOf("END:VTIMEZONE"));
  expect(vtz).toMatch(/BEGIN:STANDARD\r\nDTSTART:20261025T040000\r\nTZOFFSETFROM:\+0300\r\nTZOFFSETTO:\+0200/);
  // Occurrences are unchanged by the zone.
  expect(expandIcs(ics).odd).toEqual(expandIcs(await page.evaluate(()=>{
    window.__uniSchedule.state.settings.timeZone = "";
    return window.__uniSchedule.buildIcs();
  })).odd);
});

test("time zone and parity settings are selectable in Settings", async ({ page })=>{
  await openWith(page, appState());
  await page.getByRole("button", { name: "Settings" }).click();
  await page.selectOption("#timeZone", "Europe/Bucharest");
  await page.selectOption("#parityMode", "semester-skip");
  const saved = await page.evaluate(()=> JSON.parse(localStorage.getItem("uniScheduleIcs.v3")).settings);
  expect(saved.timeZone).toBe("Europe/Bucharest");
  expect(saved.parityMode).toBe("semester-skip");
  await expect(page.locator("#timeZone option[value='Europe/Bucharest']")).toContainText("UTC+02:00");
});
