import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSES, DEFAULT_COURSE_ID, getCourse, courseProgress } from '../src/courses.mjs';
import { createRace, createProgress, awardRace, selectTruck, stepRace, TRUCKS } from '../src/core.mjs';
import { CRUSH_CARS, SMASH_TARGETS, getCrushCars, getSmashTargets } from '../src/encounters.mjs';

test('five immutable courses share explicit bounds and four safe canyon launch corridors', () => {
  assert.equal(DEFAULT_COURSE_ID, 'skyway');
  assert.deepEqual(COURSES.map(({ id, start, end }) => [id, start, end]), [
    ['skyway', 0, 1900], ['woods', 0, 550], ['loop', 565, 1140], ['bay', 1160, 1900], ['canyon', 0, 1900],
  ]);
  assert.equal(getCourse('missing'), getCourse('skyway'));
  assert.ok(Object.isFrozen(COURSES));
  for (const course of COURSES) {
    assert.ok(Object.isFrozen(course) && Object.isFrozen(course.gaps));
    assert.ok(course.start < course.end);
    for (const gap of course.gaps) {
      assert.ok(Object.isFrozen(gap));
      assert.equal(gap.launch, gap.start - 18);
      assert.equal(gap.land, gap.end + 18);
      assert.ok(gap.height >= 16 && gap.height <= 22);
    }
  }
  assert.deepEqual(getCourse('canyon').gaps.map(gap => [gap.start, gap.end]), [[210, 280], [460, 535], [1250, 1335], [1570, 1665]]);
});

test('course selection survives v1 normalization, truck choice and race rewards', () => {
  const old = { version: 1, stars: 123, selected: 'mega-titan', races: 7, muted: true, reducedMotion: true };
  assert.deepEqual(createProgress(old), { ...old, courseId: 'skyway' });
  for (const course of COURSES) {
    const progress = createProgress({ ...old, courseId: course.id });
    assert.equal(progress.courseId, course.id);
    assert.equal(awardRace(progress, 5).courseId, course.id);
    assert.equal(selectTruck(progress, 'rumbler').courseId, course.id);
    assert.deepEqual(createProgress(JSON.parse(JSON.stringify(progress))), progress);
  }
  assert.equal(createProgress({ ...old, courseId: 'bad' }).courseId, 'skyway');
});

test('race starts and progress use the selected window and fresh independent state', () => {
  for (const course of COURSES) {
    const race = createRace(3, course.id);
    assert.equal(race.courseId, course.id);
    assert.equal(race.courseStart, course.start);
    assert.equal(race.courseEnd, course.end);
    assert.equal(race.distance, course.start);
    assert.deepEqual(race.buddies.map(buddy => buddy.distance), race.buddies.map(buddy => course.start - buddy.gap));
    assert.equal(courseProgress(race), 0);
    race.distance = (course.start + course.end) / 2;
    assert.equal(courseProgress(race), .5);
    race.distance = course.end + 40;
    assert.equal(courseProgress(race), 1);
    race.distance = NaN;
    assert.equal(courseProgress(race), 0);
    const replay = createRace(4, course.id);
    assert.equal(replay.flight, null);
    assert.equal(replay.flying, false);
    assert.equal(replay.robotMode, false);
    assert.deepEqual(replay.crossedGaps, []);
    assert.deepEqual(replay.smashedTargets, []);
  }
  assert.equal(createRace(0, 'broken').courseId, 'skyway');
});

test('smash definitions are frozen physical toys, scoped away from course edges and canyon flight paths', () => {
  assert.ok(Object.isFrozen(SMASH_TARGETS));
  assert.ok(SMASH_TARGETS.length >= 12 && SMASH_TARGETS.length <= 16);
  assert.equal(new Set([...SMASH_TARGETS, ...CRUSH_CARS].map(target => target.id)).size, SMASH_TARGETS.length + CRUSH_CARS.length);
  assert.deepEqual(new Set(SMASH_TARGETS.map(target => target.kind)), new Set(['crates', 'barrels', 'blocks']));
  for (const target of SMASH_TARGETS) {
    assert.ok(Object.isFrozen(target));
    for (const key of ['halfWidth', 'halfLength', 'height']) assert.ok(target[key] > 0 && Number.isFinite(target[key]));
    assert.ok(CRUSH_CARS.every(car => Math.abs(car.distance - target.distance) > 16));
  }
  for (const course of COURSES) for (const target of [...getSmashTargets(course.id), ...getCrushCars(course.id)]) {
    assert.ok(target.distance > course.start && target.distance < course.end);
    assert.ok(course.gaps.every(gap => target.distance < gap.launch - 8 || target.distance > gap.land + 8));
  }
});

test('every truck and course finishes first without input and has only its own loops and crossings', () => {
  for (const course of COURSES) for (const truck of TRUCKS) for (const seed of [0, 3, 5]) {
    const race = { ...createRace(seed, course.id), phase: 'running', truckScale: truck.scale };
    const events = [];
    for (let frame = 0; frame < 5000 && !race.finished; frame++) {
      events.push(...stepRace(race, frame % 3 === 0 ? .05 : 1 / 60));
      for (const actor of [race, ...race.buddies]) {
        assert.ok(Number.isFinite(actor.height) && actor.height >= 0);
        for (const gap of course.gaps) if (actor.distance >= gap.start && actor.distance <= gap.end) {
          assert.ok(actor.height > 4, `${course.id} ${truck.id} ${actor.id ?? 'player'} clears ${gap.id}`);
        }
      }
    }
    assert.ok(race.finished, `${course.id} ${truck.id} finishes`);
    assert.equal(race.distance, course.end);
    assert.ok(race.buddies.every(buddy => buddy.distance < race.distance), 'All four friends yield before this finish');
    assert.equal(race.loops, course.start < 1000 && course.end >= 1000 ? 1 : 0);
    assert.equal(race.canyonCrossings, course.gaps.length);
    assert.equal(events.filter(event => event.type === 'finish').length, 1);
    assert.equal(race.flying, false);
    assert.equal(race.flight, null);
    assert.ok(race.smashedTargets.every(id => getSmashTargets(course.id).some(target => target.id === id)));
    assert.ok(race.crushedCars.every(id => getCrushCars(course.id).some(target => target.id === id)));
    assert.deepEqual(JSON.parse(JSON.stringify(race)), race);
  }
});

test('short-course controls cannot skip the finish or leave friends ahead during late transformations', () => {
  for (const courseId of ['woods', 'loop', 'bay']) for (const truck of TRUCKS) for (const held of [false, true]) {
    const race = { ...createRace(4, courseId), phase: 'running', truckScale: truck.scale };
    for (let frame = 0; frame < 2500 && !race.finished; frame++) {
      stepRace(race, frame % 2 ? 1 / 60 : .2, {
        jump: held || frame % 11 === 0,
        turbo: held || frame % 13 === 0,
        transform: held || frame % 17 === 0,
        steer: held ? 1 : frame % 80 < 40 ? -1 : 1,
      });
      for (const buddy of race.buddies) {
        const lateral = Math.abs(race.lane - buddy.lane) * 3.4;
        const longitudinal = Math.abs(race.distance - buddy.distance);
        assert.ok(lateral >= 3.2 * truck.scale + 2.25 * buddy.scale || longitudinal >= 2.8 * (truck.scale + buddy.scale),
          `${courseId} ${truck.id} safely changes form alongside ${buddy.id}`);
      }
    }
    assert.ok(race.finished);
    assert.equal(race.distance, getCourse(courseId).end);
    assert.ok(race.buddies.every(buddy => buddy.distance < race.distance));
    assert.equal(race.flying, false);
  }
});
