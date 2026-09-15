import test from 'node:test';
import assert from 'node:assert/strict';
import { createRace, createProgress, awardRace, selectTruck, stepRace, TRUCKS } from '../src/core.mjs';
import { createRivalProfile, rivalPace, recordFinishCrossings, raceStandings, RACE_TURN_DRIFT } from '../src/race-rules.mjs';
import { racePlace } from '../src/buddies.mjs';
import { turnAt } from '../src/turns.mjs';

test('old saves and ordinary races retain Cruise while Rival Race is explicitly selected', () => {
  const old = { version: 1, stars: 123, races: 7, selected: 'mega-titan', courseId: 'canyon', muted: true, reducedMotion: true };
  assert.equal(createProgress(old).raceMode, 'cruise');
  assert.equal(createProgress(old).challengeWins, 0);
  assert.equal(createRace().raceMode, 'cruise');
  assert.equal(createRace(2, 'bay', 'race').raceMode, 'race');
  for (const invalid of [undefined, null, 'challenge', 'RACE', 1, {}]) {
    assert.equal(createRace(2, 'bay', invalid).raceMode, 'cruise');
  }
  const saved = createProgress({ ...old, raceMode: 'race', challengeWins: 3 });
  assert.equal(saved.raceMode, 'race');
  assert.equal(saved.challengeWins, 3);
  assert.deepEqual(createProgress(JSON.parse(JSON.stringify(saved))), saved);
  assert.equal(awardRace(saved, 5).raceMode, 'race');
  assert.equal(selectTruck(saved, 'rumbler').challengeWins, 3);
  assert.equal(awardRace(saved, 5).challengeWins, 3, 'Completion alone is not a competitive win');
  const preferences = createProgress({ ...saved, cameraView: 'wide', rivalRank: 2 });
  assert.equal(awardRace(preferences).cameraView, 'wide');
  assert.equal(selectTruck(preferences, 'rumbler').rivalRank, 2);
  assert.equal(createProgress({ ...saved, cameraView: 'invalid', rivalRank: null }).cameraView, 'close');
  assert.equal(createProgress({ ...saved, rivalRank: null }).rivalRank, 1);
});

test('challenge statistics reject corrupt values without changing garage thresholds', () => {
  for (const invalid of [NaN, Infinity, -20, '9', null, {}]) {
    assert.equal(createProgress({ version: 1, challengeWins: invalid }).challengeWins, 0);
  }
  assert.equal(createProgress({ version: 1, challengeWins: 4.9 }).challengeWins, 4);
  assert.equal(createProgress({ version: 1, challengeWins: 1e20 }).challengeWins, 1e9);
  assert.equal(createProgress({ version: 1, stars: 99, selected: 'mega-titan', challengeWins: 100 }).selected, 'rumbler');
});

test('competitive grids and ledgers are fresh while Cruise keeps its original formation', () => {
  const cruise = createRace(4, 'loop');
  assert.deepEqual(cruise.buddies.map(buddy => buddy.distance), [555, 551, 547, 543]);
  const race = createRace(4, 'loop', 'race');
  assert.deepEqual(race.buddies.map(buddy => buddy.distance), [585, 575, 555, 545]);
  assert.deepEqual(race.buddies.map(buddy => buddy.id), cruise.buddies.map(buddy => buddy.id));
  assert.equal(race.rivalRank, 1);
  assert.deepEqual(race.finishOrder, []);
  assert.equal(race.winnerId, null);
  assert.equal(race.result, null);
  race.finishOrder.push({ id: 'sunny', place: 1, time: 2 });
  assert.deepEqual(createRace(4, 'loop', 'race').finishOrder, []);
});

test('crossings use within-step times, freeze the first winner, and never invent late finishes', () => {
  const race = createRace(0, 'woods', 'race');
  const end = race.courseEnd;
  const first = recordFinishCrossings(race, [
    { id: 'splash', from: end - .4, to: end + .4 },
    { id: 'sunny', from: end - .1, to: end + .9 },
  ], 20, .05);
  assert.deepEqual(first.map(entry => entry.id), ['sunny', 'splash']);
  assert.ok(Math.abs(first[0].time - 20.005) < 1e-10);
  assert.ok(Math.abs(first[1].time - 20.025) < 1e-10);
  assert.equal(race.winnerId, 'sunny');
  assert.equal(race.result, null);
  recordFinishCrossings(race, [
    { id: 'player', from: end - .2, to: end + .8 },
    { id: race.buddies[2].id, from: end - .9, to: end + .1 },
    { id: 'sunny', from: end - .1, to: end + .9 },
  ], 21, .05);
  assert.deepEqual(race.finishOrder.map(entry => entry.id), ['sunny', 'splash', 'player']);
  assert.equal(race.result.place, 3);
  assert.equal(race.result.won, false);
  race.distance = end;
  for (const buddy of race.buddies) buddy.distance = end;
  assert.equal(racePlace(race), 3, 'Equal rendered finish poses cannot turn a loss into first place');
  assert.equal(raceStandings(race).length, 5);
  assert.equal(raceStandings(race).filter(entry => entry.finished).length, 3);
  const snapshot = structuredClone(race);
  recordFinishCrossings(race, [{ id: 'player', from: end - 1, to: end + 1 }], 22, .05);
  assert.deepEqual(race, snapshot);
});

test('exact ties are stable across actor traversal and invalid or ineligible motion never finishes', () => {
  const base = createRace(0, 'woods', 'race');
  const motions = ['sunny', 'splash', 'player'].map(id => ({ id, from: 549, to: 551 }));
  const forward = structuredClone(base), reversed = structuredClone(base);
  recordFinishCrossings(forward, motions, 10, .05);
  recordFinishCrossings(reversed, motions.slice().reverse(), 10, .05);
  assert.deepEqual(forward.finishOrder, reversed.finishOrder);
  for (const motion of [
    { id: 'player', from: 549, to: 552, eligible: false },
    { id: 'player', from: NaN, to: 552 }, { id: 'player', from: 549, to: Infinity },
    { id: 'unknown', from: 549, to: 552 }, { id: 'player', from: 552, to: 551 },
  ]) {
    const race = structuredClone(base);
    assert.deepEqual(recordFinishCrossings(race, [motion], 10, .05), []);
    assert.deepEqual(race.finishOrder, []);
  }
});

test('competitive wins are awarded only with a real first-place result and keep completion rewards', () => {
  const progress = createProgress({ version: 1, raceMode: 'race', challengeWins: 4, rivalRank: 2 });
  assert.equal(awardRace(progress, 5, { place: 2, winnerId: 'sunny' }).challengeWins, 4);
  const won = awardRace(progress, 5, { place: 1, winnerId: 'player' });
  assert.equal(won.challengeWins, 5);
  assert.equal(won.stars, 17);
  assert.equal(won.rivalRank, 2);
  assert.equal(awardRace(createProgress(), 0, { place: 1, winnerId: 'player' }).challengeWins, 0);
});

test('rival pace and short boosts depend only on chosen rank, identity, seed and simulation time', () => {
  const profile = createRivalProfile(8, 'sunny', 1);
  assert.deepEqual(createRivalProfile(8, 'sunny', 1), profile);
  assert.notEqual(createRivalProfile(9, 'sunny', 1).speed, profile.speed);
  assert.notEqual(createRivalProfile(8, 'splash', 1).speed, profile.speed);
  assert.ok(createRivalProfile(8, 'sunny', 0).speed < profile.speed);
  assert.ok(createRivalProfile(8, 'sunny', 2).speed > profile.speed);
  assert.equal(rivalPace(profile, profile.boostDelay).boosting, true);
  assert.equal(rivalPace(profile, profile.boostDelay + profile.boostDuration + .01).boosting, false);
  for (let elapsed = 0; elapsed < 120; elapsed += .031) {
    const pace = rivalPace(profile, elapsed);
    assert.ok(pace.speed >= profile.speed && pace.speed <= profile.speed * 1.14);
  }
});

test('competitive movement preserves every swept pair clearance across truck sizes and changing inputs', () => {
  for (const truck of TRUCKS) for (const seed of [0, 3]) {
    const race = { ...createRace(seed, 'woods', 'race'), phase: 'running', truckScale: truck.scale };
    for (let frame = 0; frame < 4000 && !race.finished; frame++) {
      const actorsBefore = structuredClone([race, ...race.buddies].map(actor => ({ id: actor.id ?? 'player', distance: actor.distance, lane: actor.lane })));
      stepRace(race, frame % 2 ? 1 / 60 : .05, { steer: frame % 200 < 100 ? -1 : 1,
        turbo: frame % 20 === 0, transform: frame % 45 === 0 });
      const actors = [{ ...race, id: 'player' }, ...race.buddies];
      for (let i = 0; i < actors.length; i++) {
        assert.ok(actors[i].distance >= actorsBefore[i].distance);
        assert.ok(actors[i].distance - actorsBefore[i].distance <= 2.02 + 1e-9, 'No participant teleports to catch up');
        for (let j = i + 1; j < actors.length; j++) {
          const a = actors[i], b = actors[j];
          const playerPair = a.id === 'player' || b.id === 'player';
          const width = playerPair ? (3.2 * truck.scale + 1.15 + .25) / 3.4 : (2 * 1.15 + .25) / 3.4;
          const gap = playerPair ? 8.5 : 4;
          assert.ok(Math.abs(a.distance - b.distance) >= gap - 1e-8 || Math.abs(a.lane - b.lane) >= width - 1e-8,
            `${truck.id} frame${frame} ${a.id}/${b.id} retain body clearance`);
          let enter = 0, exit = 1;
          for (const [from, to, limit] of [
            [actorsBefore[i].distance - actorsBefore[j].distance, a.distance - b.distance, gap - 1e-7],
            [actorsBefore[i].lane - actorsBefore[j].lane, a.lane - b.lane, width - 1e-7],
          ]) {
            const change = to - from;
            if (Math.abs(change) < 1e-12) {
              if (Math.abs(from) >= limit) { enter = 1; exit = 0; break; }
            } else {
              const first = (-limit - from) / change, last = (limit - from) / change;
              enter = Math.max(enter, Math.min(first, last));
              exit = Math.min(exit, Math.max(first, last));
            }
          }
          assert.ok(enter > exit, `${truck.id} frame${frame} ${a.id}/${b.id} have no collision within the step`);
        }
      }
    }
    assert.ok(race.finished && race.result && race.result.place >= 1 && race.result.place <= 5);
  }
});

function carefulInputs(race, frame) {
  return { steer: Math.max(-1, Math.min(1, (.9 - race.targetLane) * 5 +
    turnAt(race.distance, race.courseId).steer * RACE_TURN_DRIFT / 2.4)), turbo: frame % 20 === 0 };
}

test('every truck can genuinely win and lose every course at the default rank', () => {
  let changedNpcOrder = false, allRivalsFinishedBeforePlayer = false;
  for (const truck of TRUCKS) for (const courseId of ['woods', 'loop', 'bay', 'skyway', 'canyon']) for (const seed of [0, 3, 5]) {
    const results = [];
    for (const careful of [false, true]) {
      const race = { ...createRace(seed, courseId, 'race'), phase: 'running', truckScale: truck.scale };
      const events = [];
      for (let frame = 0; frame < 9000 && !race.finished; frame++) {
        events.push(...stepRace(race, 1 / 60, careful ? carefulInputs(race, frame) : {}));
        for (const actor of [race, ...race.buddies]) {
          assert.ok(Number.isFinite(actor.distance) && Number.isFinite(actor.height) && actor.height >= 0);
          if (courseId === 'canyon') {
            for (const [start, end] of [[210, 280], [460, 535], [1250, 1335], [1570, 1665]]) {
              if (actor.distance >= start && actor.distance <= end) assert.ok(actor.height > 4, 'Competition preserves guaranteed canyon clearance');
            }
          }
        }
      }
      assert.ok(race.finished, `${truck.id} ${courseId} seed${seed} completes`);
      assert.equal(race.result.winnerId, race.finishOrder[0].id);
      assert.equal(racePlace(race), race.result.place);
      assert.equal(events.filter(event => event.type === 'finish').length, 1);
      assert.equal(new Set(race.finishOrder.map(entry => entry.id)).size, race.finishOrder.length);
      assert.ok(race.finishOrder.every((entry, index, entries) => entry.place === index + 1 && (!index || entry.time >= entries[index - 1].time)));
      const finishedIds = race.finishOrder.filter(entry => entry.id !== 'player').map(entry => entry.id);
      if (finishedIds.length > 1 && finishedIds.some((id, index) => id !== race.buddies[index].id)) changedNpcOrder = true;
      if (finishedIds.length === 4) allRivalsFinishedBeforePlayer = true;
      results.push(race.result.place);
    }
    assert.ok(results[0] > 1, `${truck.id} ${courseId} seed${seed}: an untouched race really loses`);
    assert.equal(results[1], 1, `${truck.id} ${courseId} seed${seed}: steering and Turbo can earn the win`);
  }
  assert.ok(changedNpcOrder, 'Independent rivals really exchange order');
  assert.ok(allRivalsFinishedBeforePlayer, 'Finished leaders never block later rivals before the line');
});

test('integrated same-step finishes use crossing time and stop permanently at the player result', () => {
  for (const npcFirst of [false, true]) {
    const race = { ...createRace(0, 'skyway', 'race'), phase: 'running', distance: 1900 - (npcFirst ? .2 : .1), lane: -1, targetLane: -1 };
    race.buddies.forEach((buddy, index) => { buddy.distance = index ? 1800 - index * 10 : 1900 - (npcFirst ? .1 : .2); buddy.lane = index ? buddy.lane : 1.65; });
    const events = stepRace(race, .05);
    assert.equal(race.winnerId, npcFirst ? 'sunny' : 'player');
    assert.equal(race.result.place, npcFirst ? 2 : 1);
    assert.equal(events.filter(event => event.type === 'finish').length, 1);
    const snapshot = structuredClone(race);
    assert.deepEqual(stepRace(race, .05, { turbo: true, jump: true, transform: true }), []);
    assert.deepEqual(race, snapshot);
  }
});

test('competitive races and tow stages serialize, pause and replay without private clocks', () => {
  const race = { ...createRace(5, 'woods', 'race', { rivalRank: 2 }), phase: 'running' };
  for (let frame = 0; frame < 1200 && !race.recovery; frame++) stepRace(race, 1 / 60, { steer: -1 });
  assert.ok(race.recovery);
  const replay = JSON.parse(JSON.stringify(race));
  for (let frame = 0; frame < 400; frame++) {
    const inputs = { steer: frame % 90 < 45 ? -1 : 1, turbo: frame % 20 === 0, transform: frame % 100 === 0 };
    assert.deepEqual(stepRace(race, frame % 2 ? .05 : 1 / 60, inputs), stepRace(replay, frame % 2 ? .05 : 1 / 60, inputs));
    assert.deepEqual(race, replay);
  }
  for (const phase of ['ready', 'paused', 'finished']) {
    race.phase = phase;
    const snapshot = structuredClone(race);
    for (const dt of [0, NaN, Infinity, -.1, .05]) {
      assert.deepEqual(stepRace(race, dt, { steer: 1, jump: true, turbo: true }), []);
      assert.deepEqual(race, snapshot);
    }
  }
  const fresh = createRace(6, 'canyon', 'race', { rivalRank: 0 });
  assert.equal(fresh.recovery, null);
  assert.equal(fresh.offCourseCount, 0);
  assert.equal(fresh.result, null);
  assert.deepEqual(fresh.finishOrder, []);
  assert.equal(fresh.rivalRank, 0);
});

test('a real off-course drive calls one tow, holds station while rivals race, and freezes on pause', () => {
  const race = { ...createRace(0, 'woods', 'race'), phase: 'running', truckScale: 1.5 };
  const events = [];
  for (let frame = 0; frame < 1500 && !race.recovery; frame++) events.push(...stepRace(race, 1 / 60, { steer: 1 }));
  assert.ok(race.recovery, 'Holding the outside direction through a real shoulder calls recovery');
  assert.equal(race.offCourseCount, 1);
  assert.equal(events.filter(event => event.type === 'offCourse').length, 1);
  assert.ok(turnAt(race.distance, race.courseId).shoulder);
  const stoppedAt = race.distance, beforeFriends = race.buddies.map(buddy => buddy.distance);
  const prizes = { stars: race.stars, smashes: race.smashes, crushes: race.crushes, pads: race.usedTurboPads.slice() };
  const validTow = structuredClone(race);
  for (const dt of [0, NaN, Infinity, -.1]) {
    assert.deepEqual(stepRace(race, dt, { jump: true, turbo: true }), []);
    assert.deepEqual(race, validTow);
  }
  race.phase = 'paused';
  const paused = structuredClone(race);
  assert.deepEqual(stepRace(race, .05, { jump: true, transform: true, turbo: true }), []);
  assert.deepEqual(race, paused);
  race.phase = 'running';
  for (let frame = 0; frame < 600 && race.recovery; frame++) {
    events.push(...stepRace(race, 1 / 60, { jump: true, transform: true, turbo: true, steer: 1 }));
    assert.equal(race.distance, stoppedAt);
    assert.equal(race.height, 0);
    assert.equal(race.flight, null);
  }
  assert.equal(race.recovery, null);
  assert.equal(race.lane, 0);
  assert.equal(race.targetLane, 0);
  assert.ok(race.buddies.some((buddy, index) => buddy.distance > beforeFriends[index] + 20));
  assert.deepEqual({ stars: race.stars, smashes: race.smashes, crushes: race.crushes, pads: race.usedTurboPads }, prizes);
  assert.equal(events.filter(event => event.type === 'recovered').length, 1);
  const held = stepRace(race, 1 / 60, { jump: true, transform: true, turbo: true });
  assert.ok(held.every(event => !['jump', 'flight', 'transform', 'turbo'].includes(event.type)), 'Tow does not reactivate held actions');
  assert.ok(race.distance > stoppedAt);
  stepRace(race, 1 / 60);
  assert.ok(stepRace(race, 1 / 60, { transform: true }).some(event => event.type === 'transform'));
});

test('a partially off-road driver stops before closing rails and cannot fly out of the shoulder', () => {
  const race = { ...createRace(3, 'woods', 'race'), phase: 'running', truckScale: 1.5 };
  let attemptedFlight = false;
  for (let frame = 0; frame < 1800 && !race.recovery; frame++) {
    const outside = Math.abs(race.lane) > 1.25;
    if (outside) attemptedFlight = true;
    const inputs = { steer: Math.max(-1, Math.min(1, (1.6 - race.targetLane) * 5 +
      turnAt(race.distance, 'woods').steer * RACE_TURN_DRIFT / 2.4)), transform: outside, jump: outside };
    stepRace(race, frame % 2 ? .05 : 1 / 60, inputs);
    if (outside) assert.equal(race.flight, null, 'Robot rockets wait for an on-road launch');
  }
  assert.ok(attemptedFlight && race.recovery);
  assert.ok(race.recovery.fromLane > 1 && race.recovery.fromLane < 2.4, 'Recovery covers a partial departure, not only the outer trigger');
  assert.ok(race.distance <= 136 && race.distance >= 132, 'The complete body stops before the shoulder opening closes');
  assert.equal(race.offCourseCount, 1);
});
