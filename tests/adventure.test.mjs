import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAdventureScenery, isAdventureClearing } from '../src/adventure.mjs';
import { createWorld } from '../src/world.mjs';
import { sampleTrack, trackCenter } from '../src/track.mjs';

function dispose(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(mesh => { if (mesh.isMesh) { geometries.add(mesh.geometry); materials.add(mesh.material); if (mesh.material.map) textures.add(mesh.material.map); } });
  textures.forEach(texture => texture.dispose());
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}

test('three recognizable adventure scenes use finite, owned, spatially batched geometry', () => {
  const adventure = createAdventureScenery(), second = createAdventureScenery();
  try {
    for (const name of ['bear-creek-bridge', 'rocket-runway', 'gator-falls']) assert.ok(adventure.getObjectByName(name));
    let meshes = 0, triangles = 0;
    const geometry = new Set(), materials = new Set();
    adventure.traverse(mesh => {
      if (!mesh.isMesh) return;
      meshes++; triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      geometry.add(mesh.geometry); materials.add(mesh.material);
      assert.ok(mesh.frustumCulled);
      for (const attribute of Object.values(mesh.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      assert.ok(mesh.geometry.boundingSphere.radius > 0 && Number.isFinite(mesh.geometry.boundingSphere.radius));
    });
    assert.ok(meshes <= 60, `adventure mesh budget: ${meshes}`);
    assert.ok(triangles <= 30000, `adventure triangle budget: ${triangles}`);
    assert.ok(materials.size <= 12);
    for (const venue of adventure.children) {
      const size = new THREE.Box3().setFromObject(venue).getSize(new THREE.Vector3());
      assert.ok(size.x < 140 && size.z < 145, `${venue.name} remains a local culling unit`);
    }
    second.traverse(mesh => { if (mesh.isMesh) {
      assert.ok(!geometry.has(mesh.geometry)); assert.ok(!materials.has(mesh.material));
    } });
  } finally { dispose(adventure); dispose(second); }
});

test('timber and stone have owned physical-scale texture detail with a clear wet/dry contrast', () => {
  const a = createAdventureScenery(), b = createAdventureScenery(), maps = new Set();
  try {
    let checked = 0;
    a.traverse(mesh => {
      if (!mesh.isMesh || !mesh.material.userData.surface) return;
      checked++; maps.add(mesh.material.map);
      assert.equal(mesh.material.map, mesh.material.bumpMap);
      assert.ok(mesh.geometry.attributes.uv.array.every(Number.isFinite));
      assert.ok(new Set(mesh.geometry.attributes.uv.array).size > 3);
      if (mesh.material.userData.surface === 'water') assert.ok(mesh.material.roughness <= .3);
      else assert.ok(mesh.material.roughness >= .9);
    });
    b.traverse(mesh => { if (mesh.isMesh && mesh.material.map) assert.ok(!maps.has(mesh.material.map)); });
    assert.ok(checked > 15); assert.equal(maps.size, 5);
  } finally { dispose(a); dispose(b); }
});

test('actual roadside scenery stays outside the curved drive corridor and the whole loop', () => {
  const adventure = createAdventureScenery(), centers = [];
  for (let d = 250; d <= 1500; d += .5) centers.push(sampleTrack(d).position);
  const loop = new THREE.Box3();
  for (let d = 800; d <= 1040; d += .5) loop.expandByPoint(sampleTrack(d).position);
  loop.expandByVector(new THREE.Vector3(12, 17, 15)); loop.min.y = -Infinity; loop.max.y = Infinity;
  try {
    adventure.updateMatrixWorld(true);
    for (const venue of adventure.children) {
      const bounds = new THREE.Box3().setFromObject(venue);
      assert.ok(!bounds.intersectsBox(loop), `${venue.name} remains outside the loop overview`);
      const nearby = centers.filter(point => point.z >= bounds.min.z - 15 && point.z <= bounds.max.z + 15);
      venue.traverse(mesh => {
        if (!mesh.isMesh || mesh.userData.roadSurface) return;
        const positions = mesh.geometry.attributes.position, point = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
          const nearest = Math.min(...nearby.map(center => Math.hypot(point.x - center.x, point.z - center.z)));
          assert.ok(nearest >= 12.5, `${mesh.name} vertex enters the road corridor at ${point.toArray()} (${nearest})`);
        }
      });
    }
  } finally { dispose(adventure); }
});

test('scenic road panels stay above the real road triangles and leave the rails and boost strip readable', () => {
  const adventure = createAdventureScenery(), world = createWorld();
  const road = world.getObjectByName('molded-orange-skyway'); road.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), point = new THREE.Vector3();
  let checked = 0;
  try {
    adventure.traverse(mesh => {
      if (!mesh.isMesh || !mesh.userData.roadSurface) return;
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i);
        ray.set(point.clone().add(new THREE.Vector3(0, 1, 0)), down);
        const hit = ray.intersectObject(road, true)[0];
        assert.ok(hit, `${mesh.name} has road beneath every vertex`);
        const clearance = point.y - hit.point.y;
        assert.ok(clearance > .025 && clearance < .13, `road overlay clearance ${clearance}`);
        const distance = point.z > 950 ? point.z + 180 : point.z;
        const frame = sampleTrack(distance), lateral = point.clone().sub(frame.position).dot(frame.right);
        assert.ok(Math.abs(lateral) < 7.5, 'scenic panels leave the edge stripes and rails clear');
        if (Math.abs(distance - 355) < 6.1) assert.ok(Math.abs(lateral) > 6, 'bridge boost strip has a clean central background');
        checked++;
      }
    });
    assert.ok(checked > 500, 'checks the real tessellated surface geometry');
  } finally { dispose(adventure); /* world uses shared cached resources */ }
});

test('bridge rises smoothly while named clearings preserve the rest of the forest and loop', () => {
  const base = d => 1.5 + 1.2 * Math.sin(d / 150);
  for (const d of [309, 310, 375]) assert.ok(Math.abs(trackCenter(d).y - base(d)) < 1e-8);
  assert.ok(Math.abs(trackCenter(342.5).y - base(342.5) - 2.4) < 1e-8);
  for (const end of [310, 375]) {
    const before = trackCenter(end - .01).y, middle = trackCenter(end).y, after = trackCenter(end + .01).y;
    assert.ok(Math.abs((middle - before) - (after - middle)) < .00001, 'bridge endpoint has no slope kink');
  }
  for (const [distance, lateral] of [[350, 20], [650, -28], [1390, -30]]) assert.ok(isAdventureClearing(distance, lateral));
  for (const [distance, lateral] of [[100, 20], [650, 28], [900, -28], [1390, 90]]) assert.equal(isAdventureClearing(distance, lateral), false);
});

test('construction releases scratch geometries without disposing live buffers', () => {
  const disposed = new Set(), original = THREE.BufferGeometry.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function () { disposed.add(this); return original.call(this); };
  let adventure;
  try { adventure = createAdventureScenery(); } finally { THREE.BufferGeometry.prototype.dispose = original; }
  try {
    let meshes = 0;
    adventure.traverse(mesh => { if (mesh.isMesh) { meshes++; assert.ok(!disposed.has(mesh.geometry)); } });
    assert.ok(disposed.size > meshes * 2, 'temporary primitives and transformed parts are released');
  } finally { dispose(adventure); }
});

test('waterfall surfaces are curved and smoothly shaded without transparent overdraw', () => {
  const adventure = createAdventureScenery(), falls = adventure.getObjectByName('gator-falls');
  try {
    const water = falls.children.find(mesh => mesh.name === 'gator-falls-water-detail');
    assert.ok(water && water.material.vertexColors);
    assert.equal(water.material.transparent, false);
    assert.ok(water.material.roughness < .3, 'Water highlights remain distinct from the rough rock');
    const { normal, color } = water.geometry.attributes;
    assert.ok(color.array.some(value => value < .95), 'Water has subtle surface shading variation');
    const orientations = new Set();
    for (let i = 0; i < normal.count; i++) orientations.add([normal.getX(i), normal.getY(i), normal.getZ(i)].map(value => Math.round(value * 20)).join(','));
    assert.ok(orientations.size > 60, 'The visible falling sheets and rolling crest have continuously changing normals');
    assert.ok(water.geometry.attributes.position.count < 6500, 'Curved water keeps a bounded geometry cost');
  } finally { dispose(adventure); }
});
