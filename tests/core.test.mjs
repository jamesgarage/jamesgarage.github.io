import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_LENGTH, LOOP_START, LOOP_END, MAX_BONUS_STARS, RAMPS, TRUCKS,
  createProgress, unlockedTrucks, selectTruck, awardRace, createRace, stepRace,
} from '../src/core.mjs';

function runningRace() {
  return { ...createRace(), phase: 'running' };
}

test('a no-input run finishes with every ramp, a loop, and an automatic transformation', () => {
  const state = runningRace();
  const events = [];
  for (let frame = 0; frame < 5000 && !state.finished; frame += 1) {
    events.push(...stepRace(state, 1 / 60));
    assert.ok(Number.isFinite(state.height) && state.height >= 0);
  }
  assert.equal(state.phase, 'finished');
  assert.equal(state.distance, COURSE_LENGTH);
  assert.ok(state.elapsed > 72 && state.elapsed < 74);
  assert.equal(events.filter(event => event.type === 'jump' && event.auto).length, RAMPS.length);
  assert.equal(state.landings, RAMPS.length);
  assert.equal(state.loops, 1);
  assert.equal(events.filter(event => event.type === 'loop').length, 1);
  assert.ok(events.some(event => event.type === 'transform'));
  assert.equal(events.filter(event => event.type === 'finish').length, 1);
  assert.equal(state.rewardGranted, false, 'the app owns granting the finish reward');
});

test('manual jumping takes off and lands once without a timing requirement', () => {
  const state = runningRace();
  assert.deepEqual(stepRace(state, 1 / 60, { jump: true }).map(event => event.type), ['jump']);
  assert.ok(state.height > 0);
  const events = [];
  for (let frame = 0; frame < 120; frame += 1) events.push(...stepRace(state, 1 / 60));
  assert.equal(state.height, 0);
  assert.equal(state.velocityY, 0);
  assert.equal(state.landings, 1);
  assert.equal(events.filter(event => event.type === 'land').length, 1);
});

test('holding jump and steering cannot strand a race or escape the track lanes', () => {
  const state = runningRace();
  for (let frame = 0; frame < 5000 && !state.finished; frame += 1) {
    stepRace(state, 1 / 60, { jump: true, steer: frame % 240 < 120 ? -1 : 1, transform: true });
    assert.ok(state.lane >= -1 && state.lane <= 1);
    assert.ok(state.height >= 0 && Number.isFinite(state.height));
    if (state.distance >= LOOP_START && state.distance < LOOP_END) assert.equal(state.height, 0);
  }
  assert.equal(state.finished, true);
  assert.equal(state.loops, 1);
  assert.ok(state.landings > RAMPS.length);
});

test('ready, paused, and finished races ignore updates; finish emits once', () => {
  for (const phase of ['ready', 'paused', 'finished']) {
    const state = { ...createRace(), phase };
    const before = structuredClone(state);
    assert.deepEqual(stepRace(state, 1, { jump: true, steer: 1 }), []);
    assert.deepEqual(state, before);
  }
  const state = { ...runningRace(), distance: COURSE_LENGTH - 0.1 };
  assert.equal(stepRace(state, 1 / 60).filter(event => event.type === 'finish').length, 1);
  const finishedState = structuredClone(state);
  assert.deepEqual(stepRace(state, 1 / 60), []);
  assert.deepEqual(state, finishedState);
});

test('long frames are capped and invalid time steps cannot corrupt state', () => {
  const state = runningRace();
  for (const dt of [NaN, Infinity, -1, 0]) assert.deepEqual(stepRace(state, dt), []);
  assert.equal(state.distance, 0);
  stepRace(state, 1000);
  assert.equal(state.elapsed, 0.05);
  assert.ok(state.distance < 2);
});

test('the first finish unlocks Bear Crusher and truck selection requires earned stars', () => {
  const initial = createProgress();
  assert.deepEqual(unlockedTrucks(initial).map(truck => truck.id), ['rumbler']);
  assert.equal(selectTruck(initial, 'mega-titan'), initial);
  assert.equal(selectTruck(initial, 'not-a-truck'), initial);
  const rewarded = awardRace(initial, 0);
  assert.equal(initial.stars, 0);
  assert.equal(rewarded.stars, 12);
  assert.equal(rewarded.races, 1);
  assert.deepEqual(unlockedTrucks(rewarded).map(truck => truck.id), ['rumbler', 'bear-crusher']);
  const selected = selectTruck(rewarded, 'bear-crusher');
  assert.notEqual(selected, rewarded);
  assert.equal(selected.selected, 'bear-crusher');
  assert.equal(rewarded.selected, 'rumbler');
});

test('all progression thresholds unlock exactly the earned vehicles', () => {
  for (const [index, truck] of TRUCKS.entries()) {
    const progress = createProgress({ version: 1, stars: truck.threshold, selected: truck.id });
    assert.equal(unlockedTrucks(progress).length, index + 1);
    assert.equal(progress.selected, truck.id);
    if (truck.threshold > 0) {
      assert.equal(unlockedTrucks(createProgress({ version: 1, stars: truck.threshold - 1 })).length, index);
    }
  }
});

test('corrupted, future-version, and locked-truck saves recover to safe values', () => {
  const defaults = createProgress();
  for (const raw of [null, undefined, false, 5, [], 'broken', { version: 2, stars: 999 }]) {
    assert.deepEqual(createProgress(raw), defaults);
  }
  assert.deepEqual(createProgress({
    version: 1, stars: NaN, races: -20, selected: 'mega-titan', muted: 'false', reducedMotion: 1,
  }), defaults);
  assert.deepEqual(createProgress({
    version: 1, stars: 32.9, races: 2.9, selected: 'gator-claw', muted: true, reducedMotion: true,
  }), { version: 1, stars: 32, races: 2, selected: 'gator-claw', muted: true, reducedMotion: true });
  assert.equal(createProgress({ version: 1, stars: Infinity }).stars, 0);
  assert.equal(createProgress({ version: 1, stars: -1 }).stars, 0);
});

test('reward bonuses are bounded integers and saved preferences survive a round trip', () => {
  const initial = createProgress({ version: 1, muted: true, reducedMotion: true, races: 4 });
  assert.equal(awardRace(initial, -99).stars, 12);
  assert.equal(awardRace(initial, NaN).stars, 12);
  assert.equal(awardRace(initial, Infinity).stars, 12);
  assert.equal(awardRace(initial, 4.9).stars, 16);
  assert.equal(awardRace(initial, 1000).stars, 12 + MAX_BONUS_STARS);
  const rewarded = awardRace(initial, 30);
  assert.equal(rewarded.races, 5);
  assert.equal(rewarded.muted, true);
  assert.equal(rewarded.reducedMotion, true);
  assert.deepEqual(createProgress(JSON.parse(JSON.stringify(rewarded))), rewarded);
});

test('a full energy charge can transform early, expires, then starts charging again', () => {
  const state = { ...runningRace(), energy: 100 };
  assert.ok(stepRace(state, 1 / 60, { transform: true }).some(event => event.type === 'transform'));
  assert.equal(state.energy, 0);
  assert.equal(state.transformTime, 9);
  for (let frame = 0; frame < 550; frame += 1) stepRace(state, 1 / 60);
  assert.equal(state.transformTime, 0);
  assert.ok(state.energy > 0 && state.energy < 100);
});
