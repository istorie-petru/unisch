// Backup import and the universal undo.
const { test, expect } = require("@playwright/test");
const { STORAGE_KEY, course, appState, openWith } = require("./helpers");

const stored = (page)=> page.evaluate((k)=> JSON.parse(localStorage.getItem(k)), STORAGE_KEY);

test("import normalizes old backups without adding stale fields", async ({ page })=>{
  await openWith(page, appState());
  const backup = { courses: [{ id: "x", day: "Tuesday", start: "10:00", end: "12:00", name: "Old", semester: "sem2" }], settings: {} };
  await page.locator("#fileImport").setInputFiles({ name: "b.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.locator("#coursesBody tr[data-id='x']")).toBeVisible();
  const c = (await stored(page)).courses[0];
  expect(c.semester).toBeUndefined();
  expect(c).toMatchObject({ enrolled: true, credits: 0, acronym: "", parity: "all" });
});

test("undo restores a deleted class, from the button and from Ctrl+Z", async ({ page })=>{
  await openWith(page, appState({ courses: [course({ id: "a", name: "Algebra" }), course({ id: "b", name: "Baze", day: "Tuesday" })] }));
  const undo = page.getByRole("button", { name: "Undo" });
  await expect(undo).toBeDisabled();

  await page.getByRole("button", { name: "Delete Algebra" }).click();
  await expect(page.locator("tr[data-id='a']")).toHaveCount(0);
  await undo.click();
  await expect(page.locator("tr[data-id='a']")).toHaveCount(1);
  expect((await stored(page)).courses.map(c => c.id)).toEqual(["a", "b"]);
  await expect(undo).toBeDisabled();

  await page.getByRole("button", { name: "Delete Baze" }).click();
  await expect(page.locator("tr[data-id='b']")).toHaveCount(0);
  await page.locator("body").press("Control+z");
  await expect(page.locator("tr[data-id='b']")).toHaveCount(1);
});

test("undo covers settings and holidays too, step by step", async ({ page })=>{
  await openWith(page, appState());
  await page.getByRole("button", { name: "Settings" }).click();
  await page.fill("#calName", "First"); await page.locator("#calName").blur();
  await page.fill("#calName", "Second"); await page.locator("#calName").blur();
  await page.getByRole("button", { name: "Holidays" }).click();
  await page.locator("#btnEmptyAddHoliday").click();
  expect((await stored(page)).holidays).toHaveLength(1);

  const undo = page.getByRole("button", { name: "Undo" });
  await undo.click();
  expect((await stored(page)).holidays).toHaveLength(0);
  await undo.click();
  expect((await stored(page)).settings.calName).toBe("First");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.locator("#calName")).toHaveValue("First");
});

test("delete all data wipes local storage after a confirming second click", async ({ page })=>{
  await openWith(page, appState({ courses: [course({ id: "a" })], holidays: [{ id: "h", label: "Break", start: "2026-12-21", end: "2026-12-27" }] }));
  await page.evaluate(()=>{ localStorage.setItem("uniScheduleIcs.theme", "dark"); localStorage.setItem("uniScheduleIcs.v2", "{}"); localStorage.setItem("other-app", "keep"); });
  await page.getByRole("button", { name: "Holidays" }).click();
  await page.getByRole("button", { name: "Settings" }).click();

  const wipe = page.getByRole("button", { name: "Delete all data" });
  await wipe.click(); // first click only arms it
  await expect(page.getByRole("button", { name: "Click again to delete everything" })).toBeVisible();
  expect((await stored(page)).courses).toHaveLength(1);

  await page.getByRole("button", { name: "Click again to delete everything" }).click();
  const keys = await page.evaluate(()=> Object.keys(localStorage));
  expect(keys).toEqual(["other-app"]); // only the app's own keys are removed
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Classes" }).click();
  await expect(page.locator("#coursesBody tr[data-id]")).toHaveCount(0);

  await page.reload(); // stays empty after reload
  await expect(page.locator("#coursesEmpty")).toBeVisible();
});

test("the delete button disarms itself if not confirmed", async ({ page })=>{
  await openWith(page, appState({ courses: [course({ id: "a" })] }));
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Delete all data" }).click();
  await page.locator("#calName").click(); // focus moves away
  await expect(page.getByRole("button", { name: "Delete all data" })).toBeVisible();
  expect((await stored(page)).courses).toHaveLength(1);
});
