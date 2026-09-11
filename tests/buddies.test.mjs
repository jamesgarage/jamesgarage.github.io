import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS, RACE_SPEED, TRUCKS, createRace, stepRace } from '../src/core.mjs';
import { sampleRaceBuddies, racePlace, RaceBuddies } from '../src/buddies.mjs';
import { makeTruck, disposeTruck } from '../src/models.mjs';
import { sampleTrack, laneOffset } from '../src/track.mjs';

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
}

function resources(truck) {
  const owned = new Set();
  truck.group.traverse(object => {
    if (!object.isMesh) return;
    owned.add(object.geometry);
    for (const material of [].concat(object.material)) owned.add(material);
  });
  return owned;
}

function matrices(field) {
  return field.trucks.map(truck => {
    truck.group.updateMatrixWorld(true);
    const result = [];
    truck.group.traverse(object => result.push(...object.matrixWorld.elements));
    return result;
  });
}

test('distance-only previews remain deterministic, behind, separated and independent of player actions', () => {
  for (let distance = 0; distance <= COURSE_LENGTH; distance += .5) {
    const race = Object.freeze({ distance, lane: Math.sin(distance), height: 99, transformTime: 9, stars: 17 });
    const poses = sampleRaceBuddies(race);
    assert.equal(poses.length, 2);
    assert.equal(new Set(poses.map(pose => pose.id)).size, 2);
    assert.ok(distance - poses[0].distance >= 10, 'Leave room behind the largest truck');
    assert.ok(poses[0].distance - poses[1].distance >= 4);
    assert.equal(racePlace(race), 1);
    assert.deepEqual(poses, sampleRaceBuddies({ distance }));
    for (const pose of poses) {
      for (const key of ['distance', 'lane', 'height', 'velocityY']) assert.ok(Number.isFinite(pose[key]));
      assert.ok(Math.abs(pose.lane) < 1);
      assert.ok(pose.height >= 0 && pose.height <= 16 ** 2 / 48);
    }
  }
});

test('stateful sampling copies real poses and place reflects actual overtakes', () => {
  const race = { ...createRace(), phase: 'running', distance: 110 };
  race.buddies[0].distance = 113;
  race.buddies[0].lane = -1.65;
  race.buddies[0].height = 3;
  race.buddies[0].velocityY = -4;
  race.buddies[1].distance = 108;
  assert.equal(racePlace(race), 2);
  const poses = sampleRaceBuddies(race);
  assert.deepEqual(poses, race.buddies);
  assert.notEqual(poses, race.buddies);
  poses[0].distance = 0;
  poses[1].height = 99;
  assert.equal(race.buddies[0].distance, 113);
  assert.equal(race.buddies[1].height, 0);
  race.buddies[1].distance = 112;
  assert.equal(racePlace(race), 3);
  race.distance = 114;
  assert.equal(racePlace(race), 1);
});

test('stateful buddies take every ramp using elapsed gravity during changing speeds', () => {
  const race = { ...createRace(), phase: 'running' };
  const crossed = race.buddies.map(() => []), observedSpeeds = race.buddies.map(() => new Set());
  let airborneChecks = 0, outsidePassChecks = 0;
  for (let frame = 0; frame < 5000 && !race.finished; frame++) {
    const before = sampleRaceBuddies(race);
    stepRace(race, 1 / 60);
    for (const [index, buddy] of race.buddies.entries()) {
      const earlier = before[index];
      const ramp = RAMPS.find(distance => earlier.distance < distance && buddy.distance >= distance);
      observedSpeeds[index].add(Math.round((buddy.distance - earlier.distance) * 60 * 10));
      if (ramp) {
        crossed[index].push(ramp);
        assert.ok(buddy.height > 0 && buddy.velocityY > 15);
      } else if (earlier.height > 0 && buddy.height > 0) {
        close(buddy.velocityY, earlier.velocityY - 24 / 60);
        airborneChecks++;
      }
      if (buddy.distance >= LOOP_START && buddy.distance < LOOP_END) {
        assert.equal(buddy.height, 0);
        assert.equal(buddy.velocityY, 0);
      }
      const speed = (buddy.distance - earlier.distance) * 60;
      assert.ok(speed >= 22.5 - 1e-8 && speed <= 30.5 + 1e-8);
      if (Math.abs(race.distance - buddy.distance) < 5) {
        assert.ok(Math.abs(buddy.lane) > 1.6, 'Choose an outside lane before drawing alongside');
        assert.ok(Math.abs(laneOffset(buddy.lane)) + 1.1 < 8, 'Small opponent fits inside the rail');
        outsidePassChecks++;
      }
    }
  }
  for (const ramps of crossed) assert.deepEqual(ramps, RAMPS);
  assert.ok(observedSpeeds.every(speeds => speeds.size > 10), 'Independent pace changes instead of a fixed offset');
  assert.ok(airborneChecks > 100 && outsidePassChecks > 20);
});

test('the rendered field uses simulated poses without changing them', () => {
  const scene = new THREE.Scene(), field = new RaceBuddies(scene);
  const race = { ...createRace(), phase: 'running' };
  try {
    for (let frame = 0; frame < 300; frame++) {
      stepRace(race, 1 / 60);
      field.update(1 / 60, race);
    }
    assert.deepEqual(field.poses, race.buddies);
    assert.ok(field.poses[0].distance > race.distance, 'Sunny really passed the slowing player');
    const frozen = structuredClone(race);
    field.update(.05, race);
    assert.deepEqual(race, frozen);
    field.poses[0].distance += 20;
    assert.deepEqual(race, frozen, 'Renderer cannot mutate the simulation through sampled poses');
  } finally { field.dispose(); }
});

test('late steering yields safely, preserves steering intent and resumes once a pass clears', () => {
  for (const spec of TRUCKS) for (const steer of [-1, 1]) for (const triggerGap of [7.9, 2, -.1]) {
    const race = { ...createRace(), phase: 'running', truckScale: spec.scale };
    let steering = false, guarded = false, resumed = false;
    for (let frame = 0; frame < 650; frame++) {
      if (race.crushes && race.distance - race.buddies[0].distance < triggerGap) steering = true;
      const previous = structuredClone(race);
      stepRace(race, 1 / 60, { steer: steering ? steer : 0 });
      if (steering && Math.abs(race.targetLane) > .95 && Math.abs(race.lane) < .9) guarded = true;
      if (steering && Math.abs(race.lane) > .99) resumed = true;
      for (const [index, buddy] of race.buddies.entries()) {
        const lateral = Math.abs(race.lane - buddy.lane) * 3.4;
        const longitudinal = Math.abs(race.distance - buddy.distance);
        assert.ok(lateral >= 2.5 * spec.scale + 1.125 || longitudinal >= 2.8 * spec.scale + 1.4,
          `${spec.id} steer ${steer} trigger ${triggerGap}: truck overlaps ${buddy.id} at ${race.elapsed.toFixed(3)}`);
        assert.ok(buddy.distance >= previous.buddies[index].distance, 'Yielding never teleports a buddy backward');
        assert.ok(buddy.distance - previous.buddies[index].distance <= 30.5 / 60 + 1e-8, 'No emergency forward teleport');
      }
      assert.ok(race.buddies[0].distance - race.buddies[1].distance >= 4 - 1e-8, 'Yielding buddies preserve their own spacing');
      if (steering) assert.equal(Math.sign(race.targetLane), steer, 'Assistance preserves the requested direction');
    }
    assert.ok(steering && resumed, `${spec.id}: steering resumes after the temporary pass clears`);
    if (steer < 0 && triggerGap < 1) assert.ok(guarded, 'A merge begun alongside uses gentle spacing assistance');
  }
});

test('actual normal and guardian tires never intersect during a late merge', () => {
  let closeFrames = 0;
  for (const spec of TRUCKS) for (const guardian of [false, true]) for (const steer of [-1, 1]) {
    const player = makeTruck(spec), field = new RaceBuddies(new THREE.Scene());
    const race = { ...createRace(), phase: 'running', truckScale: spec.scale, transformTime: guardian ? 9 : 0 };
    let steering = false, transform = 0, lean = 0;
    try {
      for (let frame = 0; frame < 650; frame++) {
        if (race.crushes && race.distance - race.buddies[0].distance < (guardian ? 10 : 2)) steering = true;
        stepRace(race, 1 / 60, { steer: steering ? steer : 0 });
        // Match scene articulation, including the tire yaw that broadens the
        // footprint when actual lane is briefly held clear of an opponent.
        transform += ((race.transformTime > 0 ? 1 : 0) - transform) * (1 - Math.exp(-5 / 60));
        lean += (-(race.targetLane - race.lane) * .16 - lean) * (1 - Math.exp(-7 / 60));
        const road = sampleTrack(race.distance);
        player.group.position.copy(road.position).addScaledVector(road.right, laneOffset(race.lane)).addScaledVector(road.up, race.height);
        player.group.quaternion.copy(road.quaternion);
        if (race.height > 0) player.group.rotateX(Math.max(-.28, Math.min(.35, -race.velocityY * .025)));
        player.wheels.forEach((wheel, index) => {
          wheel.position.x = (index % 2 === 0 ? -1 : 1) * (1.65 + transform * .7);
          wheel.rotation.order = 'YXZ'; wheel.rotation.y = index > 1 ? lean * 1.4 : 0;
          wheel.rotation.x += 19 / 60 * race.speed / RACE_SPEED;
        });
        player.group.updateMatrixWorld(true);
        field.update(1 / 60, race);
        for (const [index, buddy] of race.buddies.entries()) {
          if (Math.abs(race.distance - buddy.distance) > 9) continue;
          closeFrames++;
          const otherWheels = field.trucks[index].wheels.map(wheel => new THREE.Box3().setFromObject(wheel));
          for (const wheel of player.wheels) {
            const playerBox = new THREE.Box3().setFromObject(wheel);
            assert.ok(otherWheels.every(box => !box.intersectsBox(playerBox)),
              `${spec.id} ${guardian ? 'guardian' : 'normal'} steer ${steer}: actual tires intersect at ${race.elapsed.toFixed(3)}`);
          }
        }
      }
      assert.ok(steering && Math.abs(race.lane) > .99, 'Late steering remains possible after clearance');
    } finally { disposeTruck(player); field.dispose(); }
  }
  assert.ok(closeFrames > 1000, 'The check exercises actual close passes and waiting beside the player');
});

test('each buddy takes all six automatic jumps with ascending, apex, descending and landed poses', () => {
  const initial = sampleRaceBuddies({ distance: 0 });
  for (const [i, buddy] of initial.entries()) for (const ramp of RAMPS) {
    const at = time => sampleRaceBuddies({ distance: ramp - buddy.distance + time * RACE_SPEED })[i];
    assert.equal(at(-.01).height, 0);
    assert.ok(at(.2).height > 0 && at(.2).velocityY > 0);
    close(at(2 / 3).height, 16 ** 2 / 48);
    close(at(2 / 3).velocityY, 0);
    assert.ok(at(1).height > 0 && at(1).velocityY < 0);
    assert.equal(at(1.34).height, 0);
    assert.equal(at(1.34).velocityY, 0);
  }
});

test('invalid progress and extreme finite inputs yield a safe finite grid or finish pose', () => {
  for (const race of [undefined, null, {}, { distance: NaN }, { distance: Infinity }, { distance: -Infinity }, { distance: '500' }, { distance: -1e308 }, { distance: 1e308 }]) {
    assert.equal(racePlace(race), 1);
    for (const pose of sampleRaceBuddies(race)) {
      assert.ok(pose.distance >= -14 && pose.distance < COURSE_LENGTH);
      assert.ok(Object.values(pose).filter(value => typeof value === 'number').every(Number.isFinite));
    }
  }
});

test('reused detailed trucks follow the real road frame through every point of the loop', () => {
  const scene = new THREE.Scene(), field = new RaceBuddies(scene);
  try {
    assert.equal(scene.children.length, 2);
    for (const truck of field.trucks) {
      assert.ok(truck.spec.scale >= .45 && truck.spec.scale <= .55);
      assert.ok(truck.body.getObjectByName(`character-${truck.spec.id}`).children.length > 0);
    }
    assert.notEqual(field.trucks[0].spec.color, field.trucks[1].spec.color);
    for (let distance = 0; distance <= COURSE_LENGTH; distance += 2) {
      field.update(1 / 60, { distance, phase: 'running' });
      for (const [i, pose] of field.poses.entries()) {
        const frame = sampleTrack(pose.distance), truck = field.trucks[i];
        const expected = frame.position.clone().addScaledVector(frame.right, laneOffset(pose.lane)).addScaledVector(frame.up, pose.height);
        close(truck.group.position.distanceTo(expected), 0);
        assert.ok(truck.group.matrixWorld.elements.every(Number.isFinite));
        if (pose.distance >= LOOP_START && pose.distance <= LOOP_END) {
          assert.equal(pose.height, 0);
          assert.equal(pose.velocityY, 0);
          close(truck.group.quaternion.angleTo(frame.quaternion), 0, 1e-7);
        }
      }
    }
    const gap = -sampleRaceBuddies({ distance: 0 })[0].distance;
    field.update(.016, { distance: (LOOP_START + LOOP_END) / 2 + gap });
    assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(field.trucks[0].group.quaternion).y < -.99, 'Buddy is upside down at the loop crown');
  } finally { field.dispose(); }
});

test('pause freezes every transform and wheel; reset clears old motion and keeps the same models', () => {
  const scene = new THREE.Scene(), field = new RaceBuddies(scene);
  try {
    const trucks = [...field.trucks];
    const start = matrices(field);
    field.update(.016, { distance: 193, phase: 'running' });
    const moving = matrices(field), poses = structuredClone(field.poses);
    assert.notDeepEqual(moving, start);
    for (const dt of [0, NaN, Infinity, -1]) {
      field.update(dt, { distance: 1200, phase: 'running' });
      assert.deepEqual(matrices(field), moving);
      assert.deepEqual(field.poses, poses);
    }
    field.update(.016, { distance: 1200, phase: 'paused' });
    assert.deepEqual(matrices(field), moving);
    field.update(0, { distance: 0 }, false);
    assert.ok(field.trucks.every(truck => !truck.group.visible));
    assert.deepEqual(matrices(field), moving);
    field.reset();
    assert.deepEqual(matrices(field), start);
    assert.deepEqual(field.trucks, trucks);
    assert.deepEqual(field.poses, sampleRaceBuddies({ distance: 0 }));
    field.update(.016, { distance: 0 });
    assert.ok(field.trucks.every(truck => truck.wheels.every(wheel => wheel.rotation.x === 0)));
    field.update(.016, { distance: 1e308 });
    assert.ok(matrices(field).flat().every(Number.isFinite));
  } finally { field.dispose(); }
});

test('field resources stay bounded and dispose once without releasing player or borrowed resources', () => {
  const scene = new THREE.Scene(), player = makeTruck(TRUCKS.at(-1)), field = new RaceBuddies(scene);
  scene.add(player.group);
  const counts = new Map();
  for (const truck of field.trucks) for (const resource of resources(truck)) {
    assert.ok(!counts.has(resource), 'Buddies own distinct resources');
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  let outsideDisposals = 0;
  for (const resource of resources(player)) resource.addEventListener('dispose', () => outsideDisposals++);
  const borrowed = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  for (const resource of [borrowed.geometry, borrowed.material]) resource.addEventListener('dispose', () => outsideDisposals++);
  field.trucks[0].group.add(borrowed);
  const original = field.trucks.map(resources);
  for (let lap = 0; lap < 5; lap++) {
    field.reset();
    for (let distance = 0; distance <= COURSE_LENGTH; distance += 25) field.update(.016, { distance });
    field.trucks.forEach((truck, i) => assert.deepEqual(resources(truck), original[i]));
    assert.equal(scene.children.length, 3);
  }
  field.dispose(); field.dispose(); field.reset(); field.update(.016, { distance: 400 });
  assert.ok([...counts.values()].every(count => count === 1));
  assert.deepEqual(scene.children, [player.group]);
  assert.equal(outsideDisposals, 0);
  disposeTruck(player); borrowed.geometry.dispose(); borrowed.material.dispose();
});
