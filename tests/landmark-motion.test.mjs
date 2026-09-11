import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LandmarkMotion } from '../src/landmark-motion.mjs';
import { createAdventureScenery } from '../src/adventure.mjs';
import { createRaceFestival } from '../src/festival.mjs';
import { sampleTrack } from '../src/track.mjs';

const running = Object.freeze({ race: Object.freeze({ phase: 'running', distance: 330 }), mode: 'race' });

function setup() {
  const roots = [createAdventureScenery(), createRaceFestival()];
  const targets = roots.flatMap(root => root.userData.motionTargets);
  const motion = new LandmarkMotion(targets), resources = new Set();
  roots.forEach(root => root.traverse(mesh => {
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry); resources.add(mesh.material);
    if (mesh.material.map) resources.add(mesh.material.map);
  }));
  return { roots, targets, motion, resources,
    dispose() { motion.dispose(); resources.forEach(resource => resource.dispose()); } };
}

function state(fixture) {
  const snapshot = [];
  fixture.roots.forEach(root => root.traverse(object => {
    snapshot.push({ position: object.position.toArray(), quaternion: object.quaternion.toArray(),
      scale: object.scale.toArray(), visible: object.visible,
      attributes: object.isMesh ? Object.values(object.geometry.attributes).map(attribute =>
        ({ version: attribute.version, data: Array.from(attribute.array) })) : [] });
  }));
  return snapshot;
}

test('only two explicit rotors turn, keeping all stationary scenery and buffers intact', () => {
  const fixture = setup();
  try {
    const { roots, targets, motion } = fixture;
    assert.deepEqual(targets.map(target => target.id), ['bear-creek-waterwheel', 'woodland-windmill-sails']);
    roots.forEach(root => assert.ok(Object.isFrozen(root.userData.motionTargets)));
    targets.forEach(target => assert.ok(Object.isFrozen(target)));
    const rotors = new Set(targets.map(target => target.pivot)), stationary = [], buffers = [];
    roots.forEach(root => root.traverse(object => {
      if (!rotors.has(object)) stationary.push([object, object.position.clone(), object.quaternion.clone(), object.scale.clone()]);
      if (object.isMesh) for (const attribute of Object.values(object.geometry.attributes)) buffers.push([attribute, attribute.array, attribute.version]);
    }));
    for (let i = 0; i < 120; i++) motion.update(1 / 60, running);
    assert.ok(Math.abs(targets[0].pivot.rotation.z - .44) < 1e-12);
    assert.ok(Math.abs(targets[1].pivot.rotation.z - .32) < 1e-12);
    stationary.forEach(([object, position, quaternion, scale]) => {
      assert.ok(object.position.equals(position)); assert.ok(object.quaternion.equals(quaternion)); assert.ok(object.scale.equals(scale));
    });
    buffers.forEach(([attribute, array, version]) => { assert.equal(attribute.array, array); assert.equal(attribute.version, version); });
    assert.equal(targets.reduce((count, target) => count + target.pivot.children.length, 0), 5, 'rotors retain five material batches');
  } finally { fixture.dispose(); }
});

test('paused, invalid, nonrunning and gentler frames freeze transforms, clocks and GPU attributes', () => {
  const fixture = setup();
  try {
    const { motion } = fixture;
    motion.update(.1, running); const before = state(fixture), time = motion.time;
    for (const dt of [0, -1, NaN, Infinity, -Infinity]) motion.update(dt, running);
    for (const phase of ['paused', 'ready', 'finished']) motion.update(.1, { mode: 'race', race: { phase } });
    for (const mode of ['garage', 'settings', 'victory']) motion.update(.1, { mode, race: { phase: 'running' } });
    motion.update(.1); motion.update(.1, { mode: 'menu', reducedMotion: true });
    for (let i = 0; i < 120; i++) motion.update(.1, { ...running, reducedMotion: true });
    assert.equal(motion.time, time); assert.deepEqual(state(fixture), before);
    motion.update(200, { mode: 'menu' });
    assert.ok(Math.abs(motion.time - time - .1) < 1e-12, 'large dt clamps to one small step');
    assert.notDeepEqual(state(fixture), before, 'menu can show the working landmarks');
  } finally { fixture.dispose(); }
});

test('replay restores reproducible phases without rebuilding or owning the borrowed resources', () => {
  const a = setup(), b = setup();
  try {
    a.motion.reset(27); b.motion.reset(27);
    assert.deepEqual(a.motion.diagnostics, b.motion.diagnostics);
    for (let i = 0; i < 300; i++) { a.motion.update(.1, running); b.motion.update(.1, running); }
    assert.deepEqual(a.motion.diagnostics, b.motion.diagnostics);
    assert.ok(a.motion.diagnostics.angles.every(angle => angle >= 0 && angle < Math.PI * 2));
    const original = a.targets.map(target => target.pivot.children.map(mesh => mesh.geometry));
    for (let variant = 0; variant < 80; variant++) a.motion.reset(variant);
    a.targets.forEach((target, i) => target.pivot.children.forEach((mesh, j) => assert.equal(mesh.geometry, original[i][j])));
    a.motion.reset(27); b.motion.reset(27); assert.deepEqual(a.motion.diagnostics, b.motion.diagnostics);
    a.motion.reset(Infinity); assert.deepEqual(a.motion.diagnostics.angles, [0, 0]);
    assert.equal(a.motion.variant, 0); assert.equal(a.motion.time, 0);
    assert.ok(Object.isFrozen(a.motion.diagnostics)); assert.ok(Object.isFrozen(a.motion.diagnostics.angles));
    const disposals = new Map([...a.resources].map(resource => [resource, 0]));
    a.resources.forEach(resource => resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1)));
    a.motion.dispose(); a.motion.dispose(); a.motion.update(.1, running); a.motion.reset(5);
    assert.equal(a.motion.targets.length, 0); assert.ok(a.motion.disposed);
    assert.ok([...disposals.values()].every(count => count === 0), 'controller never disposes factory-owned GPU resources');
    a.targets.forEach(target => assert.ok(target.pivot.parent, 'controller leaves the factory scene graph attached'));
    a.resources.forEach(resource => resource.dispose());
    assert.ok([...disposals.values()].every(count => count === 1));
    a.resources.clear();
    b.motion.update(.1, running); assert.ok(b.motion.time > 0, 'a different factory remains independent');
  } finally { a.dispose(); b.dispose(); }
});

test('actual rotor vertices sweep a full turn outside the road and remain in transformed culling bounds', () => {
  const fixture = setup(), point = new THREE.Vector3(), world = new THREE.Vector3(), center = new THREE.Vector3();
  let checked = 0, minimum = Infinity;
  try {
    for (const target of fixture.targets) {
      const road = Array.from({ length: 161 }, (_, i) => sampleTrack(target.distance - 40 + i * .5).position);
      const fixedHub = target.pivot.getWorldPosition(new THREE.Vector3());
      for (let step = 0; step <= 72; step++) {
        target.pivot.rotation.z = step / 72 * Math.PI * 2;
        target.pivot.updateWorldMatrix(true, true);
        assert.ok(target.pivot.getWorldPosition(center).distanceTo(fixedHub) < 1e-10, 'spinning cannot move the axle');
        target.pivot.traverse(mesh => {
          if (!mesh.isMesh) return;
          const sphere = mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
          assert.ok(mesh.frustumCulled && sphere.radius < 10);
          const positions = mesh.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i); world.copy(point).applyMatrix4(mesh.matrixWorld);
            assert.ok(world.toArray().every(Number.isFinite));
            assert.ok(world.distanceTo(sphere.center) <= sphere.radius + .00001, 'renderer bounds contain every moving vertex');
            assert.ok(mesh.geometry.boundingBox.containsPoint(point));
            let nearestSquared = Infinity;
            for (const sample of road) nearestSquared = Math.min(nearestSquared, (world.x - sample.x) ** 2 + (world.z - sample.z) ** 2);
            minimum = Math.min(minimum, Math.sqrt(nearestSquared));
            assert.ok(nearestSquared >= 12.5 ** 2, `${target.id} sweep enters the road at ${world.toArray()}`);
            assert.ok(world.z < sampleTrack(800).position.z - 15, 'both rotor sweeps remain far behind the whole loop corridor');
            checked++;
          }
        });
      }
    }
    assert.ok(checked > 250000); assert.ok(minimum > 20 && minimum < 32);
  } finally { fixture.dispose(); }
});
