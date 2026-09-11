import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TRUCKS } from '../src/core.mjs';
import { makeTruck, disposeTruck } from '../src/models.mjs';
import { poseGuardian } from '../src/guardian-pose.mjs';

function visibleBounds(truck) {
  truck.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  truck.group.traverseVisible(object => { if (object.isMesh) box.expandByObject(object, true); });
  return box;
}

function poseSnapshot(truck) {
  const snapshot = [];
  truck.group.traverse(object => snapshot.push([object.name, object.visible, ...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()]));
  return snapshot;
}

for (const spec of TRUCKS) test(`${spec.name} robot and flight poses retain the actual articulated clearance envelope`, () => {
  const truck = makeTruck(spec);
  try {
    truck.group.scale.setScalar(1);
    assert.equal(truck.guardian.upper.visible, false);
    assert.equal(truck.guardian.lower.visible, false);
    assert.equal(truck.guardian.jets.visible, false);
    assert.equal(truck.guardian.legs.length, 2);
    assert.equal(truck.guardian.wings.length, 2);
    for (const transform of [0, .5, 1]) for (const flight of [0, 1]) for (const lean of [-.32, 0, .32]) for (const squash of [0, 1]) for (const spin of [.7, 2.1]) {
      for (let i = 0; i < 4; i++) {
        const wheel = truck.wheels[i]; wheel.rotation.order = 'YXZ'; wheel.rotation.x = spin; wheel.rotation.y = i > 1 ? lean * 1.4 : 0;
      }
      poseGuardian(truck, { transform, flight, lean, squash, time: .1 });
      const bounds = visibleBounds(truck), label = `${spec.id}, transform=${transform}, flight=${flight}, lean=${lean}, squash=${squash}`;
      assert.ok(bounds.min.x >= -3.2 && bounds.max.x <= 3.2, `${label}: half-width`);
      assert.ok(bounds.max.y <= 6.2 && bounds.min.y >= -.1, `${label}: height/ground clearance`);
      assert.ok(bounds.min.z >= -2.9 && bounds.max.z <= 2.9, `${label}: length`);
      for (let i = 0; i < 4; i++) {
        assert.equal(truck.wheels[i].rotation.x, spin, 'Scene retains wheel spin');
        assert.equal(truck.wheels[i].rotation.y, i > 1 ? lean * 1.4 : 0, 'Scene retains steering');
      }
    }
    poseGuardian(truck, { transform: 1, flight: 1 });
    assert.ok(truck.arms.every(arm => arm.rotation.x < -.7), 'Flight extends both arms forward');
    assert.ok(truck.guardian.legs.every(leg => leg.rotation.x > .15), 'Flight extends the legs behind the torso');
    assert.ok(truck.guardian.wings.every(wing => Math.abs(wing.rotation.z) < .001), 'Flight unfolds both short wings');
    let meshes = 0, triangles = 0;
    truck.group.traverseVisible(object => { if (object.isMesh) { meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; } });
    assert.ok(meshes <= 76 && triangles <= 62_000, 'Robot detail stays within its bounded draw/geometry budget');
  } finally { disposeTruck(truck); }
});

test('guardian posing is absolute, preserves caller root placement, and clears all flight state for menu/replay', () => {
  const spec = TRUCKS.find(spec => spec.id === 'shark-surge'), truck = makeTruck(spec), fresh = makeTruck(spec);
  try {
    for (const item of [truck, fresh]) { item.group.position.set(7, 4, 1200); item.group.rotation.set(.13, .2, -.1); item.wheels.forEach(wheel => { wheel.rotation.x = 1.2; }); }
    const root = { position: truck.group.position.toArray(), quaternion: truck.group.quaternion.toArray(), scale: truck.group.scale.toArray() };
    const target = { transform: .7, flight: .45, lean: -.16, squash: .3, time: 9 };
    poseGuardian(fresh, target);
    for (let i = 0; i < 60; i++) poseGuardian(truck, { transform: i % 2, flight: i % 3 / 2, lean: Math.sin(i) * .3, squash: i % 2, time: i });
    poseGuardian(truck, target);
    assert.deepEqual(poseSnapshot(truck), poseSnapshot(fresh), 'Identical input yields identical articulation regardless of pose history');
    assert.deepEqual(truck.group.position.toArray(), root.position);
    assert.deepEqual(truck.group.quaternion.toArray(), root.quaternion);
    assert.deepEqual(truck.group.scale.toArray(), root.scale);
    const paused = poseSnapshot(truck);
    for (let i = 0; i < 30; i++) poseGuardian(truck, target);
    assert.deepEqual(poseSnapshot(truck), paused, 'Repeated paused input freezes all articulated transforms');
    poseGuardian(truck, { menu: true, transform: 1, flight: true, lean: .32, squash: 1, time: 0 });
    poseGuardian(fresh, { menu: true, time: 0 });
    assert.deepEqual(poseSnapshot(truck), poseSnapshot(fresh));
    assert.ok([truck.head, ...truck.arms, ...truck.struts, truck.guardian.upper, truck.guardian.lower, truck.guardian.jets].every(object => !object.visible));
    poseGuardian(truck, { transform: NaN, flight: Infinity, lean: -Infinity, squash: NaN, time: NaN });
    const neutral = poseSnapshot(truck); poseGuardian(fresh, {}); assert.deepEqual(neutral, poseSnapshot(fresh));
    poseGuardian(truck, null); assert.deepEqual(poseSnapshot(truck), neutral);
  } finally { disposeTruck(truck); disposeTruck(fresh); }
});

test('jet cores stay finite and steady in gentler motion without changing geometry or shared material state', () => {
  const truck = makeTruck(TRUCKS[0]), geometry = new Map(), materials = new Map();
  try {
    truck.group.traverse(object => {
      if (!object.isMesh) return;
      for (const attribute of Object.values(object.geometry.attributes)) geometry.set(attribute, { array: attribute.array, version: attribute.version, values: attribute.array.slice() });
      materials.set(object.material, { color: object.material.color.getHex(), emissive: object.material.emissive?.getHex(), opacity: object.material.opacity });
    });
    poseGuardian(truck, { transform: 1, flight: true, time: 1, reducedMotion: true });
    const jetPosition = truck.guardian.jets.position.toArray();
    for (let i = 0; i < 120; i++) {
      poseGuardian(truck, { transform: 1, flight: true, time: i * .13, reducedMotion: true });
      assert.deepEqual(truck.guardian.jets.position.toArray(), jetPosition);
    }
    for (const [attribute, original] of geometry) {
      assert.equal(attribute.array, original.array); assert.equal(attribute.version, original.version);
      assert.deepEqual(attribute.array, original.values, 'Pose updates reuse unchanged owned geometry');
    }
    for (const [material, original] of materials) assert.deepEqual({ color: material.color.getHex(), emissive: material.emissive?.getHex(), opacity: material.opacity }, original);
    poseGuardian(truck, {}); assert.equal(truck.guardian.jets.visible, false); assert.equal(truck.guardian.jets.position.z, 0);
  } finally { disposeTruck(truck); }
});
