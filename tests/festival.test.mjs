import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRaceFestival } from '../src/festival.mjs';
import { COURSE_LENGTH } from '../src/core.mjs';
import { sampleTrack } from '../src/track.mjs';

function dispose(group) {
  const materials = new Set();
  group.traverse(object => { if (object.isMesh) { object.geometry.dispose(); materials.add(object.material); } });
  materials.forEach(material => material.dispose());
}

test('festival builds real finite geometry, shared materials and bounded cullable venues', () => {
  const festival = createRaceFestival();
  try {
    assert.ok(festival.isGroup);
    for (const name of ['starting-paddock', 'starting-grandstand', 'woodland-windmill',
      'sky-observatory', 'sky-balloon-meadow', 'bay-lighthouse', 'bay-surf-shack',
      'bay-sailboats', 'finish-grandstand-left', 'finish-grandstand-right', 'winners-trophy-garden', 'victory-podium'])
      assert.ok(festival.getObjectByName(name), `Missing recognizable venue: ${name}`);
    let meshes = 0, triangles = 0;
    const materials = new Set();
    festival.traverse(object => {
      if (!object.isMesh) return;
      meshes++; materials.add(object.material);
      const geometry = object.geometry;
      for (const attribute of Object.values(geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite), `${object.name} has nonfinite geometry`);
      assert.ok(geometry.attributes.position.count > 0);
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      assert.ok(Number.isFinite(geometry.boundingSphere.radius) && geometry.boundingSphere.radius > 0);
      assert.ok(object.frustumCulled, 'festival meshes retain frustum culling');
      assert.equal(object.castShadow, object.receiveShadow, 'batch preserves both shadow flags');
    });
    assert.ok(meshes <= 200, `Static draw budget: ${meshes}`);
    assert.ok(triangles <= 100_000, `Static triangle budget: ${triangles}`);
    assert.ok(materials.size <= 12 && materials.size < meshes / 4, 'venues reuse a small original palette');
    for (const venue of festival.children) {
      const bounds = new THREE.Box3().setFromObject(venue), size = bounds.getSize(new THREE.Vector3());
      assert.ok(size.x < 100 && size.y < 80 && size.z < 100, `${venue.name} lost spatial batching: ${size.toArray()}`);
      const keys = new Set();
      for (const mesh of venue.children) {
        const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;
        assert.ok(!keys.has(key), `${venue.name} has an unmerged material/shadow batch`); keys.add(key);
      }
    }
  } finally { dispose(festival); }
});

test('every actual festival vertex clears the curved road and the whole loop corridor', () => {
  const festival = createRaceFestival();
  // Test world-space vertices against independently sampled road centers, not
  // placement metadata. Half-unit spacing gives <0.5 units of distance error;
  // require an extra half-unit beyond the specified 12-unit shoulder clearance.
  const centers = [];
  for (let d = -80; d <= COURSE_LENGTH + 150; d += .5) {
    if (d >= 800 && d <= 1040) continue;
    centers.push(sampleTrack(d).position);
  }
  const loop = new THREE.Box3();
  for (let d = 800; d <= 1040; d += .25) loop.expandByPoint(sampleTrack(d).position);
  loop.expandByVector(new THREE.Vector3(12, 17, 15));
  // No scenery is put into even the broad horizontal loop rectangle, preserving
  // the existing side-on overview and its approach/exit sightlines at any height.
  loop.min.y = -Infinity; loop.max.y = Infinity;
  let minimum = Infinity;
  try {
    festival.updateMatrixWorld(true);
    for (const venue of festival.children) {
      const bounds = new THREE.Box3().setFromObject(venue);
      assert.ok(!bounds.intersectsBox(loop), `${venue.name} obstructs the loop overview`);
      const nearby = centers.filter(p => p.z >= bounds.min.z - 25 && p.z <= bounds.max.z + 25);
      assert.ok(nearby.length > 0, `${venue.name} is not aligned with the course`);
      venue.traverse(mesh => {
        if (!mesh.isMesh) return;
        const positions = mesh.geometry.attributes.position, vertex = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          let nearest = Infinity;
          for (const center of nearby) nearest = Math.min(nearest, (vertex.x - center.x) ** 2 + (vertex.z - center.z) ** 2);
          minimum = Math.min(minimum, Math.sqrt(nearest));
          assert.ok(nearest >= 12.5 ** 2, `${mesh.name} enters the road shoulder at ${vertex.toArray()} (${Math.sqrt(nearest)})`);
        }
      });
    }
    assert.ok(minimum < 40, 'venues remain close enough to recognize from the road');
  } finally { dispose(festival); }
});

test('construction disposes scratch geometry while each festival owns its live resources', () => {
  const disposed = new Set(), originalDispose = THREE.BufferGeometry.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function () { disposed.add(this); return originalDispose.call(this); };
  let first;
  try { first = createRaceFestival(); } finally { THREE.BufferGeometry.prototype.dispose = originalDispose; }
  const second = createRaceFestival(), firstGeometry = new Set(), firstMaterials = new Set();
  try {
    first.traverse(mesh => {
      if (!mesh.isMesh) return;
      assert.ok(!disposed.has(mesh.geometry), 'returned geometry was not scratch-disposed');
      firstGeometry.add(mesh.geometry); firstMaterials.add(mesh.material);
    });
    assert.ok(disposed.size > firstGeometry.size * 2, 'temporary transformed geometry is released after batching');
    second.traverse(mesh => {
      if (!mesh.isMesh) return;
      assert.ok(!firstGeometry.has(mesh.geometry) && !firstMaterials.has(mesh.material), 'separate festivals own separate resources');
    });
  } finally { dispose(first); dispose(second); }
});
