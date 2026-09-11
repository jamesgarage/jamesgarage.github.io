import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CREW } from '../src/crew.mjs';
import { makeBuddyTruck, disposeBuddyTruck } from '../src/buddy-models.mjs';

function resources(truck) {
  const owned = new Set();
  truck.group.traverse(object => {
    if (!object.isMesh) return;
    owned.add(object.geometry);
    for (const material of [].concat(object.material)) owned.add(material);
  });
  return owned;
}

const features = {
  sunny: 'rally-lamps', splash: 'bear-ears', ember: 'flame-wing',
  pebble: 'crawler-spare', bolt: 'electric-fin', digger: 'dump-tray',
};

for (const spec of CREW) test(`${spec.name} has a finite original companion shape, safe envelope and small draw budget`, () => {
  const truck = makeBuddyTruck(spec);
  try {
    assert.equal(truck.spec, spec);
    assert.equal(truck.group.scale.x, spec.scale);
    assert.equal(truck.body.parent, truck.group);
    assert.equal(truck.body.userData.style, spec.style);
    assert.ok(truck.body.getObjectByName(features[spec.id]), 'Stable distinguishing feature exists');
    assert.equal(truck.wheels.length, 4);
    for (const [i, wheel] of truck.wheels.entries()) {
      assert.equal(wheel.parent, truck.group);
      assert.equal(Math.sign(wheel.position.x), i % 2 ? 1 : -1);
      assert.equal(Math.sign(wheel.position.z), i < 2 ? -1 : 1, 'Front wheels are indices 2 and 3 facing +Z');
      const bounds = new THREE.Box3().setFromObject(wheel);
      assert.ok(bounds.getSize(new THREE.Vector3()).z > spec.scale * 2, 'Tires have a substantial round section');
      assert.equal(wheel.children.filter(child => child.isMesh).length, 2, 'Rubber and hub batches stay articulated together');
    }
    truck.group.scale.setScalar(1);
    truck.group.updateMatrixWorld(true);
    let meshes = 0, triangles = 0;
    const materials = new Set(), colorSignatures = new Set();
    truck.group.traverse(object => {
      assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      if (!object.isMesh) return;
      meshes++;
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      const normals = object.geometry.attributes.normal;
      assert.ok(normals?.count > 0, 'Painted curves have lighting normals');
      object.geometry.computeBoundingSphere();
      assert.ok(Number.isFinite(object.geometry.boundingSphere.radius));
      for (const material of [].concat(object.material)) materials.add(material);
      const colors = object.geometry.attributes.color;
      for (let i = 0; i < colors.count; i++) colorSignatures.add([colors.getX(i), colors.getY(i), colors.getZ(i)].map(n => n.toFixed(5)).join(','));
    });
    for (const tint of [spec.color, spec.accent]) {
      const expected = new THREE.Color(tint).toArray().map(n => n.toFixed(5)).join(',');
      assert.ok(colorSignatures.has(expected), 'Character paint and accent survive material batching');
    }
    assert.ok(materials.size <= 6);
    assert.ok(meshes <= 18, `${meshes} meshes exceed the companion draw budget`);
    assert.ok(triangles < 10_000, `${triangles} triangles exceed the companion budget`);
    const bounds = new THREE.Box3().setFromObject(truck.group);
    assert.ok(bounds.min.x >= -2.25 && bounds.max.x <= 2.25, 'Lateral hull fits guardian clearance');
    assert.ok(bounds.min.z >= -2.8 && bounds.max.z <= 2.8, 'Longitudinal hull fits the safe passing layer');
    assert.ok(bounds.max.y <= 5 && bounds.min.y >= -.08, 'Model sits on its tire contact plane');
    const shellBefore = new THREE.Box3().setFromObject(truck.body).clone();
    for (const wheel of truck.wheels) wheel.rotation.x = 1.23;
    truck.group.updateMatrixWorld(true);
    assert.deepEqual(new THREE.Box3().setFromObject(truck.body), shellBefore, 'Wheel spin never rotates the sprung shell');
    truck.body.position.y = .18;
    assert.ok(truck.wheels.every(wheel => wheel.position.y === 1.03), 'Body suspension leaves tire roots on the road');
  } finally { disposeBuddyTruck(truck); }
});

test('each companion owns independently disposable resources and ignores borrowed attachments', () => {
  for (const spec of CREW) {
    const first = makeBuddyTruck(spec), survivor = makeBuddyTruck(spec);
    const disposed = new Map();
    for (const resource of resources(first)) {
      disposed.set(resource, 0);
      resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
    }
    let survivorDisposals = 0;
    for (const resource of resources(survivor)) {
      assert.ok(!disposed.has(resource), 'Instances share no geometry or materials');
      resource.addEventListener('dispose', () => survivorDisposals++);
    }
    const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
    const borrowed = new THREE.Mesh(geometry, material); first.body.add(borrowed);
    let borrowedDisposals = 0;
    for (const resource of [geometry, material]) resource.addEventListener('dispose', () => borrowedDisposals++);
    disposeBuddyTruck(first); disposeBuddyTruck(first);
    assert.ok([...disposed.values()].every(count => count === 1), 'Each owned resource is released exactly once');
    assert.equal(survivorDisposals, 0);
    assert.equal(borrowedDisposals, 0);
    assert.ok(new THREE.Box3().setFromObject(survivor.group).getSize(new THREE.Vector3()).length() > 0);
    geometry.dispose(); material.dispose(); disposeBuddyTruck(survivor);
  }
});
