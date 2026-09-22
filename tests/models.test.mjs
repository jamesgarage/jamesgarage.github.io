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

function visibleBounds(object) {
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  object.traverseVisible(child => {
    if (!child.isMesh) return;
    bounds.expandByObject(child, true);
  });
  return bounds;
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
    const radio = truck.body.getObjectByName('monster-truck-radio');
    assert.ok(radio, 'Truck keeps the Monster Truck Radio detail');
    truck.group.scale.setScalar(1);
    const radioBounds = visibleBounds(radio);
    assert.ok(radioBounds.max.y > 3.45 && radioBounds.max.y < 4.15, 'Radio stays mounted high on the truck without exceeding the roof envelope');
    assert.ok(radioBounds.getSize(new THREE.Vector3()).x > .5 && radioBounds.getSize(new THREE.Vector3()).z > .2, 'Radio remains a visible accessory');
    truck.group.scale.setScalar(spec.scale);
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
    const materials = new Map();
    truck.group.updateMatrixWorld(true);
    truck.group.traverse(object => {
      assert.ok(object.matrixWorld.elements.every(Number.isFinite));
      if (!object.isMesh) return;
      meshes++;
      vertices += object.geometry.attributes.position.count;
      for (const material of [].concat(object.material)) materials.set(material.name.split('-').at(-1), material);
      for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      object.geometry.computeBoundingSphere();
      assert.ok(Number.isFinite(object.geometry.boundingSphere.radius));
    });
    assert.ok(materials.get('paint').isMeshPhysicalMaterial, 'Paint owns a clear-coated physical surface');
    assert.ok(materials.get('chrome').isMeshPhysicalMaterial, 'Chrome owns a reflective physical surface');
    assert.ok(materials.get('glass').isMeshPhysicalMaterial, 'Glass owns a separately tuned physical surface');
    assert.equal(materials.get('glass').metalness, 0, 'Tinted glazing does not read as painted metal');
    assert.ok(materials.get('rubber').roughness - materials.get('glass').roughness > .8, 'Rubber stays visibly rough beside glass');
    assert.ok(materials.get('chrome').metalness > materials.get('paint').metalness, 'Chrome stays more metallic than body paint');
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

test('all truck bodies keep the established parked and articulated physical envelope', () => {
  for (const spec of TRUCKS) {
    const truck = makeTruck(spec);
    try {
      truck.group.scale.setScalar(1);
      const parked = visibleBounds(truck.group);
      assert.ok(parked.min.x >= -2.242 && parked.max.x <= 2.242, `${spec.id}: parked tire width grew`);
      assert.ok(parked.min.z >= -2.651 && parked.max.z <= 2.651, `${spec.id}: parked length grew`);
      assert.ok(parked.min.y >= -.095 && parked.max.y <= 4.15, `${spec.id}: parked height/ground clearance changed`);
      for (const transform of [0, .5, 1]) {
        truck.body.position.y = transform * 1.8;
        truck.head.visible = transform > 0;
        truck.head.scale.setScalar(Math.max(.01, transform));
        truck.arms.forEach((arm, index) => { arm.visible = transform > 0; arm.rotation.z = (index ? 1 : -1) * transform * .85; });
        truck.struts.forEach(strut => { strut.visible = transform > 0; strut.scale.y = 1.2 + transform * 1.9; strut.position.y = 1.7 + transform * .8; });
        for (const steer of [-.448, 0, .448]) for (const spin of [0, .7, 2.1]) {
          truck.wheels.forEach((wheel, index) => {
            wheel.position.x = (index % 2 ? 1 : -1) * (1.65 + transform * .7);
            wheel.rotation.order = 'YXZ'; wheel.rotation.x = spin; wheel.rotation.y = index > 1 ? steer : 0;
          });
          const bounds = visibleBounds(truck.group);
          assert.ok(bounds.min.x > -3.31 && bounds.max.x < 3.31, `${spec.id}: guardian wheel corridor grew`);
          assert.ok(bounds.min.z > -2.9 && bounds.max.z < 2.9, `${spec.id}: steered wheel corridor grew`);
          assert.ok(bounds.max.y < 6.2, `${spec.id}: guardian height grew`);
        }
      }
    } finally { disposeTruck(truck); }
  }
});

test('fire engine and shark own full body shapes with visible equipment and fins above the tires', () => {
  for (const [id, shellName, upperName, rearName] of [
    ['rescue-roarer', 'fire-engine-body', 'roof-ladder', 'rear-hose-reel'],
    ['shark-surge', 'shark-body', 'shark-fins', 'shark-tail'],
  ]) {
    const truck = makeTruck(TRUCKS.find(spec => spec.id === id));
    try {
      truck.group.scale.setScalar(1);
      const shell = truck.body.getObjectByName(shellName);
      const upper = truck.body.getObjectByName(upperName);
      const rear = truck.body.getObjectByName(rearName);
      assert.ok(shell && upper && rear, `${id}: body/equipment geometry exists`);
      const shellBounds = visibleBounds(shell), upperBounds = visibleBounds(upper), rearBounds = visibleBounds(rear);
      assert.ok(shellBounds.getSize(new THREE.Vector3()).z > 3.5, 'The special shell covers the whole chassis');
      assert.ok(upperBounds.max.y > 3.6, 'Ladder or dorsal fin rises above the body');
      assert.ok(rearBounds.min.z < -2.2 && rearBounds.max.y > 2.8, 'Rear equipment remains above the bumper in chase view');
      // Even the largest landing squash leaves side fins above a spinning tire.
      if (id === 'shark-surge') assert.ok(upperBounds.min.y - .2 > visibleBounds(truck.wheels[0]).max.y + .15);
      assert.equal(truck.body.children.filter(child => child.isMesh).length, 1, 'Only the shared chassis is left from the generic body');
      const roofDetail = id === 'rescue-roarer' ? upperBounds : visibleBounds(truck.body.getObjectByName('shark-fins'));
      truck.head.visible = true;
      assert.ok(visibleBounds(truck.head).min.z > roofDetail.max.z + .05, 'Guardian head emerges clear of the ladder/dorsal fin');
    } finally { disposeTruck(truck); }
  }
});

test('Mega Titan exposes its rear coilovers while preserving the other trucks tire geometry', () => {
  const titan = makeTruck(TRUCKS.find(spec => spec.id === 'mega-titan'));
  const rumbler = makeTruck(TRUCKS[0]);
  try {
    titan.group.scale.setScalar(1); rumbler.group.scale.setScalar(1);
    const suspension = titan.body.getObjectByName('titan-rear-suspension');
    assert.ok(suspension);
    const bounds = visibleBounds(suspension);
    assert.ok(bounds.min.z < -2.4 && bounds.max.y > 2.6, 'Rear springs protrude behind the shell into the chase view');
    for (let index = 0; index < 4; index++) {
      assert.deepEqual(visibleBounds(titan.wheels[index]), visibleBounds(rumbler.wheels[index]), 'Tire footprint remains exactly the same');
      const first = titan.wheels[index].children, second = rumbler.wheels[index].children;
      assert.equal(first.length, second.length);
      for (let part = 0; part < first.length; part++) assert.deepEqual(first[part].geometry.attributes.position.array, second[part].geometry.attributes.position.array);
    }
  } finally { disposeTruck(titan); disposeTruck(rumbler); }
});

test('new body palettes and equipment have independent ownership across repeated mixed garage swaps', () => {
  const specs = ['rescue-roarer', 'shark-surge', 'mega-titan'].map(id => TRUCKS.find(spec => spec.id === id));
  const survivor = makeTruck(specs[0]);
  const survivorResources = new Set(resources(survivor));
  let survivorDisposals = 0;
  for (const resource of survivorResources) resource.addEventListener('dispose', () => survivorDisposals++);
  const retired = new Set();
  try {
    for (let repeat = 0; repeat < 3; repeat++) for (const spec of specs) {
      const truck = makeTruck(spec), owned = resources(truck), counts = new Map();
      for (const resource of owned) {
        assert.ok(!survivorResources.has(resource) && !retired.has(resource));
        counts.set(resource, 0);
        resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
      }
      disposeTruck(truck); disposeTruck(truck);
      assert.ok([...counts.values()].every(value => value === 1));
      for (const resource of owned) retired.add(resource);
    }
    assert.equal(survivorDisposals, 0);
  } finally { disposeTruck(survivor); }
});
