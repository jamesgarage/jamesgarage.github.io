import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS, RACE_SPEED, TRUCKS } from '../src/core.mjs';
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

test('full-course positions are deterministic, behind, separated and independent of player actions', () => {
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
