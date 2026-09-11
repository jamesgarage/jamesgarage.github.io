import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, stepRace, LOOP_START, LOOP_END, TRUCKS } from '../src/core.mjs';
import { getCourse } from '../src/courses.mjs';
import { sampleFlight } from '../src/flight.mjs';
import { SMASH_TARGETS } from '../src/encounters.mjs';

const running = (id = 'skyway') => ({ ...createRace(0, id), phase: 'running' });

test('robot toggle works immediately, persists, ignores held input and overrides an automatic form', () => {
  const race = running();
  assert.equal(race.energy, 0);
  assert.ok(stepRace(race, 1 / 60, { transform: true }).some(event => event.type === 'transform'));
  assert.equal(race.robotMode, true);
  for (let frame = 0; frame < 650; frame++) stepRace(race, 1 / 60, { transform: true });
  assert.ok(race.transformTime > 0);
  assert.equal(race.robotMode, true);
  stepRace(race, .01);
  stepRace(race, .01, { transform: true });
  assert.equal(race.robotMode, false);
  assert.equal(race.transformTime, 0);
  for (let frame = 0; frame < 3000 && !race.finished; frame++) stepRace(race, 1 / 60);
  assert.equal(race.transformTime, 0, 'Choosing the truck keeps it selected instead of auto-toggling again');
  const automatic = { ...running(), transformTime: 5 };
  stepRace(automatic, .01, { transform: true });
  assert.equal(automatic.robotMode, false);
  assert.equal(automatic.transformTime, 0);
});

test('untouched temporary guardian still expires and recharges', () => {
  const race = { ...running(), distance: 729.9, energy: 100 };
  assert.ok(stepRace(race, .01).some(event => event.type === 'transform'));
  assert.equal(race.robotMode, false);
  for (let frame = 0; frame < 550; frame++) stepRace(race, 1 / 60);
  assert.equal(race.transformTime, 0);
  assert.ok(race.energy > 0);
});

test('flight sampler follows distance, retains an existing jump height and lands exactly', () => {
  const flight = { start: 100, end: 210, height: 12, startHeight: 4 };
  assert.deepEqual(sampleFlight(flight, 100, 26), { height: 4, velocityY: 44 / 110 * 26 });
  assert.equal(sampleFlight(flight, 155, 40).height, 14);
  assert.deepEqual(sampleFlight(flight, 210, 40), { height: 0, velocityY: 0 });
  assert.deepEqual(sampleFlight(null, 150), { height: 0, velocityY: 0 });
  assert.deepEqual(sampleFlight(flight, NaN), { height: 0, velocityY: 0 });
});

test('one Fly press launches one bounded rocket arc; a normal Jump stays a normal jump', () => {
  const normal = running();
  stepRace(normal, .01, { jump: true });
  assert.equal(normal.flight, null);
  assert.ok(normal.height > 0);
  const race = running(), events = [];
  events.push(...stepRace(race, .01, { transform: true, jump: true }));
  assert.equal(race.flight.kind, 'rocket');
  assert.equal(race.flight.end - race.flight.start, 110);
  for (let frame = 0; frame < 480; frame++) {
    events.push(...stepRace(race, 1 / 60, { jump: true }));
    assert.ok(Number.isFinite(race.height));
  }
  assert.equal(events.filter(event => event.type === 'flight').length, 1);
  assert.equal(race.flight, null);
  assert.equal(race.flying, false);
  assert.equal(race.robotMode, true);
});

test('rocket arcs stop before the guided loop or selected finish, including short races', () => {
  for (const [courseId, distance, limit] of [['skyway', 750, LOOP_START], ['loop', 1060, 1140], ['woods', 480, 550], ['bay', 1840, 1900]]) {
    const race = { ...running(courseId), distance };
    stepRace(race, .01, { transform: true, jump: true });
    assert.ok(race.flight.end < limit);
    for (let frame = 0; frame < 250 && !race.finished; frame++) stepRace(race, 1 / 60);
    assert.equal(race.flight, null);
    assert.equal(race.flying, false);
  }
  for (const distance of [LOOP_START + 1, LOOP_END - 1]) {
    const race = { ...running(), distance };
    stepRace(race, .01, { transform: true, jump: true });
    assert.equal(race.flight, null);
    assert.equal(race.height, 0);
  }
});

test('all canyon gaps protect every friend and truck under turbo, held and toggled controls, jumps and capped dt', () => {
  for (const truck of TRUCKS) for (const seed of [0, 2, 5]) for (const pattern of [0, 1, 2]) {
    const race = { ...running('canyon'), ...createRace(seed, 'canyon'), phase: 'running', truckScale: truck.scale };
    const events = [];
    for (let frame = 0; frame < 5000 && !race.finished; frame++) {
      const inputs = pattern === 0 ? {} : pattern === 1 ? { jump: true, transform: true, turbo: true, steer: 1 }
        : { jump: frame % 17 === 0, transform: frame % 31 === 0, turbo: frame % 19 === 0, steer: Math.sin(frame / 20) };
      events.push(...stepRace(race, [1 / 60, 1 / 30, .5][frame % 3], inputs));
      for (const actor of [race, ...race.buddies]) for (const gap of getCourse('canyon').gaps) {
        if (actor.distance >= gap.start && actor.distance <= gap.end) {
          assert.ok(actor.height > 4, `${truck.id} ${seed}/${pattern} ${actor.id ?? 'player'} ${gap.id}`);
          assert.ok(actor.flying);
          if (actor === race) assert.ok(race.transformTime > 0, 'Safety flight remains in robot form even after Truck is pressed');
        }
      }
      for (const [index, buddy] of race.buddies.entries()) {
        assert.ok(Math.abs(race.lane - buddy.lane) * 3.4 >= 3.2 * truck.scale + 2.25 * buddy.scale ||
          Math.abs(race.distance - buddy.distance) >= 2.8 * (truck.scale + buddy.scale), 'Form changes retain room for all four companions');
        if (index) assert.ok(race.buddies[index - 1].distance - buddy.distance >= 4 - 1e-8);
      }
    }
    assert.ok(race.finished);
    assert.equal(race.canyonCrossings, 4);
    assert.equal(events.filter(event => event.type === 'canyon').length, 4);
    assert.equal(new Set(race.crossedGaps).size, 4);
    assert.ok(race.buddies.every(buddy => buddy.distance < race.distance));
  }
});

test('pause and invalid dt freeze all flight, toggle, crossing and smash state, and JSON replay stays deterministic', () => {
  const race = { ...running('canyon'), distance: 225 };
  stepRace(race, .01, { turbo: true });
  assert.ok(race.flying);
  for (const dt of [0, -1, NaN, Infinity]) {
    const snapshot = structuredClone(race);
    assert.deepEqual(stepRace(race, dt, { transform: true, jump: true }), []);
    assert.deepEqual(race, snapshot);
  }
  race.phase = 'paused';
  const snapshot = structuredClone(race);
  assert.deepEqual(stepRace(race, .05, { transform: true }), []);
  assert.deepEqual(race, snapshot);
  race.phase = 'running';
  const restored = JSON.parse(JSON.stringify(race));
  for (let frame = 0; frame < 200; frame++) {
    assert.deepEqual(stepRace(race, .05), stepRace(restored, .05));
    assert.deepEqual(race, restored);
  }
});

test('each actual toy collider awards three stars and one positive burst, with height and lane clearance', () => {
  for (const target of SMASH_TARGETS) {
    const race = { ...running(), distance: target.distance - target.halfLength - 3, lane: target.lane, targetLane: target.lane, turboEnergy: 0 };
    race.buddies.forEach((buddy, slot) => { buddy.distance = race.distance - 30 - 4 * slot; });
    const events = stepRace(race, .05);
    assert.deepEqual(events.filter(event => event.type === 'smash'), [{ type: 'smash', id: target.id, kind: target.kind, stars: 3 }]);
    assert.equal(race.smashes, 1);
    assert.equal(race.stars, 3);
    assert.ok(race.speed > 26);
    assert.ok(race.turboEnergy >= 35);
    assert.ok(!stepRace(race, .05).some(event => event.type === 'smash'));
    const airborne = { ...running(), distance: target.distance - 2, lane: target.lane, targetLane: target.lane, height: 4, velocityY: 2 };
    assert.ok(!stepRace(airborne, .05).some(event => event.type === 'smash'));
    const apart = { ...running(), distance: target.distance - 2, lane: target.lane < 0 ? 1 : -1, targetLane: target.lane < 0 ? 1 : -1 };
    if (Math.abs(apart.lane - target.lane) > (target.halfWidth + 2) / 3.4) assert.ok(!stepRace(apart, .05).some(event => event.type === 'smash'));
  }
});
