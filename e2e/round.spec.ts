import { expect, test, type Page } from "@playwright/test";

const CREEK = "http://127.0.0.1:7502";

async function startRound(page: Page, seconds = 12): Promise<void> {
  await page.goto(`/?round=${seconds}`);
  await page.getByRole("button", { name: "Start round" }).click();
  await page.getByRole("button", { name: "Under the hood" }).click();
  await expect(page.getByTestId("tuning")).toBeHidden({ timeout: 15_000 });
}

test.afterEach(async ({ request }) => {
  await request.post(`${CREEK}/api/dev/resume-source`);
});

test("a round mounts three live subscriptions, plays to the bell, and unmounts them", async ({ page }) => {
  await startRound(page);
  await expect(page.getByTestId("signal")).toHaveAttribute("data-state", "connected");
  await expect(page.getByTestId("hood-count")).toHaveText("3");
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
