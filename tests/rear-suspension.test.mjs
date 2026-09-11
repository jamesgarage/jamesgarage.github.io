import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TRUCKS } from '../src/core.mjs';
import { makeTruck, disposeTruck } from '../src/models.mjs';
import { poseRearSuspension } from '../src/rear-suspension.mjs';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
function transforms(root) {
  const result = [];
  root.traverse(o => result.push([o, ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray(), o.visible]));
  return result;
}

test('only Titan exposes the borrowed rear spring handle; other seven trucks are untouched', () => {
  for (const spec of TRUCKS) {
    const truck = makeTruck(spec);
    try {
      if (spec.id === 'mega-titan') {
        assert.equal(truck.rearSuspension.group, truck.body.getObjectByName('titan-rear-suspension'));
        assert.equal(truck.rearSuspension.group.children.length, 3, 'reuse the three existing material batches');
        assert.equal(truck.rearSuspension.lowerAnchor, 1.77);
        assert.equal(truck.rearSuspension.span, .95);
        assert.ok(Object.isFrozen(truck.rearSuspension));
      } else {
        assert.equal(truck.rearSuspension, null);
        const before = transforms(truck.group);
        assert.equal(poseRearSuspension(truck.rearSuspension, .2), 0);
        assert.deepEqual(transforms(truck.group), before);
      }
    } finally { disposeTruck(truck); }
  }
});

test('the lower mount stays fixed while the upper follows the existing body dip through guardian transitions', () => {
  const truck = makeTruck(TRUCKS.find(s => s.id === 'mega-titan'));
  try {
    truck.group.scale.setScalar(1);
    const suspension = truck.rearSuspension;
    for (const transform of [0, .1, .25, .5, 1]) for (const amount of [0, .025, .1, .2]) {
      truck.body.position.y = transform * 1.8 - amount;
      poseRearSuspension(suspension, amount);
      truck.group.updateMatrixWorld(true);
      const lower = suspension.group.localToWorld(new THREE.Vector3(0, 1.77, -2.34));
      const upper = suspension.group.localToWorld(new THREE.Vector3(0, 2.72, -2.34));
      near(lower.y, transform * 1.8 + 1.77);
      near(upper.y, transform * 1.8 + 2.72 - amount);
      near(upper.y - lower.y, .95 - amount);
      near(lower.z, -2.34);
      near(truck.body.position.y, transform * 1.8 - amount);
    }
  } finally { disposeTruck(truck); }
});

test('invalid compression restores exact neutral and finite input cannot over-compress or extend springs', () => {
  const truck = makeTruck(TRUCKS.find(s => s.id === 'mega-titan'));
  try {
    const spring = truck.rearSuspension.group;
    for (const input of [NaN, Infinity, -Infinity, undefined, null, '0.2', -.1, -0, 0]) {
      poseRearSuspension(truck.rearSuspension, .2);
      assert.equal(poseRearSuspension(truck.rearSuspension, input), 0);
      assert.deepEqual(spring.position.toArray(), [0, 0, 0]);
      assert.deepEqual(spring.scale.toArray(), [1, 1, 1]);
    }
    assert.equal(poseRearSuspension(truck.rearSuspension, 100), .2);
    near(spring.scale.y, 1 - .2 / .95);
    const compressed = transforms(spring);
    poseRearSuspension(truck.rearSuspension, .2);
    assert.deepEqual(transforms(spring), compressed, 'same input is stable without a clock');
  } finally { disposeTruck(truck); }
});

test('spring posing changes no body, wheel, arm, geometry, material, or ownership', () => {
  const truck = makeTruck(TRUCKS.find(s => s.id === 'mega-titan'));
  try {
    const spring = truck.rearSuspension.group;
    const before = transforms(truck.group).filter(row => row[0] !== spring);
    const resources = [];
    truck.group.traverse(o => { if (o.isMesh) resources.push([o, o.geometry, o.material, o.geometry.attributes.position.array.slice()]); });
    let disposed = 0;
    const owned = new Set(resources.flatMap(([, geometry, material]) => [geometry, material]));
    for (const resource of owned) resource.addEventListener('dispose', () => disposed++);
    for (const amount of [.2, .1, .04, 0, .2, 0]) poseRearSuspension(truck.rearSuspension, amount);
    assert.deepEqual(transforms(truck.group).filter(row => row[0] !== spring), before);
    for (const [mesh, geometry, material, positions] of resources) {
      assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material);
      assert.deepEqual(mesh.geometry.attributes.position.array, positions);
    }
    assert.equal(disposed, 0);
    disposeTruck(truck);
    assert.equal(disposed, owned.size, 'factory remains the sole resource owner');
    disposeTruck(truck);
    assert.equal(disposed, owned.size, 'disposal remains idempotent');
  } finally { disposeTruck(truck); }
});

test('sharp steering symmetrically tapers the spring pose to exact neutral without changing the truck pose', () => {
  const truck = makeTruck(TRUCKS.find(s => s.id === 'mega-titan'));
  try {
    const spring = truck.rearSuspension.group;
    truck.body.position.y = -.2;
    for (const sign of [-1, 1]) for (const [lean, expected] of [[0, .2], [.14, .2], [.16, .1], [.18, 0], [.203937, 0], [1, 0]]) {
      truck.body.rotation.z = -sign * lean;
      truck.wheels.forEach((wheel, i) => { wheel.rotation.y = i > 1 ? sign * lean * 1.4 : 0; });
      const before = transforms(truck.group).filter(row => row[0] !== spring);
      near(poseRearSuspension(truck.rearSuspension, 100, sign * lean), expected);
      assert.deepEqual(transforms(truck.group).filter(row => row[0] !== spring), before);
      spring.updateMatrix();
      const lower = new THREE.Vector3(0, 1.77, -2.34).applyMatrix4(spring.matrix);
      const upper = new THREE.Vector3(0, 2.72, -2.34).applyMatrix4(spring.matrix);
      near(lower.y, 1.77 + expected);
      near(upper.y, 2.72);
      if (expected === 0) {
        assert.deepEqual(spring.position.toArray(), [0, 0, 0]);
        assert.deepEqual(spring.scale.toArray(), [1, 1, 1]);
      }
    }
    for (const lean of [NaN, Infinity, -Infinity, null, '0']) {
      poseRearSuspension(truck.rearSuspension, .2, 0);
      const before = transforms(truck.group).filter(row => row[0] !== spring);
      assert.equal(poseRearSuspension(truck.rearSuspension, .2, lean), 0);
      assert.deepEqual(spring.position.toArray(), [0, 0, 0]);
      assert.deepEqual(spring.scale.toArray(), [1, 1, 1]);
      assert.deepEqual(transforms(truck.group).filter(row => row[0] !== spring), before);
    }
  } finally { disposeTruck(truck); }
});
