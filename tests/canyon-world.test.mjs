import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getCourse } from '../src/courses.mjs';
import { sampleTrack } from '../src/track.mjs';
import { makeRoad } from '../src/world.mjs';
import { createCanyonWorld, disposeCanyonWorld } from '../src/canyon-world.mjs';

function resources(root) {
  const result = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh) return; result.add(mesh.geometry); result.add(mesh.material);
    for (const value of Object.values(mesh.material)) if (value?.isTexture) result.add(value);
  });
  return result;
}

test('reusable road keeps the default deck continuous and cuts every surface exactly at canyon gap bounds', () => {
  const gaps = getCourse('canyon').gaps, defaultRoad = makeRoad(), cutRoad = makeRoad({ gaps });
  try {
    assert.ok(defaultRoad.children.some(mesh => mesh.userData.roadKind === 'shoulder'));
    const boundaries = new Set();
    for (const mesh of cutRoad.children) {
      if (!mesh.userData.roadRibbon) continue;
      const [start, end] = mesh.userData.roadInterval;
      assert.ok(end > start);
      for (const gap of gaps) assert.ok(end <= gap.start || start >= gap.end, `ribbon ${start}..${end} enters ${gap.id}`);
      boundaries.add(start); boundaries.add(end);
      const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
      const steps = position.count / 2 - 1;
      for (let i = 0; i < index.count; i += 3) {
        const rows = [index.getX(i), index.getX(i + 1), index.getX(i + 2)].map(vertex => Math.floor(vertex / 2));
        assert.equal(Math.max(...rows) - Math.min(...rows), 1, 'no triangle skips a sampled road section');
      }
      for (const row of [0, steps]) {
        const center = new THREE.Vector3().fromBufferAttribute(position, row * 2).add(new THREE.Vector3().fromBufferAttribute(position, row * 2 + 1)).multiplyScalar(.5);
        const frame = sampleTrack(row === 0 ? start : end);
        assert.ok(Math.abs(center.clone().sub(frame.position).dot(frame.forward)) < .0002, 'actual cut vertices lie in the exact endpoint frame');
      }
    }
    for (const gap of gaps) { assert.ok(boundaries.has(gap.start)); assert.ok(boundaries.has(gap.end)); }
    const ray = new THREE.Raycaster(); defaultRoad.updateMatrixWorld(true); cutRoad.updateMatrixWorld(true);
    for (const gap of gaps) {
      const frame = sampleTrack((gap.start + gap.end) / 2);
      ray.set(frame.position.clone().addScaledVector(frame.up, 4), frame.up.clone().negate()); ray.far = 8;
      assert.ok(ray.intersectObject(defaultRoad, true).length > 0, 'default road remains intact');
      assert.equal(ray.intersectObject(cutRoad, true).length, 0, 'actual canyon deck is absent');
    }
  } finally { for (const root of [defaultRoad, cutRoad]) for (const resource of resources(root)) resource.dispose(); }
});

test('batched canyon has real deep gaps, deck-aligned pads, finite cullable geometry and a bounded budget', () => {
  const world = createCanyonWorld();
  try {
    world.updateMatrixWorld(true);
    let meshes = 0, triangles = 0;
    world.traverse(mesh => {
      if (!mesh.isMesh) return; meshes++;
      const geometry = mesh.geometry;
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      for (const attribute of Object.values(geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      assert.ok(mesh.frustumCulled);
      assert.ok(geometry.boundingSphere && Number.isFinite(geometry.boundingSphere.radius));
      assert.ok(geometry.boundingBox.max.z - geometry.boundingBox.min.z < 230, `${mesh.name} remains spatially cullable`);
    });
    assert.ok(meshes < 270, `${meshes} meshes`);
    assert.ok(triangles < 250000, `${triangles} triangles`);
    assert.ok(world.getObjectByName('loop-support'));
    const road = world.children.filter(mesh => mesh.userData.canyonKind === 'road' || mesh.userData.canyonKind === 'pad' || mesh.userData.canyonKind === 'pad-marking');
    const ray = new THREE.Raycaster(); let gapSamples = 0;
    for (const gap of getCourse('canyon').gaps) {
      for (const [kind, start, end] of [['launch', gap.launch, gap.start], ['landing', gap.end, gap.land]]) {
        const pad = world.getObjectByName(`${gap.id}-${kind}-pad`);
        assert.deepEqual(pad.userData.roadInterval, [start, end]);
      }
      for (let d = gap.start + 1; d < gap.end; d += 3) for (const lane of [-6.5, 0, 6.5]) {
        const frame = sampleTrack(d), start = frame.position.clone().addScaledVector(frame.right, lane).addScaledVector(frame.up, 4);
        ray.set(start, frame.up.clone().negate()); ray.far = 8;
        assert.equal(ray.intersectObjects(road).length, 0, `batched road/pads bridge ${gap.id} at ${d}, ${lane}`);
        gapSamples++;
      }
      const frame = sampleTrack((gap.start + gap.end) / 2);
      ray.set(frame.position.clone().add(new THREE.Vector3(0, 8, 0)), new THREE.Vector3(0, -1, 0)); ray.far = 100;
      const floor = ray.intersectObject(world.getObjectByName(`${gap.id}-floor`));
      assert.ok(floor.length > 0 && floor[0].point.y < -50, 'gap reveals a substantial chasm below the driving deck');
      const floorBounds = world.getObjectByName(`${gap.id}-floor`).geometry.boundingBox;
      for (const edge of ['launch', 'landing']) {
        const cliffBounds = world.getObjectByName(`${gap.id}-${edge}-cliff`).geometry.boundingBox;
        assert.ok(floorBounds.min.z < cliffBounds.min.z && floorBounds.max.z > cliffBounds.max.z, 'deep floor extends behind recessed cliff bases without a sky seam');
      }
    }
    assert.ok(gapSamples > 300);
  } finally { disposeCanyonWorld(world); }
});

test('actual cliff, cactus and marker vertices leave a twelve-unit open shoulder and flight corridor', () => {
  const world = createCanyonWorld(), centers = [];
  for (let d = -70; d <= 2040; d += 1) centers.push(sampleTrack(d).position);
  try {
    let checked = 0;
    world.traverse(mesh => {
      if (!['mesa', 'horizon', 'cactus', 'marker'].includes(mesh.userData.canyonKind)) return;
      const bounds = mesh.geometry.boundingBox;
      const nearby = centers.filter(point => point.z > bounds.min.z - 40 && point.z < bounds.max.z + 40);
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i);
        let closest = Infinity;
        for (const point of nearby) closest = Math.min(closest, Math.hypot(x - point.x, z - point.z));
        assert.ok(closest >= 12, `${mesh.name} enters the shoulder: ${closest} at ${x},${z}`); checked++;
      }
    });
    assert.ok(checked > 50000);
  } finally { disposeCanyonWorld(world); }
});

test('canyon instances own disjoint resources and disposal cannot invalidate another course instance', () => {
  const first = createCanyonWorld(), survivor = createCanyonWorld();
  const owned = resources(first), living = resources(survivor), counts = new Map();
  for (const resource of owned) { assert.ok(!living.has(resource)); resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1)); }
  let survivorDisposals = 0;
  for (const resource of living) resource.addEventListener('dispose', () => survivorDisposals++);
  try {
    disposeCanyonWorld(first); disposeCanyonWorld(first);
    assert.equal(counts.size, owned.size);
    for (const count of counts.values()) assert.equal(count, 1);
    assert.equal(survivorDisposals, 0);
    survivor.traverse(mesh => { if (mesh.isMesh) assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite)); });
  } finally { disposeCanyonWorld(first); disposeCanyonWorld(survivor); }
});
