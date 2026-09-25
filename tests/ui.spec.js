// Table layout, calendar interactions (mouse, touch, keyboard) and the phone day view.
const { test, expect } = require("@playwright/test");
const { course, appState, openWith } = require("./helpers");

const COURSES = [
  course({ id: "alg", name: "Algebra liniară și geometrie analitică", acronym: "ALG" }),
  course({ id: "poo", name: "Programare orientată pe obiecte", acronym: "POO", day: "Monday", start: "10:00", end: "12:00", parity: "odd", type: "Laboratory" }),
  course({ id: "bd", name: "Baze de date", acronym: "BD", day: "Monday", start: "10:00", end: "12:00", parity: "even", type: "Seminar" }),
  course({ id: "so", name: "Sisteme de operare", acronym: "SO", day: "Tuesday", start: "12:00", end: "14:00" }),
  course({ id: "rc", name: "Rețele", acronym: "RC", day: "Wednesday", start: "14:00", end: "16:00" })
];

const stored = (page)=> page.evaluate(()=> JSON.parse(localStorage.getItem("uniScheduleIcs.v3")));

for(const width of [1200, 950, 820, 700, 600, 500, 375]){
  test(`table columns always fill the row at ${width}px`, async ({ page })=>{
    await page.setViewportSize({ width, height: 700 });
    await openWith(page, appState({ courses: COURSES }));
    const { table, sum } = await page.evaluate(()=>{
      const t = document.querySelector("#tableCard table");
      const cells = [...t.querySelectorAll("thead th")].map(th => th.getBoundingClientRect().width);
      return { table: t.getBoundingClientRect().width, sum: cells.reduce((a, b)=> a + b, 0) };
    });
    expect(Math.abs(table - sum)).toBeLessThan(1);
    expect(await page.evaluate(()=> document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("a divider row separates days in the table", async ({ page })=>{
  await openWith(page, appState({ courses: COURSES }));
  await expect(page.locator("#coursesBody tr.day-sep")).toHaveCount(2); // Mon|Tue, Tue|Wed
});

test("course labels fall back to the acronym when the full name does not fit", async ({ page })=>{
  await page.setViewportSize({ width: 1200, height: 700 });
  await openWith(page, appState({ courses: COURSES }));
  const label = page.locator("tr[data-id='alg'] .fit-label");
  await expect(label).toContainText("Algebra liniară");
  await page.setViewportSize({ width: 400, height: 700 });
  await expect(label).toHaveText("ALG");
});

test.describe("calendar", ()=>{
  test.beforeEach(async ({ page })=>{
    await page.setViewportSize({ width: 1200, height: 800 });
    await openWith(page, appState({ courses: COURSES }));
    await page.getByRole("button", { name: "Calendar" }).click();
  });

  test("double-click opens the editor; a single click does not", async ({ page })=>{
    const ev = page.getByRole("button", { name: /^Sisteme de operare/ });
    await ev.click();
    await expect(page.locator("#modalOverlay")).not.toHaveClass(/is-open/);
    await ev.dblclick();
    await expect(page.locator("#modalOverlay")).toHaveClass(/is-open/);
    await expect(page.locator("#mName")).toHaveValue("Sisteme de operare");
  });

  test("each half of an odd/even split opens its own class", async ({ page })=>{
    const box = await page.locator(".diagonal-wrap").boundingBox();
    await page.mouse.dblclick(box.x + 10, box.y + box.height * 0.25);
    await expect(page.locator("#mName")).toHaveValue("Programare orientată pe obiecte");
    await page.keyboard.press("Escape");
    await expect(page.locator("#modalOverlay")).toBeHidden(); // wait out the fade
    await page.mouse.dblclick(box.x + box.width - 10, box.y + box.height * 0.8);
    await expect(page.locator("#mName")).toHaveValue("Baze de date");
  });

  test("keyboard: Enter on a focused class opens it, Escape returns focus", async ({ page })=>{
    const ev = page.getByRole("button", { name: /^Sisteme de operare/ });
    await ev.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#mName")).toHaveValue("Sisteme de operare");
    await page.keyboard.press("Escape");
    await expect(ev).toBeFocused();
  });

  test("mouse drag moves a class to another day and hour", async ({ page })=>{
    const ev = page.getByRole("button", { name: /^Sisteme de operare/ });
    const b = await ev.boundingBox();
    const thu = (await page.locator(".week-head .wd", { hasText: "Thu" }).boundingBox());
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    await page.mouse.move(thu.x + 20, b.y + 10 + 46 * 2, { steps: 5 });
    await page.mouse.up();
    const so = (await stored(page)).courses.find(c => c.id === "so");
    expect(so).toMatchObject({ day: "Thursday", start: "14:00", end: "16:00" });
  });
});

test.describe("touch", ()=>{
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 740 } });

  // Chromium touch input via CDP (Playwright has no touch-drag API).
  async function touch(page){
    const cdp = await page.context().newCDPSession(page);
    const send = (type, x, y)=> cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    return {
      async tap(x, y){ await send("touchStart", x, y); await send("touchEnd"); },
      async longPressDrag(x, y, x2, y2){
        await send("touchStart", x, y);
        await page.waitForTimeout(500);
        for(let i = 1; i <= 5; i++) await send("touchMove", x + (x2 - x) * i / 5, y + (y2 - y) * i / 5);
        await send("touchEnd");
      },
      async swipe(x, y, x2, y2){
        await send("touchStart", x, y);
        for(let i = 1; i <= 5; i++) await send("touchMove", x + (x2 - x) * i / 5, y + (y2 - y) * i / 5);
        await send("touchEnd");
      }
    };
  }

  test.beforeEach(async ({ page })=>{
    await openWith(page, appState({ courses: COURSES }));
    await page.getByRole("button", { name: "Calendar" }).click();
  });

  test("phones get a one-day view with a day picker and swipe", async ({ page })=>{
    await expect(page.locator(".week-body .week-col")).toHaveCount(1);
    await expect(page.locator(".day-chip.active")).toHaveText("Mon");
    const t = await touch(page);
    const grid = await page.locator(".week-body").boundingBox();
    await t.swipe(grid.x + grid.width - 30, grid.y + 60, grid.x + 40, grid.y + 70);
    await expect(page.locator(".day-chip.active")).toHaveText("Tue");
    await page.locator(".day-chip", { hasText: "Wed" }).click();
    await expect(page.getByRole("button", { name: /^Rețele/ })).toBeVisible();
  });

  test("long-press drag moves a class; a quick swipe-free tap does not", async ({ page })=>{
    const t = await touch(page);
    const ev = page.getByRole("button", { name: /^Algebra/ });
    const b = await ev.boundingBox();
    await t.tap(b.x + 20, b.y + 10);
    expect((await stored(page)).courses.find(c => c.id === "alg").start).toBe("08:00");
    await page.waitForTimeout(400); // let the tap not pair with the next touch
    await t.longPressDrag(b.x + 20, b.y + 10, b.x + 20, b.y + 10 + 46 * 4);
    expect((await stored(page)).courses.find(c => c.id === "alg")).toMatchObject({ start: "12:00", end: "14:00" });
  });

  test("double-tap opens the editor", async ({ page })=>{
    const t = await touch(page);
    const b = await page.getByRole("button", { name: /^Algebra/ }).boundingBox();
    await t.tap(b.x + 20, b.y + 10);
    await t.tap(b.x + 20, b.y + 10);
    await expect(page.locator("#mName")).toHaveValue("Algebra liniară și geometrie analitică");
  });

  test("tapping empty space starts a new class at that hour", async ({ page })=>{
    const t = await touch(page);
    const col = await page.locator(".week-col").boundingBox();
    await t.tap(col.x + col.width / 2, col.y + 46 * 9 + 20); // 17:00 row
    await expect(page.locator("#modalTitle")).toHaveText("Add class");
    await expect(page.locator("#mStart")).toHaveValue("17:00");
  });
});

test("keyboard: rows open with Enter and the form traps Tab", async ({ page })=>{
  await openWith(page, appState({ courses: COURSES }));
  const row = page.locator("tr[data-id='so']");
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mName")).toHaveValue("Sisteme de operare");
  for(let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(()=> !!document.activeElement.closest("#modalOverlay"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
});
