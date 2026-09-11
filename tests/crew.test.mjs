import test from 'node:test';
import assert from 'node:assert/strict';
import { CREW, CREW_SIZE, raceCrew } from '../src/crew.mjs';
import { createProgress, createRace } from '../src/core.mjs';

test('the stable cast has six recognizable immutable characters and four race slots', () => {
  assert.equal(CREW_SIZE, 4);
  assert.deepEqual(CREW.map(friend => friend.id), ['sunny', 'splash', 'ember', 'pebble', 'bolt', 'digger']);
  assert.ok(Object.isFrozen(CREW));
  assert.equal(new Set(CREW.map(friend => friend.preference)).size, 6);
  for (const friend of CREW) {
    assert.ok(Object.isFrozen(friend));
    assert.equal(friend.style, friend.id);
    assert.ok(Number.isInteger(friend.color) && Number.isInteger(friend.accent));
    assert.ok(friend.scale >= .45 && friend.scale <= .5);
  }
});

test('race slots rotate unique guests deterministically while keeping Sunny and Splash', () => {
  const observed = new Set(), guestPairs = new Set();
  for (let seed = 0; seed < 48; seed++) {
    const roster = raceCrew(seed);
    assert.deepEqual(raceCrew(seed), roster);
    assert.equal(roster.length, CREW_SIZE);
    assert.equal(new Set(roster.map(friend => friend.id)).size, CREW_SIZE);
    assert.deepEqual(roster.slice(0, 2).map(friend => friend.id), ['sunny', 'splash']);
    assert.deepEqual(roster.map(friend => friend.gap), [10, 14, 18, 22]);
    assert.deepEqual(roster.map(friend => friend.lane), [-.65, .65, -.65, .65]);
    roster.slice(2).forEach(friend => observed.add(friend.id));
    guestPairs.add(roster.slice(2).map(friend => friend.id).sort().join('/'));
    if (seed) assert.notDeepEqual(roster.slice(2).map(friend => friend.id), raceCrew(seed - 1).slice(2).map(friend => friend.id));
    const race = createRace(seed);
    assert.deepEqual(race.buddies.map(friend => friend.id), roster.map(friend => friend.id));
    assert.deepEqual(race.buddies.map(friend => friend.distance), [-10, -14, -18, -22]);
    assert.equal(new Set(race.buddies.map(friend => friend.brain)).size, CREW_SIZE);
  }
  assert.deepEqual([...observed].sort(), ['bolt', 'digger', 'ember', 'pebble']);
  assert.equal(guestPairs.size, 6, 'Every guest gets to race with every other guest');
});

test('invalid seeds and old garage saves retain deterministic compatible behavior', () => {
  for (const seed of [undefined, null, -1, NaN, Infinity, '5', {}, []]) assert.deepEqual(raceCrew(seed), raceCrew(0));
  assert.deepEqual(raceCrew(4.9), raceCrew(4));
  assert.deepEqual(raceCrew(1e30), raceCrew(1_000_000_000));
  const save = createProgress({ version: 1, selected: 'mega-titan', stars: 125, races: 9, muted: true, reducedMotion: true });
  assert.deepEqual(save, { version: 1, selected: 'mega-titan', courseId: 'skyway', stars: 125, races: 9, muted: true, reducedMotion: true });
  assert.deepEqual(createRace(save.races).buddies.map(friend => friend.id), raceCrew(9).map(friend => friend.id));
  const changed = raceCrew(0);
  changed[0].name = 'Edited only here';
  assert.equal(CREW[0].name, 'Sunny');
  assert.equal(raceCrew(0)[0].name, 'Sunny');
});
