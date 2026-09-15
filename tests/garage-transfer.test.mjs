import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GARAGE_DESTINATION,
  MAX_TRANSFER_FRAGMENT_LENGTH,
  TRANSFER_FRAGMENT_PREFIX,
  clearGarageTransferHash,
  createGarageTransferURL,
  isGarageDestination,
  isLegacyGameLocation,
  mergeGarageProgress,
  parseGarageTransferHash,
} from '../src/garage-transfer.mjs';

const fullProgress = Object.freeze({
  version: 1,
  stars: 48,
  selected: 'shark-surge',
  courseId: 'canyon',
  raceMode: 'race',
  rivalRank: 2,
  cameraView: 'wide',
  challengeWins: 7,
  muted: true,
  reducedMotion: true,
  races: 3,
});

function fragmentFor(value) {
  const json = JSON.stringify(value);
  const binary = String.fromCharCode(...new TextEncoder().encode(json));
  const payload = btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  return `${TRANSFER_FRAGMENT_PREFIX}${payload}`;
}

test('builds a bounded transfer to the fixed destination and round trips canonical progress', () => {
  const url = createGarageTransferURL(fullProgress);
  assert.ok(url.startsWith(`${GARAGE_DESTINATION}${TRANSFER_FRAGMENT_PREFIX}`));
  assert.ok(new URL(url).hash.length < MAX_TRANSFER_FRAGMENT_LENGTH);
  assert.deepEqual(parseGarageTransferHash(new URL(url).hash), { status: 'ready', progress: fullProgress });
});

test('normalizes the source save before encoding', () => {
  const url = createGarageTransferURL({ version: 1, stars: Infinity, selected: 'mega-titan', races: -4, muted: 'yes' });
  const result = parseGarageTransferHash(new URL(url).hash);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.progress, {
    version: 1, stars: 0, selected: 'rumbler', courseId: 'skyway', raceMode: 'cruise',
    rivalRank: 1, cameraView: 'close', challengeWins: 0, muted: false,
    reducedMotion: false, races: 0,
  });
});

test('rejects malformed, oversized, wrong-version, and noncanonical payloads', () => {
  assert.deepEqual(parseGarageTransferHash('#something-else'), { status: 'none' });
  assert.deepEqual(parseGarageTransferHash(`${TRANSFER_FRAGMENT_PREFIX}!bad`), { status: 'invalid', reason: 'malformed' });
  assert.deepEqual(parseGarageTransferHash(`${TRANSFER_FRAGMENT_PREFIX}${'a'.repeat(MAX_TRANSFER_FRAGMENT_LENGTH)}`), { status: 'invalid', reason: 'too-large' });
  assert.equal(parseGarageTransferHash(fragmentFor({ version: 2, progress: fullProgress })).status, 'invalid');
  assert.equal(parseGarageTransferHash(fragmentFor({ version: 1, progress: { ...fullProgress, stars: '48' } })).status, 'invalid');
  assert.equal(parseGarageTransferHash(fragmentFor({ version: 1, progress: { ...fullProgress, selected: 'not-a-truck' } })).status, 'invalid');
});

test('strips unexpected properties rather than carrying them into progress', () => {
  const malicious = JSON.parse(JSON.stringify({ version: 1, progress: { ...fullProgress, __proto__: null, script: '<script>' } }));
  const result = parseGarageTransferHash(fragmentFor(malicious));
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.progress, fullProgress);
  assert.equal(Object.hasOwn(result.progress, 'script'), false);
});

test('merges counters by maximum and uses valid source selections and preferences', () => {
  const strongerLocal = {
    ...fullProgress,
    stars: 100,
    races: 9,
    challengeWins: 4,
    selected: 'mega-titan',
    courseId: 'skyway',
    raceMode: 'cruise',
    rivalRank: 0,
    cameraView: 'close',
    muted: false,
    reducedMotion: false,
  };
  const merged = mergeGarageProgress(strongerLocal, fullProgress);
  assert.deepEqual(merged, { ...fullProgress, stars: 100, races: 9, challengeWins: 7 });
  assert.deepEqual(mergeGarageProgress(merged, fullProgress), merged, 'replay must not duplicate rewards');
});

test('invalid source progress cannot change the existing garage', () => {
  const current = { ...fullProgress, stars: 100, selected: 'mega-titan' };
  assert.deepEqual(mergeGarageProgress(current, { ...fullProgress, selected: 'locked-truck' }), current);
});

test('shows transfer entry only at the legacy game path and recognizes the canonical destination', () => {
  assert.equal(isLegacyGameLocation({ origin: 'https://yanivalfasykeelusa.github.io', pathname: '/james-monster-skyway/' }), true);
  assert.equal(isLegacyGameLocation({ origin: 'https://yanivalfasykeelusa.github.io', pathname: '/' }), false);
  assert.equal(isLegacyGameLocation({ origin: 'https://jamesgarage.github.io', pathname: '/james-monster-skyway/' }), false);
  assert.equal(isGarageDestination({ origin: 'https://jamesgarage.github.io' }), true);
  assert.equal(isGarageDestination({ origin: 'http://127.0.0.1:4180' }), false);
});

test('clears only the fragment after import or cancellation', () => {
  let replacement;
  const history = { state: { page: 1 }, replaceState(state, title, url) { replacement = { state, title, url }; } };
  clearGarageTransferHash(history, { pathname: '/play/', search: '?from=old', hash: '#garage-v1=data' });
  assert.deepEqual(replacement, { state: { page: 1 }, title: '', url: '/play/?from=old' });
});
