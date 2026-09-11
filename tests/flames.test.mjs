import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ExhaustFlames } from '../src/flames.mjs';
import { GameScene, makeTruck } from '../src/scene.mjs';
import { TRUCKS } from '../src/core.mjs';
import { RaceBuddies } from '../src/buddies.mjs';
import { WorldLife } from '../src/world-life.mjs';
import { RaceWeather } from '../src/weather.mjs';
import { RoadEncounters } from '../src/encounter-scene.mjs';

function rig(spec = TRUCKS[0]) {
  const scene = new THREE.Scene();
  const truck = makeTruck(spec);
  scene.add(truck.group);
  return { scene, truck, flames: new ExhaustFlames(scene) };
}

function update(target, dt, time, overrides = {}) {
  target.flames.update(dt, {
    truck: target.truck, time, mode: 'race',
    race: { phase: 'running', height: 0 }, transform: 0, reducedMotion: false,
    ...overrides,
  });
}

function fillTrail(target) {
  for (let frame = 0; frame < 30; frame++) update(target, 1 / 60, frame / 60);
  assert.ok(target.flames.particles.some(particle => particle.life > 0));
}

function visibleMatrices(flames) {
  return Array.from(flames.mesh.instanceMatrix.array.slice(0, flames.mesh.count * 16));
}

function firstMatrix(flames) {
  const matrix = new THREE.Matrix4();
  flames.mesh.getMatrixAt(0, matrix);
  return matrix;
}

function approximately(actual, expected, tolerance = 0.00001) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should be close to ${expected}`);
}

test('paused rendering preserves exhaust and every emitted trail instance', () => {
  const target = rig();
  fillTrail(target);
  const time = 29 / 60;
  const before = visibleMatrices(target.flames);
  const emission = target.flames.emission;
  const lives = target.flames.particles.map(particle => particle.life);
  // GameScene receives zero visual time while the race is paused.
  for (let frame = 0; frame < 60; frame++) {
    update(target, 0, time, { race: { phase: 'paused', height: 0 } });
    assert.deepEqual(visibleMatrices(target.flames), before);
  }
  assert.deepEqual(target.flames.particles.map(particle => particle.life), lives);
  assert.equal(target.flames.emission, emission);

  update(target, 1 / 60, time + 1 / 60);
  assert.notDeepEqual(visibleMatrices(target.flames), before, 'resuming should animate the exhaust again');
});

test('reduced motion removes existing trails and keeps stationary exhaust steady over time', () => {
  const target = rig();
  fillTrail(target);
  const movingCount = target.flames.mesh.count;
  update(target, 1 / 60, 1, { reducedMotion: true });
  assert.ok(target.flames.mesh.visible);
  assert.ok(target.flames.mesh.count > 0 && target.flames.mesh.count < movingCount);
  assert.ok(target.flames.particles.every(particle => particle.life === 0));
  const steady = visibleMatrices(target.flames);

  for (const time of [2, 10, 100]) {
    update(target, 0.08, time, { reducedMotion: true, transform: 1 });
    assert.deepEqual(visibleMatrices(target.flames), steady);
    assert.ok(target.flames.particles.every(particle => particle.life === 0));
  }
});

test('sustained driving keeps flame storage and scene resources bounded', () => {
  const target = rig();
  const { flames } = target;
  const pool = flames.particles;
  const members = pool.slice();
  const matrixBuffer = flames.mesh.instanceMatrix.array;
  const geometry = flames.mesh.geometry;
  const material = flames.mesh.material;
  const sceneObjects = target.scene.children.slice();
  let time = 0;
  for (let frame = 0; frame < 3600; frame++) {
    const dt = [1 / 60, 1 / 30, 0.08][frame % 3];
    time += dt;
    target.truck.group.position.z += 26 * dt;
    update(target, dt, time, { transform: frame % 300 < 150 ? 1 : 0 });
    assert.ok(flames.mesh.count <= flames.mesh.instanceMatrix.count);
    if (frame % 120 === 0) assert.ok(visibleMatrices(flames).every(Number.isFinite));
  }
  assert.equal(flames.particles, pool);
  assert.equal(flames.particles.length, members.length);
  flames.particles.forEach((particle, index) => assert.equal(particle, members[index]));
  assert.equal(flames.mesh.instanceMatrix.array, matrixBuffer);
  assert.equal(flames.mesh.geometry, geometry);
  assert.equal(flames.mesh.material, material);
  assert.deepEqual(target.scene.children, sceneObjects);
});

test('scene reset, menu, and truck replacement clear old flames before teleporting', () => {
  const target = rig();
  // Exercise the real lifecycle methods without constructing a WebGL renderer.
  Object.setPrototypeOf(target, GameScene.prototype);
  Object.assign(target, { stars: [], particles: [], mode: 'race', buddies: new RaceBuddies(target.scene), weather: new RaceWeather(target.scene), encounters: new RoadEncounters(target.scene), life: new WorldLife(target.scene) });
  const actions = [() => target.reset(), () => target.menu(), () => target.setTruck(TRUCKS.at(-1))];
  for (const [index, action] of actions.entries()) {
    fillTrail(target);
    action();
    assert.equal(target.flames.mesh.count, 0);
    assert.equal(target.flames.mesh.visible, false);
    assert.ok(target.flames.particles.every(particle => particle.life === 0));

    const destination = (index + 1) * 1000;
    target.truck.group.position.set(destination, 0, 0);
    update(target, 0, 2, { mode: 'menu', race: { phase: 'ready', height: 0 } });
    const matrices = visibleMatrices(target.flames);
    assert.ok(matrices.length > 0);
    for (let offset = 0; offset < matrices.length; offset += 16) {
      assert.ok(Math.abs(matrices[offset + 12] - destination) < 10, 'only the new truck should have visible flames');
    }
  }
  target.buddies.dispose();target.weather.dispose();target.encounters.dispose();target.life.dispose();
});

test('exhaust follows larger trucks, guardian body lift, and loop inversion', () => {
  const small = rig();
  const large = rig(TRUCKS.at(-1));
  update(small, 0, 0);
  update(large, 0, 0);
  const smallScale = new THREE.Vector3().setFromMatrixScale(firstMatrix(small.flames));
  const largeScale = new THREE.Vector3().setFromMatrixScale(firstMatrix(large.flames));
  const ratio = large.truck.spec.scale / small.truck.spec.scale;
  approximately(largeScale.x / smallScale.x, ratio);
  approximately(largeScale.z / smallScale.z, ratio);

  const before = firstMatrix(large.flames);
  const beforePosition = new THREE.Vector3().setFromMatrixPosition(before);
  large.truck.body.position.y = 1.8;
  update(large, 0, 0, { transform: 1 });
  const lifted = firstMatrix(large.flames);
  const liftedPosition = new THREE.Vector3().setFromMatrixPosition(lifted);
  approximately(liftedPosition.y - beforePosition.y, 1.8 * large.truck.spec.scale);
  assert.ok(new THREE.Vector3().setFromMatrixScale(lifted).z > largeScale.z);

  const uprightDirection = new THREE.Vector3(0, 0, -1).transformDirection(lifted);
  large.truck.group.rotation.x = Math.PI;
  update(large, 0, 0, { transform: 1 });
  const inverted = firstMatrix(large.flames);
  const invertedPosition = new THREE.Vector3().setFromMatrixPosition(inverted);
  const invertedDirection = new THREE.Vector3(0, 0, -1).transformDirection(inverted);
  approximately(invertedPosition.y, -liftedPosition.y);
  approximately(invertedDirection.dot(uprightDirection), -1);
});

test('turbo extends the actual exhaust and stays frozen while paused', () => {
  const target = rig();
  update(target, 1 / 60, 1);
  const normal = new THREE.Vector3().setFromMatrixScale(firstMatrix(target.flames)).z;
  update(target, 1 / 60, 1, { race: { phase: 'running', height: 0, turboTime: 2, speed: 40 } });
  const turbo = new THREE.Vector3().setFromMatrixScale(firstMatrix(target.flames)).z;
  assert.ok(turbo > normal * 1.5, 'turbo must visibly extend the exhaust');
  const paused = visibleMatrices(target.flames);
  for (let frame = 0; frame < 30; frame++) update(target, 0, 1, { race: { phase: 'paused', height: 0, turboTime: 2, speed: 40 } });
  assert.deepEqual(visibleMatrices(target.flames), paused);
  update(target, 0, 1, { reducedMotion: true, race: { phase: 'paused', height: 0, turboTime: 2 } });
  assert.equal(target.flames.mesh.count, 2);
});

test('pause freezes shader time, instance metadata, emitters and particles even with advancing caller time', () => {
  const target = rig();
  fillTrail(target);
  const { flames } = target;
  const snapshot = () => ({
    matrices: visibleMatrices(flames), data: Array.from(flames.flameData.array),
    time: flames.mesh.material.uniforms.time.value,
    matrixVersion: flames.mesh.instanceMatrix.version, dataVersion: flames.flameData.version,
    particles: flames.particles.map(p => ({ life: p.life, position: p.position.toArray(), velocity: p.velocity.toArray(), quaternion: p.quaternion.toArray() })),
    previous: flames.previous.map(p => p.toArray()), cursor: flames.cursor, emission: flames.emission,
  });
  const before = snapshot();
  for (let frame = 0; frame < 30; frame++) update(target, .08, frame + 2, { race: { phase: 'paused', height: 1, turboTime: 2 }, transform: 1 });
  assert.deepEqual(snapshot(), before);
  update(target, .08, 40, { reducedMotion: true, race: { phase: 'paused' } });
  assert.equal(flames.mesh.count, 2);
  assert.equal(flames.mesh.material.uniforms.time.value, 0);
  const steady = snapshot();
  update(target, .08, 50, { reducedMotion: true, race: { phase: 'paused' } });
  assert.deepEqual(snapshot(), steady);
});

test('exhaust direction follows articulated body rotation and existing wake stays in world space', () => {
  const target = rig();
  fillTrail(target);
  const particle = target.flames.particles.find(p => p.life > .05);
  const before = particle.position.clone();
  target.truck.group.position.set(100, 30, 80);
  target.truck.group.rotation.set(.3, 1.2, Math.PI);
  target.truck.body.rotation.set(.1, .15, .2);
  update(target, 0, 2);
  assert.deepEqual(particle.position.toArray(), before.toArray());
  const orientation = target.truck.body.getWorldQuaternion(new THREE.Quaternion());
  orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .12));
  const expected = new THREE.Vector3(0, 0, -1).applyQuaternion(orientation);
  const actual = new THREE.Vector3(0, 0, -1).transformDirection(firstMatrix(target.flames));
  approximately(expected.dot(actual), 1);
  const expectedOutlet = new THREE.Vector3(-1.05, 3.09, -2.16).applyMatrix4(target.truck.body.matrixWorld);
  assert.ok(expectedOutlet.distanceTo(new THREE.Vector3().setFromMatrixPosition(firstMatrix(target.flames))) < .00001);
});

test('one translucent instanced volume draw owns and disposes every GPU resource exactly once', () => {
  const target = rig();
  const { flames } = target;
  const disposed = { geometry: 0, material: 0, instances: 0 };
  flames.mesh.geometry.addEventListener('dispose', () => disposed.geometry++);
  flames.mesh.material.addEventListener('dispose', () => disposed.material++);
  flames.mesh.addEventListener('dispose', () => disposed.instances++);
  assert.equal(flames.mesh.material.transparent, true);
  assert.equal(flames.mesh.material.depthWrite, false);
  assert.equal(flames.mesh.geometry.index.count / 3, 12);
  assert.equal(flames.mesh.instanceMatrix.count, 66);
  fillTrail(target);
  const data = flames.flameData;
  for (let i = 0; i < 120; i++) update(target, .1, i, { transform: 1, race: { phase: 'running', turboTime: 2, speed: 40 } });
  assert.equal(flames.flameData, data);
  assert.ok(Array.from(data.array).every(Number.isFinite));
  assert.ok(flames.mesh.count <= 66);
  flames.dispose();
  flames.dispose();
  update(target, .1, 100);
  assert.deepEqual(disposed, { geometry: 1, material: 1, instances: 1 });
  assert.equal(flames.mesh.parent, null);
  assert.equal(flames.mesh.visible, false);
  assert.equal(flames.mesh.count, 0);
  assert.ok(flames.particles.every(p => p.life === 0));
});

test('crush-speed exhaust grows modestly while turbo and guardian remain stronger', () => {
  const target = rig();
  const lengthAt = (speed, turboTime = 0, transform = 0) => {
    update(target, 0, 1, { race: { phase: 'running', speed, turboTime }, transform });
    return new THREE.Vector3().setFromMatrixScale(firstMatrix(target.flames)).z;
  };
  const cruise = lengthAt(26), crush = lengthAt(26 * 1.18), turbo = lengthAt(26 * 1.55, 2), guardian = lengthAt(26, 0, 1);
  assert.ok(crush > cruise && crush < cruise * 1.1);
  assert.ok(turbo > crush * 1.5);
  assert.ok(guardian > crush * 1.5);
});
