import { expect, test, type Page } from "@playwright/test";

const CREEK = "http://127.0.0.1:7502";

/**
 * Counts StreamOtter's subscribe and unsubscribe requests on the page's socket: what the hooks
 * actually sent, not what the app reports about them.
 */
function watchSubscriptions(page: Page): { subscribes: number; unsubscribes: number; readonly open: number } {
  const counts = {
    subscribes: 0,
    unsubscribes: 0,
    get open() { return this.subscribes - this.unsubscribes; }
  };
  page.on("websocket", socket => socket.on("framesent", frame => {
    const payload = typeof frame.payload === "string" ? frame.payload : frame.payload.toString("utf8");
    if (payload.includes('["so:subscribe"')) counts.subscribes += 1;
    if (payload.includes('["so:unsubscribe"')) counts.unsubscribes += 1;
  }));
  return counts;
}

async function startRound(page: Page, seconds = 12): Promise<void> {
  await page.goto(`/?round=${seconds}`);
  await page.getByRole("button", { name: "Start round" }).click();
  await page.getByRole("button", { name: "Live data" }).click();
  await expect(page.getByTestId("tuning")).toBeHidden({ timeout: 15_000 });
}

test.afterEach(async ({ request }) => {
  await request.post(`${CREEK}/api/dev/resume-source`);
});

test("a round mounts three live subscriptions, plays to the bell, and unmounts them @dev", async ({ page }) => {
  const socket = watchSubscriptions(page);
  await startRound(page);
  await expect(page.getByTestId("signal")).toHaveAttribute("data-state", "connected");
  await expect(page.getByTestId("hood-count")).toHaveText("3");
  await expect.poll(() => socket.open).toBe(3);
  for (const channel of ["den", "reach", "creekOverview"]) {
    await expect(page.getByTestId(`hood-${channel}`)).toContainText("live");
  }
  // The clock runs and the field ticks.
  const overview = page.getByTestId("hood-creekOverview");
  const before = await overview.locator("td").nth(3).textContent();
  await expect(overview.locator("td").nth(3)).not.toHaveText(before ?? "", { timeout: 6_000 });
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(400);
  await page.keyboard.up("ArrowLeft");

  await expect(page.getByTestId("end")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("final-score")).toHaveText(/^-?\d+$/);
  await expect(page.getByTestId("hood-count")).toHaveText("0");
  await expect(page.getByTestId("hood-connection")).toHaveText("no round mounted");
  // The hooks really unsubscribed: as many unsubscribes on the socket as subscribes. Re-renders
  // with new params objects (and StrictMode's double mount, in the dev project) add none.
  await expect.poll(() => socket.open).toBe(0);
  expect(socket.subscribes).toBe(3);
});

test("a hidden tab pauses the round, and coming back resumes it from a fresh snapshot", async ({ page }) => {
  await startRound(page, 40);
  const setVisibility = (state: "hidden" | "visible") => page.evaluate(value => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
  await setVisibility("hidden");
  const frozen = await page.getByTestId("time-left").textContent();
  await page.waitForTimeout(2_500);
  await expect(page.getByTestId("time-left")).toHaveText(frozen ?? "");
  await expect(page.getByTestId("stale")).toBeHidden();
  await setVisibility("visible");
  await expect(page.getByTestId("log")).toContainText("fresh snapshot");
  await expect(page.getByTestId("time-left")).not.toHaveText(frozen ?? "", { timeout: 3_000 });
});

test("a round that starts in a hidden tab waits, then resumes from a fresh snapshot", async ({ page }) => {
  await page.goto("/?round=40");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "Start round" }).click();
  await expect(page.getByTestId("tuning")).toBeHidden({ timeout: 15_000 });
  const frozen = await page.getByTestId("time-left").textContent();
  await page.waitForTimeout(2_500);
  await expect(page.getByTestId("time-left")).toHaveText(frozen ?? "");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("log")).toContainText("fresh snapshot");
});

test("a stale creek pauses the round on the last known state, and a fresh snapshot resumes it", async ({ page, request }) => {
  await startRound(page, 40);
  await expect(page.getByTestId("hood-den")).toContainText("live");

  await request.post(`${CREEK}/api/dev/pause-source`);
  const stale = page.getByTestId("stale");
  await expect(stale).toBeVisible({ timeout: 8_000 });
  await expect(stale).toContainText("Lost the receiver");
  await expect(page.getByTestId("hood-den")).toContainText("stale");
  const frozen = await page.getByTestId("time-left").textContent();
  await page.waitForTimeout(2_500);
  await expect(page.getByTestId("time-left")).toHaveText(frozen ?? "");

  await request.post(`${CREEK}/api/dev/resume-source`);
  await expect(stale).toBeHidden({ timeout: 10_000 });
  await expect(page.getByTestId("log")).toContainText("fresh snapshot");
  await expect(page.getByTestId("hood-den")).toContainText("live");
});

test("the header carries StreamOtter's lockup, linking to streamotter.dev in a new tab", async ({ page }) => {
  await page.route(`${CREEK}/api/**`, route => route.abort());
  await page.goto("/");
  const link = page.getByRole("banner").getByRole("link", { name: "StreamOtter (opens in a new tab)" });
  await expect(link).toHaveAttribute("href", "https://streamotter.dev");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link.locator(".so-lockup svg")).toBeVisible();
  // The header stays put while the page scrolls.
  await expect(page.getByRole("banner")).toHaveCSS("position", "sticky");
  // Phones keep the whole lockup, and nothing scrolls sideways.
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(link.locator(".so-lockup svg")).toBeVisible();
  await expect(link).toHaveAccessibleName("StreamOtter (opens in a new tab)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // Phones put the status and Live data on a second row, under the brand.
  const brand = await page.locator(".brand").boundingBox();
  const actions = await page.locator(".top-actions").boundingBox();
  expect(actions!.y).toBeGreaterThanOrEqual(brand!.y + brand!.height);
});

test("the start screen shows a still of the field above the start card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start round" })).toBeEnabled();
  const still = page.getByTestId("field-still");
  await expect(still).toBeVisible();
  await expect(still).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByText("A 60-second game · Lontra Creek")).toBeVisible();
  // The card overlaps the still's bottom edge.
  const frame = await still.boundingBox();
  const card = await page.locator(".start").boundingBox();
  expect(card!.y).toBeLessThan(frame!.y + frame!.height);
  expect(card!.y).toBeGreaterThan(frame!.y);
  // In live mode, the title and Start round show without scrolling at 1280 × 800.
  await page.evaluate(() => document.fonts.ready);
  const button = await page.getByRole("button", { name: "Start round" }).boundingBox();
  expect(button!.y + button!.height).toBeLessThanOrEqual(800);
  // Phones crop the still to about 2:1.
  await page.setViewportSize({ width: 390, height: 844 });
  const phone = await still.boundingBox();
  expect(phone!.width / phone!.height).toBeCloseTo(2, 1);
  // The still goes once a round starts.
  await page.getByRole("button", { name: "Start round" }).click();
  await expect(still).toBeHidden();
});

test("without the demo backend, rounds replay the recording and say so", async ({ page }) => {
  await page.route(`${CREEK}/api/**`, route => route.abort());
  await page.goto("/?round=10");
  await expect(page.getByRole("status").filter({ hasText: "not live" })).toBeVisible();
  await expect(page.getByTestId("signal")).toHaveAttribute("data-state", "recorded");
  await page.getByRole("button", { name: "Start round" }).click();
  await expect(page.getByTestId("recorded")).toHaveText("Recording · not live");
  await expect(page.getByTestId("tuning")).toBeHidden();
  await expect(page.getByTestId("end")).toBeVisible({ timeout: 20_000 });
});
