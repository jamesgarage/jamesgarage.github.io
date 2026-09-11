import { test, expect } from '@playwright/test';

const browserErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(`JavaScript: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`Console: ${message.text()}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('requestfailed', request => {
    errors.push(`Network: ${request.failure()?.errorText} ${request.url()}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), 'The game should have no browser or network errors').toEqual([]);
});

async function openGame(page) {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__skyway));
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.getByRole('button', { name: "Let's play", exact: true })).toBeVisible();
}

for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
test(`keyboard and on-screen steering move in the direction shown by the arrows (${viewport.width})`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await openGame(page);
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.distance > 10);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => Math.abs(window.__skyway.screenLane) > .04);
  await page.keyboard.up('ArrowRight');
  expect(await page.evaluate(() => window.__skyway.screenLane), 'Right must move right relative to the visible road').toBeGreaterThan(.04);
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__skyway.screenLane < -.04);
  await page.keyboard.up('ArrowLeft');

  // Hold the real on-screen pointer controls; these share the touch event path.
  for (const [id, sign] of [['right-btn', 1], ['left-btn', -1]]) {
    const box = await page.locator(`#${id}`).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction(direction => window.__skyway.screenLane * direction > .04, sign);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__skyway.screenLane) * sign).toBeGreaterThan(.04);
  }
});
}

test('keyboard and touch jumps, pause, and resume work after a garage visit', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Your garage', exact: true }).click();
  await expect(page.locator('#truck-list .truck-card')).toHaveCount(6);
  await expect(page.locator('#truck-list .truck-preview img')).toHaveCount(6);
  await page.waitForFunction(() => [...document.querySelectorAll('#truck-list img')].every(image => image.complete && image.naturalWidth > 0));
  await page.getByRole('button', { name: 'Close garage', exact: true }).click();
  await page.getByRole('button', { name: "Let's play", exact: true }).click();
  await page.waitForFunction(() => window.__skyway.distance > 20);
  expect(await page.evaluate(() => window.__skyway.flames)).toBeGreaterThan(6);

  // ArrowUp is a global jump key; this also works while a control owns focus.
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => window.__skyway.height > 1);
  await page.waitForFunction(() => window.__skyway.landings >= 1 && window.__skyway.height === 0);
  // The landing cooldown is 0.18 seconds; distance provides a race-clock wait.
  const landedAt = await page.evaluate(() => window.__skyway.distance);
  await page.waitForFunction(distance => window.__skyway.distance > distance + 6, landedAt);
  await page.getByRole('button', { name: 'Jump', exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.height > 1);

  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: 'Take your time.' })).toBeVisible();
  const paused = await page.evaluate(() => ({ ...window.__skyway }));
  expect(paused.phase).toBe('paused');
  // Deliberately observe several render frames to catch a simulation that keeps running.
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__skyway.distance)).toBe(paused.distance);
  expect(await page.evaluate(() => window.__skyway.height)).toBe(paused.height);
  expect(await page.evaluate(() => window.__skyway.flames)).toBe(paused.flames);
  expect(await page.evaluate(() => window.__skyway.buddies)).toEqual(paused.buddies);
  await page.getByRole('button', { name: 'Keep going', exact: true }).tap();
  await page.waitForFunction(distance => window.__skyway.distance > distance + 3, paused.distance);
  await expect(page.locator('#pause-overlay')).toBeHidden();
  expect(await page.evaluate(() => window.__skyway.phase)).toBe('running');
});

test('a complete guided race unlocks a truck and saves it for replay', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await openGame(page);
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();

  await expect(page.locator('#race-place')).toHaveText('1st');
  await page.waitForFunction(() => window.__skyway.distance > 20);
  const field = await page.evaluate(() => window.__skyway);
  expect(field.buddies).toHaveLength(2);
  expect(field.buddies.every(buddy => buddy.distance < field.distance)).toBe(true);

  // Run the real game clock with no driving input: little children can finish unaided.
  await page.waitForFunction(() => window.__skyway.distance >= 750, null, { timeout: 90_000 });
  expect(await page.evaluate(() => window.__skyway.transformed)).toBe(true);
  expect(await page.evaluate(() => window.__skyway.flames)).toBeGreaterThan(6);
  await expect(page.locator('#race-stage')).toHaveText('02 · SKY LOOP');
  await page.screenshot({ path: testInfo.outputPath('guardian-flames.png') });
  await page.waitForFunction(() => window.__skyway.distance >= 900, null, { timeout: 90_000 });
  const loop = await page.evaluate(() => ({ ...window.__skyway }));
  expect(loop.phase).toBe('running');
  expect(loop.distance).toBeLessThan(1000);
  expect(loop.drawCalls).toBeGreaterThan(0);
  expect(loop.triangles).toBeGreaterThan(0);
  expect(loop.flames).toBeGreaterThan(6);
  expect(loop.drawCalls).toBeLessThan(700);
  expect(loop.triangles).toBeLessThan(550_000);
  expect(loop.place).toBe(1);
  expect(loop.buddies.every(buddy => buddy.distance < loop.distance)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('guided-loop.png') });

  await page.waitForFunction(() => window.__skyway.distance >= 1290 && window.__skyway.mudSpray > 0, null, { timeout: 90_000 });
  await expect(page.locator('#race-stage')).toHaveText('03 · GATOR BAY');
  expect(await page.evaluate(() => window.__skyway.rain)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('gator-bay.png') });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  const rainyPause = await page.evaluate(() => window.__skyway);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__skyway.mudSpray)).toBe(rainyPause.mudSpray);
  expect(await page.evaluate(() => window.__skyway.buddies)).toEqual(rainyPause.buddies);
  await page.getByRole('button', { name: 'Keep going', exact: true }).tap();

  await expect(page.locator('#results')).toBeVisible({ timeout: 90_000 });
  const finish = await page.evaluate(() => ({ ...window.__skyway }));
  expect(finish.phase).toBe('finished');
  expect(finish.place).toBe(1);
  await expect(page.locator('#result-title')).toHaveText('You win!');
  await expect(page.locator('#result-truck')).toHaveAttribute('src', /trucks\/rumbler\.png$/);
  await page.waitForFunction(() => document.querySelector('#result-truck').naturalWidth === 720);
  await page.screenshot({ path: testInfo.outputPath('first-place.png') });
  expect(finish.landings).toBeGreaterThanOrEqual(6);
  expect(finish.loops).toBe(1);
  expect(finish.races).toBe(1);
  expect(finish.totalStars).toBeGreaterThanOrEqual(12);
  expect(finish.totalStars).toBe(12 + Math.min(50, finish.stars));
  await expect(page.locator('#result-stars')).toHaveText(`+${finish.totalStars}`);

  await page.getByRole('button', { name: 'Your garage', exact: true }).tap();
  await page.getByRole('button', { name: 'Bear Crusher, ready to drive', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Bear Crusher, selected', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__skyway?.selected === 'bear-crusher');
  const saved = await page.evaluate(() => ({ ...window.__skyway }));
  expect(saved.totalStars).toBe(finish.totalStars);
  expect(saved.races).toBe(1);
  await expect(page.locator('#showcase-name')).toHaveText('Bear Crusher');

  await page.getByRole('button', { name: "Let's play", exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.phase === 'running' && window.__skyway.distance > 20);
  const replay = await page.evaluate(() => ({ ...window.__skyway }));
  expect(replay.selected).toBe('bear-crusher');
  expect(replay.distance).toBeLessThan(170);
  expect(replay.landings).toBe(0);
  expect(replay.loops).toBe(0);
  expect(replay.totalStars).toBe(finish.totalStars);
  expect(replay.races).toBe(1);
  expect(replay.buddies.every(buddy => buddy.distance < replay.distance)).toBe(true);
  expect(replay.rain).toBe(false);
  expect(replay.mudSpray).toBe(0);
});

test('blocked storage and unavailable audio still allow touchscreen play', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage blocked for this test', 'SecurityError'); },
    });
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await openGame(page);
  await page.getByRole('button', { name: 'Grown-up settings', exact: true }).tap();
  await expect(page.locator('.settings-note')).toContainText('cannot save progress');
  // Saving a preference must also tolerate storage failure.
  await page.getByRole('switch', { name: 'Gentler motion' }).check();
  await page.getByRole('button', { name: 'Close settings', exact: true }).tap();
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.distance > 10);
  expect(await page.evaluate(() => window.__skyway.flames)).toBe(2);
  await page.getByRole('button', { name: 'Jump', exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.height > 1);
  await expect(page.locator('#error')).toBeHidden();
  expect(await page.evaluate(() => window.__skyway.phase)).toBe('running');
});
