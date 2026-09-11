import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ExhaustFlames } from '../src/flames.mjs';
import { GameScene, makeTruck } from '../src/scene.mjs';
import { TRUCKS } from '../src/core.mjs';

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
  Object.assign(target, { stars: [], particles: [], mode: 'race' });
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
