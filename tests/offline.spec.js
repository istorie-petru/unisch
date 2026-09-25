// The app has no server side, so after one visit it must work fully offline.
const { test, expect } = require("@playwright/test");
const { course, appState, openWith } = require("./helpers");

test("works offline after the first visit", async ({ page, context })=>{
  await openWith(page, appState({ courses: [course({ id: "a", name: "Algebra" })] }));
  await page.evaluate(()=> navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("tr[data-id='a']")).toBeVisible();
  const icon = await page.evaluate(async ()=> (await fetch("icons/icon-192.png")).status);
  expect(icon).toBe(200);
  await context.setOffline(false);
});
