import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_LENGTH, LOOP_START, LOOP_END, MAX_BONUS_STARS, RAMPS, TRUCKS,
  createProgress, unlockedTrucks, selectTruck, awardRace, createRace, stepRace,
} from '../src/core.mjs';
import { CRUSH_CARS, TURBO_PADS } from '../src/encounters.mjs';
import { racePlace } from '../src/buddies.mjs';

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
  assert.ok(state.elapsed > 55 && state.elapsed < 78, 'Boosts shorten the drive while crushes recover automatically');
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

test('shared encounter definitions are immutable, distinct, and outside ramps and the loop', () => {
  assert.ok(Object.isFrozen(CRUSH_CARS) && Object.isFrozen(TURBO_PADS));
  assert.deepEqual(CRUSH_CARS.map(car => car.distance), [110, 300, 500, 1185, 1385, 1640]);
  assert.deepEqual(TURBO_PADS.map(pad => pad.distance), [355, 635, 1148, 1460, 1800]);
  for (const row of [...CRUSH_CARS, ...TURBO_PADS]) {
    assert.ok(Object.isFrozen(row));
    assert.ok(row.distance < LOOP_START || row.distance > LOOP_END);
  }
  assert.equal(new Set([...CRUSH_CARS, ...TURBO_PADS].map(row => row.id)).size, 11);
});

test('a swept toy-car contact rewards one squash, briefly slows, then recovers without input', () => {
  const car = CRUSH_CARS[0], state = { ...runningRace(), distance: car.distance - 5, turboEnergy: 0 };
  const events = stepRace(state, .05);
  assert.deepEqual(events.filter(event => event.type === 'crush'), [{ type: 'crush', id: car.id, powered: false }]);
  assert.deepEqual(state.crushedCars, [car.id]);
  assert.equal(state.crushes, 1);
  assert.equal(state.stars, 2);
  assert.ok(state.speed > 0 && state.speed < 10);
  assert.ok(state.turboEnergy >= 35 && state.turboEnergy <= 36);
  for (let i = 0; i < 60; i++) events.push(...stepRace(state, 1 / 60));
  assert.equal(state.bumpTime, 0);
  assert.equal(state.speed, 26);
  assert.equal(events.filter(event => event.type === 'crush').length, 1);
});

test('jumping and separated lanes clear toy cars; larger trucks use their actual footprint', () => {
  for (const initial of [{ height: 2, velocityY: 2 }, { lane: 1, targetLane: 1 }]) {
    const state = { ...runningRace(), distance: 105, ...initial };
    assert.ok(!stepRace(state, .05).some(event => event.type === 'crush'));
    assert.equal(state.crushes, 0);
  }
  const large = { ...runningRace(), distance: 103, lane: 1, targetLane: 1, truckScale: 1.5 };
  assert.ok(stepRace(large, .05).some(event => event.type === 'crush'));
  const apart = { ...runningRace(), distance: 293, lane: 1, targetLane: 1, truckScale: 1.5 };
  for (let i = 0; i < 40; i++) stepRace(apart, 1 / 60);
  assert.equal(apart.crushes, 0, 'Even the largest truck can leave a car in the opposite lane');
});

test('turbo crushes without slowdown and can rescue an already slowed truck', () => {
  const powered = { ...runningRace(), distance: 105 };
  const events = stepRace(powered, .05, { turbo: true });
  assert.ok(events.some(event => event.type === 'turbo' && event.source === 'manual'));
  assert.ok(events.some(event => event.type === 'crush' && event.powered));
  assert.equal(powered.bumpTime, 0);
  assert.ok(powered.speed > 39 && powered.speed < 41);
  const rescue = { ...runningRace(), bumpTime: .5, turboEnergy: 100 };
  stepRace(rescue, .016, { turbo: true });
  assert.equal(rescue.bumpTime, 0);
  assert.ok(rescue.speed > 39);
});

test('manual turbo has a bounded burst, recharges, and held input cannot restart it', () => {
  const state = runningRace();
  const events = [];
  for (let i = 0; i < 510; i++) {
    events.push(...stepRace(state, 1 / 60, { turbo: true, steer: 1 }));
    assert.ok(state.turboEnergy >= 0 && state.turboEnergy <= 100);
    assert.ok(state.turboTime >= 0 && state.turboTime <= 2.4);
    assert.ok(state.speed <= 26 * 1.55);
  }
  assert.equal(events.filter(event => event.type === 'turbo' && event.source === 'manual').length, 1);
  assert.equal(state.turboTime, 0);
  assert.equal(state.turboEnergy, 100);
  stepRace(state, 1 / 60, {});
  assert.ok(stepRace(state, 1 / 60, { turbo: true }).some(event => event.type === 'turbo' && event.source === 'manual'));
  assert.equal(state.turboEnergy, 0);
});

test('full-width pads boost without charge, trigger once, and do not extend an active burst', () => {
  const pad = TURBO_PADS[0];
  for (const lane of [-1, 0, 1]) {
    const state = { ...runningRace(), distance: pad.distance - pad.length / 2 - .1, turboEnergy: 0, lane, targetLane: lane };
    const events = stepRace(state, .05);
    assert.ok(events.some(event => event.type === 'turbo' && event.source === 'pad'));
    for (let i = 0; i < 60; i++) events.push(...stepRace(state, 1 / 60));
    assert.equal(events.filter(event => event.type === 'turbo').length, 1);
  }
  const active = { ...runningRace(), distance: pad.distance - pad.length / 2 - .1, turboTime: 1 };
  assert.ok(!stepRace(active, .05).some(event => event.type === 'turbo'));
  assert.ok(active.turboTime < 1, 'Pad cannot stack or refresh an existing turbo');
});

test('a normal crush permits a real pass and a no-input comeback', () => {
  const state = runningRace();
  let passed = false, recovered = false;
  for (let i = 0; i < 1200; i++) {
    stepRace(state, 1 / 60);
    if (racePlace(state) > 1) passed = true;
    if (passed && racePlace(state) === 1) recovered = true;
  }
  assert.ok(passed, 'A buddy should actually move ahead after the first centered crush');
  assert.ok(recovered, 'Cruising speed restores the lead without a precision input');
});

test('all truck sizes finish first with no input, held controls, and repeated alternating inputs', () => {
  const patterns = [() => ({}), () => ({ turbo: true, jump: true, steer: 1, transform: true }),
    frame => ({ turbo: frame % 2 === 0, jump: frame % 3 === 0, steer: frame % 180 < 90 ? -1 : 1, transform: true })];
  for (const truck of TRUCKS) for (const pattern of patterns) {
    const state = { ...runningRace(), truckScale: truck.scale }, events = [];
    for (let frame = 0; frame < 5000 && !state.finished; frame++) {
      events.push(...stepRace(state, 1 / 60, pattern(frame)));
      for (const value of [state.distance, state.height, state.speed, state.turboEnergy, state.turboTime, state.bumpTime]) assert.ok(Number.isFinite(value));
      assert.ok(state.turboEnergy >= 0 && state.turboEnergy <= 100);
      assert.ok(state.bumpTime >= 0 && state.bumpTime <= .65);
      for (const buddy of state.buddies) {
        assert.ok(Math.abs(buddy.lane) <= 1.65 && buddy.height >= 0);
        assert.ok([buddy.distance, buddy.lane, buddy.height, buddy.velocityY].every(Number.isFinite));
      }
    }
    assert.equal(state.finished, true, `${truck.id} completes`);
    assert.equal(racePlace(state), 1, `${truck.id} earns the lead back before the finish`);
    assert.equal(state.loops, 1);
    assert.equal(events.filter(event => event.type === 'jump' && event.auto).length, RAMPS.length);
    assert.equal(state.crushes, state.crushedCars.length);
    assert.ok(state.crushes <= CRUSH_CARS.length);
    assert.equal(state.stars, 2 * state.crushes);
    assert.equal(state.rewardGranted, false);
  }
});

test('pause freezes turbo, crushes and stateful opponents; replay starts with new state', () => {
  const state = { ...runningRace(), distance: 105 };
  stepRace(state, .05, { turbo: true });
  state.phase = 'paused';
  const paused = structuredClone(state);
  assert.deepEqual(stepRace(state, 1, { turbo: true, steer: Infinity, jump: true }), []);
  assert.deepEqual(state, paused);
  const replay = createRace();
  assert.equal(replay.turboEnergy, 100);
  assert.equal(replay.crushes, 0);
  assert.deepEqual(replay.crushedCars, []);
  assert.notEqual(replay.buddies, state.buddies);
  assert.ok(replay.buddies.every(buddy => buddy.distance < 0));
});

test('capped slow frames cannot skip authored contacts, pads, ramps or the comeback', () => {
  const state = runningRace(), events = [];
  for (let frame = 0; frame < 2000 && !state.finished; frame++) events.push(...stepRace(state, frame % 2 ? .05 : 1));
  assert.equal(state.finished, true);
  assert.deepEqual(state.crushedCars, CRUSH_CARS.map(car => car.id));
  assert.deepEqual(state.usedTurboPads, TURBO_PADS.map(pad => pad.id));
  assert.equal(events.filter(event => event.type === 'jump' && event.auto).length, RAMPS.length);
  assert.equal(events.filter(event => event.type === 'turbo' && event.source === 'pad').length, TURBO_PADS.length);
  assert.equal(state.loops, 1);
  assert.equal(racePlace(state), 1);
});
