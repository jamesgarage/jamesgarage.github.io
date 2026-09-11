import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOP_START, LOOP_END, RAMPS, createRace, stepRace } from '../src/core.mjs';
import { createBuddyMind, stepBuddyMind } from '../src/buddy-brain.mjs';

const runningRace = (seed = 0) => ({ ...createRace(seed), phase: 'running' });
const buddyEvents = events => events.filter(event => event.type === 'buddy');

function advance(race, seconds, inputs = {}) {
  const events = [];
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) events.push(...stepRace(race, 1 / 60, inputs));
  return buddyEvents(events);
}

test('a manual jump invites delayed physical echoes from both grounded friends', () => {
  const race = { ...createRace(4), phase: 'running' };
  const first = stepRace(race, 1 / 60, { jump: true });
  assert.ok(first.some(event => event.type === 'jump' && !event.auto));
  assert.ok(race.buddies.every(buddy => buddy.height === 0), 'Friends wait before copying James');
  const echoes = [];
  for (let frame = 0; frame < 90; frame++) {
    for (const event of stepRace(race, 1 / 60)) {
      if (event.type !== 'buddy' || event.action !== 'jump') continue;
      const buddy = race.buddies.find(friend => friend.id === event.id);
      assert.ok(race.elapsed >= .25 && race.elapsed <= .95, 'Imitation follows a short readable delay');
      assert.ok(buddy.height > 0 && buddy.velocityY > 0, 'The signal accompanies a real jump');
      echoes.push(event.id);
    }
  }
  assert.deepEqual(echoes.sort(), ['splash', 'sunny']);
});

test('greetings are staggered, bounded and repeat only on a fresh race', () => {
  const race = runningRace(2), greetings = [];
  for (let frame = 0; frame < 210; frame++) {
    for (const event of buddyEvents(stepRace(race, 1 / 60))) {
      if (event.action === 'hello') greetings.push({ id: event.id, time: race.elapsed });
    }
  }
  assert.deepEqual(greetings.map(event => event.id), ['sunny', 'splash']);
  assert.ok(greetings.every(event => event.time > .1 && event.time < .7));
  assert.ok(greetings[1].time - greetings[0].time > .15);
  assert.ok(race.buddies.every(buddy => buddy.signal === '' && buddy.signalTime === 0));
  assert.deepEqual(advance(runningRace(2), 1).map(event => event.action), ['hello', 'hello']);
});

test('echoes are suppressed while airborne, near ramps or near both loop transitions', () => {
  for (const scenario of [
    { player: 139, buddy: 129 },
    { player: LOOP_START - 23, buddy: LOOP_START - 33 },
    { player: LOOP_END + 2, buddy: LOOP_END - 22 },
    { player: 45, buddy: 35, height: 4, velocityY: 5 },
  ]) {
    const race = runningRace(4);
    race.distance = scenario.player;
    race.buddies.forEach((buddy, index) => {
      Object.assign(buddy, { distance: scenario.buddy - index * 4, height: scenario.height ?? 0, velocityY: scenario.velocityY ?? 0 });
    });
    assert.ok(stepRace(race, 1 / 60, { jump: true }).some(event => event.type === 'jump' && !event.auto));
    assert.ok(!advance(race, 1.1).some(event => event.action === 'jump'), `Unsafe echo at ${scenario.buddy} must be discarded`);
    assert.ok(race.buddies.every(buddy => !buddy.brain.echoPending));
  }
});

test('automatic ramps and unsuccessful button presses never invite imitation or cheering', () => {
  const race = runningRace(1);
  race.distance = RAMPS[0] - .1;
  race.turboEnergy = 0;
  const events = stepRace(race, 1 / 60, { jump: true, turbo: true });
  assert.ok(events.some(event => event.type === 'jump' && event.auto));
  assert.ok(!events.some(event => event.type === 'turbo'));
  assert.ok(!advance(race, 1).some(event => ['jump', 'turbo', 'star'].includes(event.action)));
  assert.ok(race.buddies.every(buddy => !buddy.brain.echoPending));
});

test('crushing and turbo produce delayed cheers without changing the reward', () => {
  for (const action of ['crush', 'turbo']) {
    const race = runningRace(3);
    if (action === 'crush') race.distance = 105;
    const inputs = Object.freeze({ turbo: action === 'turbo' });
    const events = stepRace(race, .05, inputs);
    assert.ok(events.some(event => event.type === action));
    assert.equal(buddyEvents(events).length, 0, 'The response follows rather than coincides with the action');
    const cheers = advance(race, 1).filter(event => event.action === (action === 'crush' ? 'star' : 'turbo'));
    assert.deepEqual(cheers.map(event => event.id).sort(), ['splash', 'sunny']);
    assert.equal(race.stars, action === 'crush' ? 2 : 0);
    assert.equal(race.rewardGranted, false);
  }
});

test('distinct cheer preferences and cooldowns bound repeated valid celebrations', () => {
  for (const [index, id] of ['sunny', 'splash'].entries()) {
    const buddy = { id, distance: 50, height: 0, ...createBuddyMind(7, index) };
    const cheers = [];
    for (let frame = 0; frame < 1200; frame++) {
      const events = [];
      stepBuddyMind(buddy, 1 / 60, {
        elapsed: (frame + 1) / 60, approach: 0, safeJump: true,
        playerEvents: [{ type: 'crush' }, { type: 'turbo' }],
      }, events);
      assert.ok(events.length <= 1, 'One friend emits at most one event per step');
      for (const event of events) if (event.action !== 'hello') cheers.push({ ...event, time: (frame + 1) / 60 });
    }
    assert.ok(cheers.length >= 5 && cheers.length <= 9, 'A busy child still gets friendly but unhurried responses');
    assert.ok(cheers.every(event => event.action === (index === 0 ? 'turbo' : 'star')));
    for (let reaction = 1; reaction < cheers.length; reaction++) {
      assert.ok(cheers[reaction].time - cheers[reaction - 1].time >= (index === 0 ? 2.95 : 2.35));
    }
  }
});

test('held jump has fewer physical echoes than player jumps and per-friend cooldowns', () => {
  const race = runningRace(8), echoes = { sunny: [], splash: [] };
  let playerJumps = 0;
  for (let frame = 0; frame < 1800; frame++) {
    for (const event of stepRace(race, 1 / 60, { jump: true })) {
      if (event.type === 'jump' && !event.auto) playerJumps++;
      if (event.type === 'buddy' && event.action === 'jump') echoes[event.id].push(race.elapsed);
    }
  }
  for (const [id, times] of Object.entries(echoes)) {
    assert.ok(times.length >= 2 && times.length < playerJumps / 2);
    for (let index = 1; index < times.length; index++) assert.ok(times[index] - times[index - 1] >= (id === 'sunny' ? 3.55 : 4.95));
  }
});

test('Sunny offers an early challenge and Splash explores each actual wet stretch once', () => {
  const race = runningRace(5), splashes = [];
  let racing = false, exploring = false, firstPass = 0;
  for (let frame = 0; frame < 5000 && !race.finished; frame++) {
    const events = stepRace(race, 1 / 60);
    const [sunny, splash] = race.buddies;
    if (sunny.intent === 'race') racing = true;
    if (splash.intent === 'puddle') exploring = true;
    if (!firstPass && sunny.distance > race.distance) firstPass = race.distance;
    for (const event of buddyEvents(events)) if (event.action === 'splash') splashes.push({ id: event.id, distance: splash.distance });
  }
  assert.ok(racing && exploring, 'The two preferences become observable during ordinary cruising');
  assert.ok(firstPass > 200 && firstPass < 335, 'The first challenge stays inside the established browser play window');
  assert.equal(splashes.length, 2);
  assert.ok(splashes.every(event => event.id === 'splash'));
  assert.ok(splashes[0].distance >= 222 && splashes[0].distance <= 278);
  assert.ok(splashes[1].distance >= 1232 && splashes[1].distance <= 1312);
  assert.ok(race.buddies.every(buddy => buddy.intent === 'follow'));
});

test('normalization, deterministic variation and serialized continuation need no global random state', () => {
  for (const invalid of [undefined, null, -20, NaN, Infinity, '4', {}, []]) assert.deepEqual(createRace(invalid), createRace(0));
  assert.equal(createRace(4.9).variant, 4);
  assert.equal(createRace(1e100).variant, 1_000_000_000);
  const baseline = runningRace(4), repeated = runningRace(4), other = runningRace(5);
  assert.notDeepEqual(baseline.buddies[0].brain, other.buddies[0].brain);
  const observed = new Set();
  for (let frame = 0; frame < 300; frame++) {
    const inputs = Object.freeze({ jump: frame % 90 === 0, turbo: frame % 180 === 0, steer: Math.sin(frame / 60) });
    const first = stepRace(baseline, 1 / 60, inputs);
    stepRace(other, .05, { jump: true, turbo: true, steer: -1 });
    assert.deepEqual(stepRace(repeated, 1 / 60, inputs), first);
    assert.deepEqual(repeated, baseline, 'Interleaving a different race never consumes another friend’s timing');
    for (const buddy of baseline.buddies) observed.add(buddy.signal);
  }
  const restored = JSON.parse(JSON.stringify(baseline));
  assert.deepEqual(restored, baseline, 'Every state field survives JSON serialization');
  for (let frame = 0; frame < 150; frame++) {
    const inputs = Object.freeze({ jump: frame % 80 === 0 });
    assert.deepEqual(stepRace(restored, 1 / 60, inputs), stepRace(baseline, 1 / 60, inputs));
    assert.deepEqual(restored, baseline);
  }
  assert.ok(observed.has('jump') && observed.has('turbo'));
});

test('race seeds change observable timing while preserving the early challenge and wet-stretch bounds', () => {
  const traces = [];
  for (const seed of [0, 1, 2, 5, 7, 33, 999_999_999]) {
    const race = runningRace(seed), trace = [];
    let firstPass = 0;
    for (let frame = 0; frame < 3200 && race.distance < 1340; frame++) {
      for (const event of buddyEvents(stepRace(race, 1 / 60))) {
        trace.push([event.id, event.action, frame]);
        if (event.action === 'splash') {
          const distance = race.buddies[1].distance;
          assert.ok((distance >= 222 && distance <= 278) || (distance >= 1232 && distance <= 1312));
        }
      }
      if (!firstPass && race.buddies[0].distance > race.distance) firstPass = race.distance;
    }
    assert.ok(firstPass > 200 && firstPass < 335, `Seed ${seed} retains the first friendly challenge`);
    assert.equal(trace.filter(([, action]) => action === 'splash').length, 2);
    traces.push(JSON.stringify(trace));
  }
  assert.equal(new Set(traces).size, traces.length, 'Different seeds produce visibly different reaction timing');
});

test('pause freezes pending reactions; replay owns fresh independent timers', () => {
  const race = runningRace(9);
  stepRace(race, 1 / 60, { jump: true, turbo: true });
  race.phase = 'paused';
  const before = JSON.stringify(race);
  for (let frame = 0; frame < 120; frame++) assert.deepEqual(stepRace(race, .05, { jump: true, turbo: true }), []);
  assert.equal(JSON.stringify(race), before);
  const replay = createRace(10);
  assert.ok(replay.buddies.every(buddy => buddy.signal === '' && buddy.signalTime === 0 && !buddy.brain.echoPending && buddy.brain.cheerPending === ''));
  replay.buddies[0].brain.echoTime = 99;
  assert.notEqual(race.buddies[0].brain.echoTime, 99);
  race.phase = 'running';
  assert.deepEqual(advance(race, 1).filter(event => event.action === 'jump').map(event => event.id).sort(), ['splash', 'sunny']);
});
