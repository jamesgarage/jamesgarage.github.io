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

async function waitForGaragePortraits(page) {
  await expect(page.locator('#truck-list .truck-preview img')).toHaveCount(8);
  await page.waitForFunction(() => [...document.querySelectorAll('#truck-list img')].every(image => image.complete && image.naturalWidth === 720));
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

test('friends greet and imitate a touch jump with visible reactions that pause', async ({ page }, testInfo) => {
  await openGame(page);
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.buddySignals.includes('hello'));
  await page.screenshot({ path: testInfo.outputPath('friends-say-hello.png') });
  await page.waitForFunction(() => window.__skyway.distance > 48);
  await page.getByRole('button', { name: 'Jump', exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.buddies.slice(0, 2).every(b => b.height > 0 && b.signal === 'jump'));
  expect(await page.evaluate(() => window.__skyway.buddySignals)).toEqual(['jump', 'jump']);
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  const frozen = await page.evaluate(() => window.__skyway);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__skyway.buddies)).toEqual(frozen.buddies);
  expect(await page.evaluate(() => window.__skyway.buddySignals)).toEqual(frozen.buddySignals);
  expect(await page.evaluate(() => window.__skyway.worldLife)).toEqual(frozen.worldLife);
  expect(await page.evaluate(() => window.__skyway.landmarks)).toEqual(frozen.landmarks);
  await page.getByRole('button', { name: 'Keep going', exact: true }).tap();
  await page.screenshot({ path: testInfo.outputPath('friends-jump-together.png') });
  await page.waitForFunction(() => window.__skyway.buddies.every(b => b.signal !== 'jump'));
  expect(await page.evaluate(() => window.__skyway.speed)).toBeGreaterThanOrEqual(26);
});

test('keyboard and touch jumps, pause, and resume work after a garage visit', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Your garage', exact: true }).click();
  await expect(page.locator('#truck-list .truck-card')).toHaveCount(8);
  await expect(page.locator('#truck-list .truck-preview img')).toHaveCount(8);
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

test('turning the tablet keeps the same race and usable touch controls', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.distance > 20);
  const first = await page.evaluate(() => window.__skyway);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForFunction(distance => window.__skyway.distance > distance + 4, first.distance);
  expect(await page.evaluate(() => window.__skyway.crew)).toEqual(first.crew);
  const right = await page.locator('#right-btn').boundingBox();
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
  await page.mouse.down();
  await page.waitForFunction(() => window.__skyway.screenLane > .04);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Jump', exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.height > 1);
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  const frozen = await page.evaluate(() => window.__skyway);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(180);
  const turned = await page.evaluate(() => window.__skyway);
  expect(turned.distance).toBe(frozen.distance);
  expect(turned.buddies).toEqual(frozen.buddies);
  expect(turned.landmarks).toEqual(frozen.landmarks);
  await page.getByRole('button', { name: 'Keep going', exact: true }).tap();
  await page.waitForFunction(distance => window.__skyway.distance > distance + 4, frozen.distance);
  await expect(page.locator('#right-btn')).toBeVisible();
  await expect(page.locator('#jump-btn')).toBeVisible();
});

test('crushing rewards a speed burst and keyboard turbo wins a friendly challenge', async ({ page }, testInfo) => {
  await openGame(page);
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.crushes === 1);
  const crush = await page.evaluate(() => window.__skyway);
  expect(crush.crushedCars).toContain('car-110');
  expect(crush.crushBoostTime).toBeGreaterThan(0);
  expect(crush.speed).toBeGreaterThan(26);
  expect(crush.stars).toBeGreaterThanOrEqual(2);
  expect(crush.place).toBe(1);
  await page.waitForFunction(() => window.__skyway.crushedModels.includes('car-110'));
  await page.waitForFunction(() => window.__skyway.crushReward.count === 2 && window.__skyway.crushReward.age > .3);
  await page.screenshot({ path: testInfo.outputPath('rewarding-crush.png') });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  const rewardPause = await page.evaluate(() => window.__skyway);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__skyway.crushBoostTime)).toBe(rewardPause.crushBoostTime);
  expect(await page.evaluate(() => window.__skyway.distance)).toBe(rewardPause.distance);
  expect(await page.evaluate(() => window.__skyway.crushReward)).toEqual(rewardPause.crushReward);
  await page.getByRole('button', { name: 'Keep going', exact: true }).tap();

  // The later challenge comes from a friend's own pace; crushing never brakes.
  await page.waitForFunction(() => window.__skyway.place === 2 && window.__skyway.distance > 200);
  const challenge = await page.evaluate(() => window.__skyway);
  expect(challenge.speed).toBeGreaterThanOrEqual(26);
  expect(challenge.buddies.some(buddy => buddy.distance > challenge.distance)).toBe(true);
  expect(challenge.crushReward.count).toBe(0);
  expect(challenge.crushReward.triggered).toBe(challenge.crushes);
  await expect(page.locator('#race-place')).not.toHaveText('1st');
  await page.keyboard.press('b');
  await page.waitForFunction(() => window.__skyway.turboTime > 0 && window.__skyway.speed > 30);
  await page.waitForFunction(() => window.__skyway.place === 1);
  await expect(page.locator('#race-place')).toHaveText('1st');
  await expect(page.locator('#turbo-btn')).toHaveAttribute('aria-label', 'Turbo active');
  await page.waitForFunction(() => window.__skyway.crushedModels.includes('car-110'));
  await page.screenshot({ path: testInfo.outputPath('turbo-comeback.png') });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  const paused = await page.evaluate(() => window.__skyway);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__skyway.turboTime)).toBe(paused.turboTime);
  expect(await page.evaluate(() => window.__skyway.buddies)).toEqual(paused.buddies);
  expect(await page.evaluate(() => window.__skyway.crushedModels)).toEqual(paused.crushedModels);
});

test('a complete guided race unlocks a truck and saves it for replay', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await openGame(page);
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();

  await expect(page.locator('#race-place')).toHaveText('1st');
  await page.waitForFunction(() => window.__skyway.distance > 20);
  const field = await page.evaluate(() => window.__skyway);
  expect(field.variant).toBe(0);
  expect(field.buddies).toHaveLength(4);
  expect(field.buddies.map(buddy => buddy.id)).toEqual(['sunny', 'splash', 'ember', 'pebble']);
  expect(field.crew).toEqual(field.buddies.map(buddy => buddy.id));
  await expect(page.locator('#race-count')).toHaveText('OF 5');
  await expect(page.locator('#race-position')).toHaveAttribute('aria-label', 'First place out of 5 trucks');
  expect(field.buddies.every(buddy => buddy.distance < field.distance)).toBe(true);

  // Run the real game clock with no driving input: little children can finish unaided.
  await page.waitForFunction(() => window.__skyway.distance >= 320, null, { timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('timber-bridge.png') });
  await page.waitForFunction(() => window.__skyway.distance >= 638, null, { timeout: 90_000 });
  expect(await page.evaluate(() => window.__skyway.turboTime)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('rocket-runway.png') });
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
  expect(await page.evaluate(() => window.__skyway.worldLife)).toEqual(rainyPause.worldLife);
  await page.getByRole('button', { name: 'Keep going', exact: true }).tap();

  await page.waitForFunction(() => window.__skyway.distance >= 1350, null, { timeout: 90_000 });
  await page.screenshot({ path: testInfo.outputPath('gator-falls.png') });

  await expect(page.locator('#results')).toBeVisible({ timeout: 90_000 });
  const finish = await page.evaluate(() => ({ ...window.__skyway }));
  expect(finish.phase).toBe('finished');
  expect(finish.place).toBe(1);
  expect(finish.crushes).toBeGreaterThanOrEqual(4);
  expect(finish.crushedModels.length).toBe(finish.crushes);
  expect(finish.crushReward.triggered).toBe(finish.crushes);
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
  await waitForGaragePortraits(page);
  await page.getByRole('button', { name: 'Bear Crusher, ready to drive', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Bear Crusher, selected', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await waitForGaragePortraits(page);
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
  expect(replay.variant).toBe(1);
  expect(replay.buddies.map(buddy => buddy.id)).toEqual(['sunny', 'splash', 'pebble', 'bolt']);
  expect(replay.crew).toEqual(replay.buddies.map(buddy => buddy.id));
  expect(replay.landmarks.variant).toBe(1);
  expect(replay.worldLife.variant).toBe(1);
  expect(replay.buddies.every(buddy => buddy.distance < replay.distance)).toBe(true);
  expect(replay.rain).toBe(false);
  expect(replay.mudSpray).toBe(0);
  expect(replay.crushes).toBe(0);
  expect(replay.crushBoostTime).toBe(0);
  expect(replay.crushedModels).toEqual([]);
  expect(replay.crushReward).toEqual({id: '', age: 0, count: 0, triggered: 0});
});

for (const [id,name,stars] of [['rescue-roarer','Rescue Roarer',40],['shark-surge','Shark Surge',48]]) {
test(`${name} is earned, selectable, saved and playable with touch`, async ({ page },testInfo) => {
  await page.addInitScript(balance=>{if(!localStorage.getItem('monster-skyway.progress.v1'))localStorage.setItem('monster-skyway.progress.v1',JSON.stringify({version:1,stars:balance,races:1,selected:'rumbler',muted:true,reducedMotion:false}));},stars);
  await openGame(page);
  await page.getByRole('button',{name:'Your garage',exact:true}).tap();
  await waitForGaragePortraits(page);
  await page.getByRole('button',{name:`${name}, ready to drive`,exact:true}).tap();
  await expect(page.getByRole('button',{name:`${name}, selected`,exact:true})).toHaveAttribute('aria-pressed','true');
  await waitForGaragePortraits(page);
  // The initializer only fills empty storage; a reload must retain this choice.
  await page.getByRole('button',{name:'Close garage',exact:true}).tap();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('monster-skyway.progress.v1')).selected)).toBe(id);
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(selected=>window.__skyway?.selected===selected,id);
  await expect(page.locator('#showcase-name')).toHaveText(name);
  await page.getByRole('button',{name:"Let's play",exact:true}).tap();
  await page.waitForFunction(()=>window.__skyway.distance>20);
  expect(await page.evaluate(()=>window.__skyway.selected)).toBe(id);
  await page.getByRole('button',{name:'Jump',exact:true}).tap();
  await page.waitForFunction(()=>window.__skyway.height>1);
  await page.screenshot({path:testInfo.outputPath(`${id}-jump.png`)});
  await page.waitForFunction(()=>window.__skyway.crushes>=1);
  expect(await page.evaluate(()=>window.__skyway.place)).toBe(1);
});
}

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
  const gentleLandmarks = await page.evaluate(() => window.__skyway.landmarks);
  await page.getByRole('button', { name: 'Turbo boost', exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.turboTime > 0 && window.__skyway.speed > 30);
  expect(await page.evaluate(() => window.__skyway.flames)).toBe(2);
  await page.getByRole('button', { name: 'Jump', exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.height > 1);
  expect(await page.evaluate(() => window.__skyway.landmarks)).toEqual(gentleLandmarks);
  await expect(page.locator('#error')).toBeHidden();
  expect(await page.evaluate(() => window.__skyway.phase)).toBe('running');
});
