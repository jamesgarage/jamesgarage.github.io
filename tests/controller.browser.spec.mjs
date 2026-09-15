import { test as base, expect } from '@playwright/test';

const test = base.extend({
  controllerProgress: [{
    version: 1, stars: 0, races: 0, selected: 'rumbler', muted: true, courseId: 'skyway',
  }, { option: true }],
});

const browserErrors = new WeakMap();

test.beforeEach(async ({ page, controllerProgress }) => {
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
  await page.addInitScript(progress => {
    localStorage.setItem('monster-skyway.progress.v1', JSON.stringify(progress));
    window.__controllerReads = 0;
    window.__controllers = [{
      id: 'Browser test controller', index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    }];
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value() { window.__controllerReads++; return window.__controllers; },
    });
  }, controllerProgress);
});

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), 'The game should have no browser or network errors').toEqual([]);
});

async function openGame(page) {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__skyway?.controller.connected));
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#error')).toBeHidden();
  await expect(page.getByRole('button', { name: "Let's play", exact: true })).toBeFocused();
}

// Snapshots enter through the browser Gamepad API; game state and DOM focus stay
// under the real sampler, adapter, animation loop and button callbacks.
async function controller(page, { held = [], axes = [0, 0], values = {}, connected = true, second = false, secondHeld = [] } = {}) {
  const before = await page.evaluate(({ held, axes, values, connected, second, secondHeld }) => {
    window.__controllers = connected ? [{
      id: 'Browser test controller', index: 0, connected: true, mapping: 'standard',
      axes: [...axes, 0, 0].slice(0, 4),
      buttons: Array.from({ length: 17 }, (_, index) => ({
        pressed: held.includes(index), touched: held.includes(index),
        value: values[index] ?? (held.includes(index) ? 1 : 0),
      })),
    }] : [];
    if (second) {
      if (!connected) window.__controllers.push(null);
      window.__controllers.push({
        id: 'Second browser test controller', index: 1, connected: true, mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, (_, index) => ({
          pressed: secondHeld.includes(index), touched: secondHeld.includes(index),
          value: secondHeld.includes(index) ? 1 : 0,
        })),
      });
    }
    return window.__controllerReads;
  }, { held, axes, values, connected, second, secondHeld });
  await page.waitForFunction(before => window.__controllerReads >= before + 2, before);
}

async function tapButton(page, button) {
  await controller(page, { held: [button] });
  await controller(page);
}

async function startRace(page) {
  await openGame(page);
  await tapButton(page, 0);
  await page.waitForFunction(() => window.__skyway.phase === 'running' && window.__skyway.distance > 2);
  expect(await page.evaluate(() => window.__skyway.height)).toBe(0);
}

test('controller starts, steers, toggles robot once per press, flies and pauses', async ({ page }, testInfo) => {
  await startRace(page);
  await controller(page, { axes: [.8, 0] });
  await page.waitForFunction(() => window.__skyway.lane > .15);
  expect(await page.evaluate(() => window.__skyway.controller.steer)).toBeCloseTo(.75);

  await controller(page, { axes: [.8, 0], held: [14] });
  await page.waitForFunction(() => window.__skyway.lane < -.15);
  expect(await page.evaluate(() => window.__skyway.controller.steer)).toBe(-1);
  await controller(page, { axes: [.19, 0] });
  expect(await page.evaluate(() => window.__skyway.controller.steer)).toBe(0);
  const target = await page.evaluate(() => window.__skyway.targetLane);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__skyway.targetLane)).toBe(target);

  await controller(page, { held: [2] });
  await page.waitForFunction(() => window.__skyway.robotMode && window.__skyway.transformed);
  const heldRobotModes = await page.evaluate(() => new Promise(resolve => {
    const samples = [];
    const sample = () => {
      samples.push(window.__skyway.robotMode);
      if (samples.length === 18) resolve(samples); else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  expect(heldRobotModes.every(Boolean), 'Holding X must not toggle robot mode repeatedly').toBe(true);
  await controller(page);
  await tapButton(page, 2);
  await page.waitForFunction(() => !window.__skyway.robotMode);
  await tapButton(page, 2);
  await page.waitForFunction(() => window.__skyway.robotMode);
  await tapButton(page, 0);
  await page.waitForFunction(() => window.__skyway.flying && window.__skyway.height > 2);
  await page.screenshot({ path: testInfo.outputPath('controller-robot-flight.png') });

  await controller(page, { held: [9] });
  await page.waitForFunction(() => window.__skyway.phase === 'paused');
  const paused = await page.evaluate(() => window.__skyway);
  await page.waitForTimeout(300);
  const still = await page.evaluate(() => window.__skyway);
  expect(still.phase).toBe('paused');
  expect(still.distance).toBe(paused.distance);
  expect(still.height).toBe(paused.height);
  expect(still.flight).toEqual(paused.flight);
  expect(still.buddies).toEqual(paused.buddies);
  await controller(page);
  await controller(page, { held: [9] });
  await page.waitForFunction(paused => window.__skyway.phase === 'running' && window.__skyway.distance > paused.distance, paused);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__skyway.phase)).toBe('running');
  await controller(page);
});

for (const [name, snapshot] of [
  ['B', { held: [1] }],
  ['analog right trigger', { values: { 7: .9 } }],
]) {
  test(`controller ${name} starts turbo in a race without reopening the menu`, async ({ page }) => {
    await startRace(page);
    await controller(page, snapshot);
    await page.waitForFunction(() => window.__skyway.turboTime > 1 && window.__skyway.speed > 30);
    const first = await page.evaluate(() => window.__skyway.turboTime);
    await page.waitForTimeout(500);
    const held = await page.evaluate(() => window.__skyway);
    expect(held.phase).toBe('running');
    expect(held.turboTime).toBeLessThan(first);
    expect(held.turboTime).toBeGreaterThan(0);
    await expect(page.locator('#menu')).toBeHidden();
    await controller(page);
  });
}

test('disconnect pauses and reconnecting held buttons cannot resume or toggle the robot', async ({ page }) => {
  await startRace(page);
  await controller(page, { held: [2] });
  await page.waitForFunction(() => window.__skyway.robotMode);
  await controller(page, { connected: false });
  await page.waitForFunction(() => window.__skyway.phase === 'paused' && !window.__skyway.controller.connected);
  const paused = await page.evaluate(() => window.__skyway);
  await controller(page, { held: [0, 2, 9] });
  await page.waitForTimeout(350);
  const reconnected = await page.evaluate(() => window.__skyway);
  expect(reconnected.controller.connected).toBe(true);
  expect(reconnected.phase).toBe('paused');
  expect(reconnected.distance).toBe(paused.distance);
  expect(reconnected.robotMode).toBe(true);
  expect(reconnected.flying).toBe(false);
  await controller(page);
  await tapButton(page, 9);
  await page.waitForFunction(() => window.__skyway.phase === 'running');
  expect(await page.evaluate(() => window.__skyway.robotMode)).toBe(true);
  expect(await page.evaluate(() => window.__skyway.flying)).toBe(false);
  await tapButton(page, 2);
  await page.waitForFunction(() => !window.__skyway.robotMode);
});

test('controller navigates the track picker, goes back and chooses a different race', async ({ page }, testInfo) => {
  await openGame(page);
  await tapButton(page, 13);
  await expect(page.getByRole('button', { name: 'Choose a racetrack', exact: true })).toBeFocused();
  await tapButton(page, 0);
  await expect(page.locator('#tracks')).toBeVisible();
  await expect(page.locator('#course-list button')).toHaveCount(5);
  await expect(page.locator('[data-course="skyway"]')).toBeFocused();
  await tapButton(page, 1);
  await expect(page.locator('#tracks')).toBeHidden();
  await expect(page.locator('#tracks-btn')).toBeFocused();
  await tapButton(page, 0);
  await expect(page.locator('#tracks')).toBeVisible();
  await tapButton(page, 15);
  await expect(page.locator('[data-course="woods"]')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('controller-track-picker.png') });
  await tapButton(page, 0);
  await page.waitForFunction(() => window.__skyway.phase === 'running' && window.__skyway.courseId === 'woods' && window.__skyway.distance > 2);
  await expect(page.locator('#tracks')).toBeHidden();
  expect(await page.evaluate(() => window.__skyway.courseProgress)).toBeLessThan(.05);
});

test('losing the active controller pauses even when a second controller remains connected', async ({ page }) => {
  await startRace(page);
  await controller(page, { axes: [.8, 0], second: true, secondHeld: [0, 2, 9] });
  await page.waitForFunction(() => window.__skyway.lane > .1);
  expect(await page.evaluate(() => window.__skyway.controller.index)).toBe(0);
  expect(await page.evaluate(() => window.__skyway.robotMode)).toBe(false);

  await controller(page, { connected: false, second: true, secondHeld: [0, 2, 9] });
  await page.waitForFunction(() => window.__skyway.phase === 'paused' && window.__skyway.controller.index === 1);
  const paused = await page.evaluate(() => window.__skyway);
  await page.waitForTimeout(300);
  const held = await page.evaluate(() => window.__skyway);
  expect(held.phase).toBe('paused');
  expect(held.distance).toBe(paused.distance);
  expect(held.controller.connected).toBe(true);
  expect(held.robotMode).toBe(false);
  expect(held.flying).toBe(false);
  await controller(page, { connected: false, second: true });
  await controller(page, { connected: false, second: true, secondHeld: [9] });
  await page.waitForFunction(() => window.__skyway.phase === 'running');
  expect(await page.evaluate(() => window.__skyway.controller.index)).toBe(1);
});

test.describe('controller settings with saved progress and sound enabled', () => {
  test.use({ controllerProgress: {
    version: 1, stars: 23, races: 2, selected: 'rumbler', muted: false, courseId: 'skyway',
  } });

  test('initial A starts a race when Sound is enabled', async ({ page }) => {
    await startRace(page);
    await expect(page.locator('#sound-btn')).toHaveAttribute('aria-label', 'Turn sound off');
    expect(await page.evaluate(() => window.__skyway.totalStars)).toBe(23);
  });

  test('home options stay reachable and Menu cannot confirm a garage reset', async ({ page }, testInfo) => {
    await openGame(page);
    // An enabled Sound button also has aria-pressed=true; Play must still own
    // initial focus, and moving to the global options must preserve focus.
    await tapButton(page, 12);
    await expect(page.locator('#sound-btn')).toBeFocused();
    await page.waitForTimeout(120);
    await expect(page.locator('#sound-btn')).toBeFocused();
    await tapButton(page, 0);
    await expect(page.locator('#sound-btn')).toHaveAttribute('aria-label', 'Turn sound on');
    await tapButton(page, 15);
    await expect(page.locator('#settings-btn')).toBeFocused();
    await tapButton(page, 0);
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('#motion-toggle')).toBeFocused();
    // The camera, rival pace and feedback controls now sit between motion and
    // reset. Reach each row through the real D-pad navigation before reset.
    await tapButton(page, 13);
    await expect(page.locator('[name="camera"][value="wide"]')).toBeFocused();
    await tapButton(page, 13);
    await expect(page.locator('[name="rival-rank"][value="2"]')).toBeFocused();
    await tapButton(page, 13);
    await expect(page.locator('#feedback-btn')).toBeFocused();
    await tapButton(page, 13);
    await expect(page.locator('#reset-btn')).toBeFocused();
    await tapButton(page, 0);
    await expect(page.locator('#reset-confirm')).toBeVisible();
    await expect(page.locator('#reset-no')).toBeFocused();
    await tapButton(page, 15);
    await expect(page.locator('#reset-yes')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('controller-reset-menu-guard.png') });
    await tapButton(page, 9);
    await expect(page.locator('#settings')).toBeHidden();
    await expect(page.locator('#reset-confirm')).toBeHidden();
    await expect(page.locator('#garage')).toBeHidden();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('monster-skyway.progress.v1')));
    expect(saved.stars).toBe(23);
    expect(saved.races).toBe(2);
    expect(saved.selected).toBe('rumbler');
    expect(await page.evaluate(() => window.__skyway.phase)).toBe('ready');
  });
});

test.describe('controller garage with earned progress', () => {
  test.use({ controllerProgress: {
    version: 1, stars: 23, races: 2, selected: 'rumbler', muted: true, courseId: 'skyway',
  } });

  test('controller selects and saves Bear Crusher with focus on the replacement card', async ({ page }, testInfo) => {
    await openGame(page);
    await tapButton(page, 15);
    await expect(page.locator('#garage-btn')).toBeFocused();
    await tapButton(page, 0);
    await expect(page.locator('#garage')).toBeVisible();
    await expect(page.locator('[data-truck="rumbler"]')).toBeFocused();
    await tapButton(page, 15);
    const bear = page.locator('[data-truck="bear-crusher"]');
    await expect(bear).toBeFocused();
    const previousCard = await bear.elementHandle();
    await tapButton(page, 0);
    await page.waitForFunction(() => window.__skyway.selected === 'bear-crusher');
    expect(await previousCard.evaluate(card => card.isConnected)).toBe(false);
    await expect(bear).toHaveAttribute('aria-pressed', 'true');
    await expect(bear).toBeFocused();
    await expect(bear).toHaveClass(/\bgamepad-focus\b/);
    await expect(bear).toHaveCSS('outline-color', 'rgb(255, 228, 106)');
    await expect(bear).toHaveCSS('outline-style', 'solid');
    await expect(bear).toHaveCSS('outline-width', '4px');
    await page.waitForFunction(() => [...document.querySelectorAll('#truck-list img')].every(image => image.complete && image.naturalWidth === 720));
    await page.screenshot({ path: testInfo.outputPath('controller-selected-bear.png') });
    await tapButton(page, 1);
    await expect(page.locator('#garage')).toBeHidden();
    await expect(page.locator('#play-btn')).toBeFocused();
    await expect(page.locator('#showcase-name')).toHaveText('Bear Crusher');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('monster-skyway.progress.v1')));
    expect(saved.selected).toBe('bear-crusher');
    expect(saved.stars).toBe(23);
    expect(saved.races).toBe(2);
    await previousCard.dispose();
  });
});

test.describe('controller Rival Race and parent feedback', () => {
  test.use({ controllerProgress: {
    version: 1, stars: 0, races: 0, selected: 'rumbler', muted: true,
    courseId: 'woods', rivalRank: 2,
  } });

  test('controller chooses Rival Race, replays with A and leaves results with B or Menu without extra rewards', async ({ page }) => {
    test.setTimeout(150_000);
    await openGame(page);
    await tapButton(page, 13);
    await expect(page.locator('#tracks-btn')).toBeFocused();
    await tapButton(page, 13);
    await expect(page.locator('[data-mode="cruise"]')).toBeFocused();
    await tapButton(page, 15);
    await expect(page.locator('[data-mode="race"]')).toBeFocused();
    await tapButton(page, 0);
    await expect(page.locator('[data-mode="race"]')).toHaveAttribute('aria-pressed', 'true');
    await tapButton(page, 9);
    await page.waitForFunction(() => window.__skyway.phase === 'running');
    expect(await page.evaluate(() => window.__skyway.raceMode)).toBe('race');

    for (const [index, exitButton] of [0, 1, 9].entries()) {
      await page.waitForFunction(() => window.__skyway.phase === 'finished', null, { timeout: 45_000 });
      await expect(page.locator('#results')).toBeVisible();
      await expect(page.locator('#race-again-btn')).toBeFocused();
      const finished = await page.evaluate(() => window.__skyway);
      expect(finished.races).toBe(index + 1);
      expect(finished.result.won).toBe(false);
      expect(finished.winnerId).not.toBe('player');
      expect(finished.ceremony.winnerId).toBe(finished.winnerId);
      await tapButton(page, exitButton);
      await expect(page.locator('#results')).toBeHidden();
      const after = await page.evaluate(() => window.__skyway);
      expect(after.phase).toBe(exitButton === 0 ? 'running' : 'ready');
      expect(after.ceremony.active).toBe(false);
      expect(after.totalStars).toBe(finished.totalStars);
      expect(after.races).toBe(finished.races);
      expect(after.height).toBe(0);
      if (exitButton === 1) {
        await expect(page.locator('#play-btn')).toBeFocused();
        await tapButton(page, 9);
        await page.waitForFunction(() => window.__skyway.phase === 'running');
      }
    }
    await controller(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('monster-skyway.progress.v1')));
    expect(saved.races).toBe(3);
    expect(saved.raceMode).toBe('race');
    expect(await page.evaluate(() => window.__skyway.phase)).toBe('ready');
  });

  test('a connected controller preserves feedback typing and selection, then B and Menu resume the paused race', async ({ page }) => {
    await startRace(page);
    await page.locator('#settings-btn').click();
    await page.locator('#feedback-btn').click();
    await expect(page.locator('#feedback')).toBeVisible();
    const paused = await page.evaluate(() => window.__skyway);
    expect(paused.phase).toBe('paused');
    const title = page.locator('#feedback-summary');
    const details = page.locator('#feedback-details');
    await title.fill('A muddy tow-truck adventure');
    await details.focus();
    await page.keyboard.type('Turbo, ramps and turns.\nPlease add a mud tunnel.', { delay: 20 });
    await page.keyboard.press('Shift+Home');
    const selection = await details.evaluate(element => ({ start: element.selectionStart, end: element.selectionEnd }));
    expect(selection.end).toBeGreaterThan(selection.start);
    await controller(page);
    await expect(details).toBeFocused();
    expect(await details.evaluate(element => ({ start: element.selectionStart, end: element.selectionEnd }))).toEqual(selection);
    await page.keyboard.type('Big jumps and turbo, please.', { delay: 20 });
    await expect(details).toHaveValue('Turbo, ramps and turns.\nBig jumps and turbo, please.');
    await expect(page.locator('[data-feedback-link]')).toBeHidden();
    const editing = await page.evaluate(() => window.__skyway);
    expect(editing.distance).toBe(paused.distance);
    expect(editing.robotMode).toBe(paused.robotMode);
    expect(editing.turboTime).toBe(paused.turboTime);
    expect(editing.controller.connected).toBe(true);
    await tapButton(page, 1);
    await expect(page.locator('#feedback')).toBeHidden();
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('#feedback-btn')).toBeFocused();
    await tapButton(page, 9);
    await page.waitForFunction(() => window.__skyway.phase === 'running');
    expect(await page.evaluate(() => window.__skyway.robotMode)).toBe(paused.robotMode);
    await page.locator('#settings-btn').click();
    await page.locator('#feedback-btn').click();
    await expect(title).toHaveValue('A muddy tow-truck adventure');
    await expect(details).toHaveValue('Turbo, ramps and turns.\nBig jumps and turbo, please.');
  });
});
