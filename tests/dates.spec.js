// Dates show and accept DD.MM.YYYY whatever the browser's locale; storage stays ISO.
const { test, expect } = require("@playwright/test");
const { STORAGE_KEY, appState, openWith } = require("./helpers");

test.use({ locale: "en-US" }); // the locale that shows MM/DD/YYYY in native date inputs

const stored = (page)=> page.evaluate((k)=> JSON.parse(localStorage.getItem(k)), STORAGE_KEY);

test("semester dates display as DD.MM.YYYY and save as ISO", async ({ page })=>{
  await openWith(page, appState({ settings: { semStart: "2026-09-28", semEnd: "" } }));
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("#semStartText")).toHaveValue("28.09.2026");

  // Digits only (phone keypad): dots are inserted while typing.
  const end = page.locator("#semEndText");
  await end.pressSequentially("31012027");
  await expect(end).toHaveValue("31.01.2027");
  await end.press("Enter");
  expect((await stored(page)).settings.semEnd).toBe("2027-01-31");

  // Own separators are accepted too.
  await end.fill("1/2/2027");
  await end.blur();
  await expect(end).toHaveValue("01.02.2027");
  expect((await stored(page)).settings.semEnd).toBe("2027-02-01");
});

test("an impossible date is rejected and the last valid one restored", async ({ page })=>{
  await openWith(page, appState({ settings: { semStart: "2026-09-28" } }));
  await page.getByRole("button", { name: "Settings" }).click();
  const start = page.locator("#semStartText");
  await start.fill("31.02.2026");
  await start.blur();
  await expect(start).toHaveValue("28.09.2026");
  expect((await stored(page)).settings.semStart).toBe("2026-09-28");
});

test("a date picked from the native calendar updates the text", async ({ page })=>{
  await openWith(page, appState());
  await page.getByRole("button", { name: "Settings" }).click();
  await page.evaluate(()=>{
    const native = document.getElementById("semStart");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(native, "2026-10-05");
    native.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#semStartText")).toHaveValue("05.10.2026");
  expect((await stored(page)).settings.semStart).toBe("2026-10-05");
});

test("holiday ranges use the same format", async ({ page })=>{
  await openWith(page, appState({ holidays: [{ id: "h", label: "Winter", start: "2026-12-21", end: "" }] }));
  await page.getByRole("button", { name: "Holidays" }).click();
  await expect(page.getByRole("textbox", { name: "From" })).toHaveValue("21.12.2026");
  await page.getByRole("textbox", { name: "To" }).fill("03.01.2027");
  await page.getByRole("textbox", { name: "To" }).press("Enter");
  expect((await stored(page)).holidays[0]).toMatchObject({ start: "2026-12-21", end: "2027-01-03" });
});

test("a date still being typed is saved before the .ics is exported", async ({ page })=>{
  await openWith(page, appState({
    courses: [{ id: "c", day: "Monday", start: "08:00", end: "10:00", name: "Algebra", parity: "all", enrolled: true }],
    holidays: [{ id: "h", label: "Winter", start: "2026-12-21", end: "2026-12-27" }],
    settings: { semStart: "2026-09-28", semEnd: "2027-01-31" }
  }));
  await page.getByRole("button", { name: "Holidays" }).click();
  const to = page.getByRole("textbox", { name: "To" });
  await to.fill("06.01.2027");
  await expect(to).toBeFocused();
  // A click that leaves focus in the field (as on some mobile browsers).
  const download = page.waitForEvent("download");
  await page.evaluate(()=> document.getElementById("btnExportIcs").click());
  await download;
  expect((await stored(page)).holidays[0].end).toBe("2027-01-06");
});
