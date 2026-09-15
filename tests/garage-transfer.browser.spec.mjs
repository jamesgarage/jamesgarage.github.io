import { test, expect } from '@playwright/test';
import { createGarageTransferURL } from '../src/garage-transfer.mjs';

const SAVE_KEY = 'monster-skyway.progress.v1';
const LEGACY_URL = 'https://yanivalfasykeelusa.github.io/james-monster-skyway/';
const TARGET_URL = 'https://jamesgarage.github.io/';

const sourceProgress = Object.freeze({
  version: 1, stars: 48, selected: 'shark-surge', courseId: 'canyon',
  raceMode: 'race', rivalRank: 2, cameraView: 'wide', challengeWins: 7,
  muted: true, reducedMotion: true, races: 3,
});

const strongerTarget = Object.freeze({
  version: 1, stars: 100, selected: 'mega-titan', courseId: 'skyway',
  raceMode: 'cruise', rivalRank: 0, cameraView: 'close', challengeWins: 4,
  muted: false, reducedMotion: false, races: 9,
});

async function routeCanonicalSites(context, baseURL) {
  const assetBase = new URL(baseURL);
  const basePath = assetBase.pathname.endsWith('/') ? assetBase.pathname : `${assetBase.pathname}/`;
  await context.route(/^https:\/\/(?:yanivalfasykeelusa|jamesgarage)\.github\.io\//, async route => {
    const requestURL = new URL(route.request().url());
    let path = requestURL.pathname;
    if (requestURL.hostname === 'yanivalfasykeelusa.github.io' && path.startsWith('/james-monster-skyway')) {
      path = path.slice('/james-monster-skyway'.length) || '/';
    }
    const assetURL = new URL(`${basePath}${path.replace(/^\/+/, '')}`, assetBase.origin);
    assetURL.search = requestURL.search;
    const response = await route.fetch({ url: assetURL.href, maxRetries: 2 });
    await route.fulfill({ response });
  });
}

async function waitForGame(page) {
  await page.waitForFunction(() => Boolean(window.__skyway));
  await expect(page.locator('#loading')).toBeHidden();
}

test.afterEach(async ({ context }) => {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
});

test('moves a copy across the real origins with consent, max merging, and replay safety', async ({ context, page, baseURL }) => {
  await routeCanonicalSites(context, baseURL);
  await context.addInitScript(({ key, source, target }) => {
    const initial = location.origin === 'https://yanivalfasykeelusa.github.io' ? source :
      location.origin === 'https://jamesgarage.github.io' ? target : null;
    if (initial && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial));
  }, { key: SAVE_KEY, source: sourceProgress, target: strongerTarget });

  await page.goto(LEGACY_URL, { waitUntil: 'networkidle' });
  await waitForGame(page);
  await page.getByRole('button', { name: 'Grown-up settings', exact: true }).tap();
  const transferButton = page.getByRole('button', { name: 'Move this garage to the new site', exact: true });
  await expect(transferButton).toBeVisible();
  await transferButton.focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/^https:\/\/jamesgarage\.github\.io\/#garage-v1=/);
  await waitForGame(page);
  await expect(page.getByRole('dialog', { name: 'Bring this garage over?' })).toBeVisible();
  await expect(page.locator('#garage-transfer-summary')).toContainText('48 stars and 6 trucks');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(strongerTarget);

  await page.getByRole('button', { name: 'Bring over my garage', exact: true }).tap();
  await expect(page.locator('#garage-transfer')).toBeHidden();
  await expect(page).toHaveURL(TARGET_URL);
  const merged = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(merged).toEqual({ ...sourceProgress, stars: 100, races: 9, challengeWins: 7 });
  await page.getByRole('button', { name: 'Grown-up settings', exact: true }).tap();
  await expect(page.locator('#garage-transfer-entry')).toBeHidden();
  await page.getByRole('button', { name: 'Close settings', exact: true }).tap();
  await page.getByRole('button', { name: "Let's play", exact: true }).tap();
  await page.waitForFunction(() => window.__skyway.phase === 'running' && window.__skyway.distance > 5);
  expect(await page.evaluate(() => ({ selected: window.__skyway.selected, raceMode: window.__skyway.raceMode }))).toEqual({ selected: 'shark-surge', raceMode: 'race' });

  await page.goto(LEGACY_URL, { waitUntil: 'networkidle' });
  await waitForGame(page);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(sourceProgress);
  await page.getByRole('button', { name: 'Grown-up settings', exact: true }).tap();
  await page.getByRole('button', { name: 'Move this garage to the new site', exact: true }).tap();
  await expect(page.getByRole('dialog', { name: 'Bring this garage over?' })).toBeVisible();
  await page.getByRole('button', { name: 'Bring over my garage', exact: true }).tap();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(merged);
});

test('cancel and malformed or oversized payloads preserve the target garage', async ({ context, page, baseURL }) => {
  await routeCanonicalSites(context, baseURL);
  await context.addInitScript(({ key, target }) => {
    if (location.origin === 'https://jamesgarage.github.io' && !localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(target));
    }
  }, { key: SAVE_KEY, target: strongerTarget });

  await page.goto(createGarageTransferURL(sourceProgress), { waitUntil: 'networkidle' });
  await waitForGame(page);
  await page.getByRole('button', { name: 'Keep this garage as it is', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(TARGET_URL);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(strongerTarget);

  for (const hash of ['#garage-v1=not_base64!', `#garage-v1=${'a'.repeat(2100)}`]) {
    await page.goto(`${TARGET_URL}${hash}`, { waitUntil: 'networkidle' });
    // A typed fragment is a same-document navigation. A real transfer arrives
    // from the legacy origin and boots a fresh document, which reload models.
    await page.reload({ waitUntil: 'networkidle' });
    await waitForGame(page);
    await expect(page.getByRole('dialog', { name: 'That transfer link did not work.' })).toBeVisible();
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(strongerTarget);
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(TARGET_URL);
  }
});

test('a blocked import keeps its payload and can be retried after storage recovers', async ({ context, page, baseURL }) => {
  await routeCanonicalSites(context, baseURL);
  await context.addInitScript(({ key, target }) => {
    if (location.origin !== 'https://jamesgarage.github.io') return;
    const nativeSetItem = Storage.prototype.setItem;
    if (!localStorage.getItem(key)) nativeSetItem.call(localStorage, key, JSON.stringify(target));
    window.__allowGarageTransferStorage = false;
    Storage.prototype.setItem = function (name, value) {
      if (name === key && !window.__allowGarageTransferStorage) throw new DOMException('Storage blocked', 'QuotaExceededError');
      return nativeSetItem.call(this, name, value);
    };
  }, { key: SAVE_KEY, target: strongerTarget });

  await page.goto(createGarageTransferURL(sourceProgress), { waitUntil: 'networkidle' });
  await waitForGame(page);
  const transferURL = page.url();
  await page.getByRole('button', { name: 'Bring over my garage', exact: true }).tap();
  await expect(page.locator('#garage-transfer-status')).toContainText('could not save');
  await expect(page.getByRole('button', { name: 'Try saving again', exact: true })).toBeFocused();
  expect(page.url()).toBe(transferURL);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual(strongerTarget);

  await page.evaluate(() => { window.__allowGarageTransferStorage = true; });
  await page.getByRole('button', { name: 'Try saving again', exact: true }).tap();
  await expect(page).toHaveURL(TARGET_URL);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual({ ...sourceProgress, stars: 100, races: 9, challengeWins: 7 });
});

test('a recovered storage read protects a stronger garage that was hidden at boot', async ({ context, page, baseURL }) => {
  await routeCanonicalSites(context, baseURL);
  await context.addInitScript(({ key, target }) => {
    if (location.origin !== 'https://jamesgarage.github.io') return;
    const nativeGetItem = Storage.prototype.getItem;
    const nativeSetItem = Storage.prototype.setItem;
    nativeSetItem.call(localStorage, key, JSON.stringify(target));
    window.__allowGarageTransferRead = false;
    Storage.prototype.getItem = function (name) {
      if (name === key && !window.__allowGarageTransferRead) throw new DOMException('Storage read blocked', 'SecurityError');
      return nativeGetItem.call(this, name);
    };
  }, { key: SAVE_KEY, target: strongerTarget });

  await page.goto(createGarageTransferURL(sourceProgress), { waitUntil: 'networkidle' });
  await waitForGame(page);
  const transferURL = page.url();
  await page.getByRole('button', { name: 'Bring over my garage', exact: true }).tap();
  await expect(page.locator('#garage-transfer-status')).toContainText('could not read');
  expect(page.url()).toBe(transferURL);

  await page.evaluate(() => { window.__allowGarageTransferRead = true; });
  await page.getByRole('button', { name: 'Try saving again', exact: true }).tap();
  await expect(page).toHaveURL(TARGET_URL);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY)).toEqual({ ...sourceProgress, stars: 100, races: 9, challengeWins: 7 });
});
