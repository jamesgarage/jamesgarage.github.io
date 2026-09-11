import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TRUCKS } from '../src/core.mjs';
import { makeTruck, disposeTruck } from '../src/models.mjs';

function resources(truck) {
  const geometries = new Set(), materials = new Set();
  truck.group.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of [].concat(object.material)) materials.add(material);
  });
  return [...geometries, ...materials];
}

for (const spec of TRUCKS) test(`${spec.name} preserves animation and exhaust contracts with finite shaped geometry`, () => {
  const truck = makeTruck(spec);
  try {
    assert.equal(truck.spec, spec);
    assert.equal(truck.group.scale.x, spec.scale);
    assert.equal(truck.body.parent, truck.group);
    assert.equal(truck.head.parent, truck.body);
    assert.equal(truck.head.visible, false);
    assert.equal(truck.arms.length, 2);
    assert.equal(truck.struts.length, 2);
    assert.equal(truck.wheels.length, 4);
    truck.wheels.forEach((wheel, index) => {
      assert.equal(wheel.parent, truck.group);
      assert.equal(wheel.position.x, (index % 2 ? 1 : -1) * 1.65);
      assert.equal(wheel.position.z, index < 2 ? -1.5 : 1.5);
      assert.ok(Math.abs(wheel.position.y - 1.05) < .02);
      wheel.rotation.x = 1.2;
      wheel.position.x += Math.sign(wheel.position.x) * .7;
    });
    truck.body.position.y = 1.8;
    truck.arms.forEach((arm, index) => {
      assert.equal(arm.parent, truck.body); arm.visible = true; arm.rotation.z = (index === 0 ? -1 : 1) * .85;
    });
    for (const strut of truck.struts) { assert.equal(strut.parent, truck.group); strut.scale.y = 3.1; }
    for (const side of [-1, 1]) {
      const outlet = truck.body.getObjectByName(`exhaust-outlet-${side}`);
      assert.ok(outlet, 'Exhaust has a named body-local anchor');
      assert.deepEqual(outlet.position.toArray(), [side * 1.05, 3.09, -2.16]);
    }
    const character = truck.body.getObjectByName(`character-${spec.id}`);
    assert.ok(character?.visible, 'Truck has a visible original character group');
    let detailVertices = 0, meshes = 0, vertices = 0;
    character.traverse(object => { if (object.isMesh) detailVertices += object.geometry.attributes.position.count; });
    assert.ok(detailVertices > 100, 'Character features contain actual sculpted geometry');
    truck.group.updateMatrixWorld(true);
    truck.group.traverse(object => {
      assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      if (!object.isMesh) return;
      meshes++;
      vertices += object.geometry.attributes.position.count;
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      object.geometry.computeBoundingSphere();
      assert.ok(Number.isFinite(object.geometry.boundingSphere.radius));
    });
    assert.ok(meshes < 85, `Animated parent/material batching budget exceeded: ${meshes}`);
    assert.ok(vertices < 230_000, `Truck geometry budget exceeded: ${vertices}`);
    const bounds = new THREE.Box3().setFromObject(truck.group);
    assert.ok(bounds.min.x > -5 && bounds.max.x < 5, 'Centered guardian stays within road corridor');
  } finally { disposeTruck(truck); }
});

test('disposing one truck once releases its GPU resources and leaves other and subsequent trucks usable', () => {
  const first = makeTruck(TRUCKS[0]);
  const survivor = makeTruck(TRUCKS[0]);
  const disposed = new Map();
  for (const resource of resources(first)) {
    disposed.set(resource, 0);
    resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  }
  let survivorDisposals = 0;
  for (const resource of resources(survivor)) resource.addEventListener('dispose', () => survivorDisposals++);
  const borrowedGeometry = new THREE.BoxGeometry(), borrowedMaterial = new THREE.MeshBasicMaterial();
  let borrowedDisposals = 0;
  borrowedGeometry.addEventListener('dispose', () => borrowedDisposals++);
  borrowedMaterial.addEventListener('dispose', () => borrowedDisposals++);
  first.group.add(new THREE.Mesh(borrowedGeometry, borrowedMaterial));
  disposeTruck(first);
  disposeTruck(first);
  assert.ok([...disposed.values()].every(count => count === 1), 'Every owned GPU resource disposed exactly once');
  assert.equal(survivorDisposals, 0);
  assert.equal(borrowedDisposals, 0, 'Caller-attached resources remain owned by their caller');
  borrowedGeometry.dispose(); borrowedMaterial.dispose();
  const subsequent = makeTruck(TRUCKS[0]);
  for (const truck of [survivor, subsequent]) {
    for (const resource of resources(truck)) assert.ok(!disposed.has(resource), 'No disposed shared GPU resource is reused');
    truck.group.updateMatrixWorld(true);
    assert.ok(new THREE.Box3().setFromObject(truck.group).getSize(new THREE.Vector3()).length() > 0);
    disposeTruck(truck);
  }
});
