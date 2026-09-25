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

// The white separator of an odd/even split block must lie exactly on the
// corner-to-corner diagonal the two halves are cut along, whatever the
// block's aspect ratio (1h/3h blocks, desktop and one-day phone widths).
for(const [label, width, end] of [["1h desktop", 1200, "11:00"], ["3h desktop", 1200, "13:00"], ["2h phone", 375, "12:00"]]){
  test(`odd/even separator follows the block's diagonal (${label})`, async ({ page })=>{
    await page.setViewportSize({ width, height: 900 });
    await openWith(page, appState({ courses: [
      course({ id: "o", parity: "odd", start: "10:00", end }),
      course({ id: "e", parity: "even", start: "10:00", end, type: "Seminar" })
    ] }));
    await page.getByRole("button", { name: "Calendar" }).click();
    const block = page.locator(".diagonal-wrap");
    const png = (await block.screenshot()).toString("base64");
    const samples = await page.evaluate(async (data)=>{
      const img = new Image(); img.src = "data:image/png;base64," + data; await img.decode();
      const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      const W = img.width, H = img.height;
      // Brightness at fraction t along the top-right -> bottom-left diagonal,
      // shifted `off` px perpendicular to it.
      const len = Math.hypot(W, H), nx = H / len, ny = W / len;
      const at = (t, off)=>{
        const px = Math.round(W * (1 - t) + nx * off), py = Math.round(H * t + ny * off);
        const d = x.getImageData(px, py, 1, 1).data;
        return (d[0] + d[1] + d[2]) / 3;
      };
      const ts = [0.2, 0.35, 0.5, 0.65, 0.8];
      // A 2px line can straddle pixel boundaries: take the brightest pixel
      // within ±2px of the diagonal. A drifting line would miss by far more.
      const near = (t)=> Math.max(...[-2, -1, 0, 1, 2].map(o => at(t, o)));
      return { on: ts.map(near), off: ts.flatMap(t => [at(t, -6), at(t, 6)]) };
    }, png);
    for(const v of samples.on) expect(v).toBeGreaterThan(250);  // white line
    for(const v of samples.off) expect(v).toBeLessThan(248);    // tinted halves
  });
}

// Odd/even classes in the All view: each week gets its own half of the day,
// and only classes that really clash are marked as conflicts.
test.describe("odd/even layout", ()=>{
  const open = async (page, courses, filter)=>{
    await page.setViewportSize({ width: 1200, height: 800 });
    await openWith(page, appState({ courses }));
    await page.getByRole("button", { name: "Calendar" }).click();
    if(filter) await page.locator("#paritySeg").getByRole("button", { name: filter }).click();
  };
  // Block position as fractions of its day column, plus its state.
  const layout = (page, name)=> page.getByRole("button", { name: new RegExp("^" + name) }).evaluate(el=>{
    const col = el.closest(".week-col"), r = el.getBoundingClientRect(), c = col.getBoundingClientRect();
    const x0 = c.left + col.clientLeft, w = col.clientWidth; // inside the column's border
    return {
      // Snapped to 5% so the 2–3px gaps between blocks don't matter.
      left: Math.round((r.left - x0) / w * 20) * 5, right: Math.round((r.right - x0) / w * 20) * 5,
      top: parseFloat(el.style.top), conflict: el.classList.contains("conflict"),
      badge: el.querySelector(".we-parity")?.textContent || ""
    };
  });

  test("a lone odd class takes the left half, a lone even one the right, with a badge", async ({ page })=>{
    await open(page, [
      course({ id: "o", name: "Odd one", parity: "odd" }),
      course({ id: "e", name: "Even one", parity: "even", day: "Tuesday" }),
      course({ id: "w", name: "Weekly", day: "Wednesday" })
    ]);
    expect(await layout(page, "Odd one")).toMatchObject({ left: 0, right: 50, badge: "O", conflict: false });
    expect(await layout(page, "Even one")).toMatchObject({ left: 50, right: 100, badge: "E" });
    expect(await layout(page, "Weekly")).toMatchObject({ left: 0, right: 100, badge: "" });
  });

  test("the Odd filter shows odd classes full width without the badge", async ({ page })=>{
    await open(page, [course({ id: "o", name: "Odd one", parity: "odd" })], "Odd");
    expect(await layout(page, "Odd one")).toMatchObject({ left: 0, right: 100, badge: "" });
  });

  test("an odd/even pair with different times sits side by side at its real times", async ({ page })=>{
    await open(page, [
      course({ id: "o", name: "Odd one", parity: "odd", start: "08:00", end: "10:00" }),
      course({ id: "e", name: "Even one", parity: "even", start: "09:00", end: "11:00" })
    ]);
    await expect(page.locator(".diagonal-wrap")).toHaveCount(0);
    const o = await layout(page, "Odd one"), e = await layout(page, "Even one");
    expect(o).toMatchObject({ right: 50, conflict: false });
    expect(e).toMatchObject({ left: 50, conflict: false });
    expect(e.top - o.top).toBe(46); // one hour lower
  });

  test("a chain of odd/even classes is not a conflict", async ({ page })=>{
    await open(page, [
      course({ id: "a", name: "First odd", parity: "odd", start: "08:00", end: "10:00" }),
      course({ id: "b", name: "Even between", parity: "even", start: "09:00", end: "11:00" }),
      course({ id: "c", name: "Second odd", parity: "odd", start: "10:00", end: "12:00" })
    ]);
    await expect(page.locator(".week-event.conflict")).toHaveCount(0);
    // The two odd classes don't overlap each other, so they share the whole odd half.
    expect(await layout(page, "First odd")).toMatchObject({ left: 0, right: 50 });
    expect(await layout(page, "Second odd")).toMatchObject({ left: 0, right: 50 });
  });

  test("only the classes that really clash are marked", async ({ page })=>{
    await open(page, [
      course({ id: "a", name: "Odd A", parity: "odd", start: "08:00", end: "10:00" }),
      course({ id: "c", name: "Odd C", parity: "odd", start: "09:00", end: "11:00" }),
      course({ id: "b", name: "Even B", parity: "even", start: "08:00", end: "10:00" })
    ]);
    expect(await layout(page, "Odd A")).toMatchObject({ left: 0, right: 25, conflict: true });
    expect(await layout(page, "Odd C")).toMatchObject({ left: 25, right: 50, conflict: true });
    expect(await layout(page, "Even B")).toMatchObject({ left: 50, right: 100, conflict: false });
  });

  test("a weekly class clashing with an odd one marks both, not the even one it can't meet", async ({ page })=>{
    await open(page, [
      course({ id: "w", name: "Weekly", start: "08:00", end: "09:30" }),
      course({ id: "o", name: "Odd one", parity: "odd", start: "09:00", end: "11:00" }),
      course({ id: "e", name: "Even one", parity: "even", start: "10:00", end: "12:00" })
    ]);
    expect(await layout(page, "Weekly")).toMatchObject({ conflict: true });
    expect(await layout(page, "Odd one")).toMatchObject({ conflict: true, badge: "O" });
    expect(await layout(page, "Even one")).toMatchObject({ conflict: false, badge: "E" });
  });

  test("blocks are colored by week, whatever the class type", async ({ page })=>{
    await open(page, [
      course({ id: "o", name: "Odd one", parity: "odd", type: "Seminar" }),
      course({ id: "e", name: "Even one", parity: "even", day: "Tuesday", type: "Laboratory" }),
      course({ id: "w", name: "Weekly", day: "Wednesday", type: "Seminar" })
    ]);
    const bg = (name)=> page.getByRole("button", { name: new RegExp("^" + name) }).evaluate(el => el.style.background);
    expect(await bg("Odd one")).toBe("var(--tag-teal-bg)");
    expect(await bg("Even one")).toBe("var(--tag-indigo-bg)");
    expect(await bg("Weekly")).toBe("var(--tag-gray-bg)");
  });

  test("the diagonal split carries O/E badges", async ({ page })=>{
    await open(page, COURSES);
    await expect(page.locator(".diagonal-wrap .we-parity")).toHaveText(["O", "E"]);
  });
});
