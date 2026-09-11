import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShoreBankGeometry } from '../src/shore-banks.mjs';
import { createWorld } from '../src/world.mjs';
import { sampleTrack } from '../src/track.mjs';
import { isAdventureClearing } from '../src/adventure.mjs';

test('the irregular bank has a bounded smooth surface with 160 upward-facing triangles', () => {
  const geometry = createShoreBankGeometry(), second = createShoreBankGeometry();
  try {
    const { position, normal, color, uv } = geometry.attributes;
    assert.equal(position.count, 97); assert.equal(geometry.index.count / 3, 160);
    for (const attribute of [position, normal, color, uv]) assert.ok(attribute.array.every(Number.isFinite));
    assert.notEqual(position.array, second.attributes.position.array);
    assert.deepEqual(position.array, second.attributes.position.array);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3();
    for (let index = 0; index < geometry.index.count; index += 3) {
      a.fromBufferAttribute(position, geometry.index.getX(index));
      b.fromBufferAttribute(position, geometry.index.getX(index + 1));
      c.fromBufferAttribute(position, geometry.index.getX(index + 2));
      cross.crossVectors(b.sub(a), c.sub(a));
      assert.ok(cross.y > .001, 'triangles have a nondegenerate upward-facing winding');
    }
    const outerRadii = [];
    for (let index = 0; index < position.count; index++) {
      assert.ok(Math.hypot(position.getX(index), position.getZ(index)) <= 1.000001);
      assert.ok(normal.getY(index) > 0 && normal.getY(index) <= 1);
      if (position.getY(index) === 0) outerRadii.push(Math.hypot(position.getX(index), position.getZ(index)));
    }
    assert.ok(Math.max(...outerRadii) - Math.min(...outerRadii) > .08, 'shore outline is visibly irregular');
    const waterline = (-1.7 + 2.05) / (-1.2 + .04 + 2.05), waterRadii = [];
    for (let triangle = 0; triangle < geometry.index.count; triangle += 3) for (let edge = 0; edge < 3; edge++) {
      a.fromBufferAttribute(position, geometry.index.getX(triangle + edge));
      b.fromBufferAttribute(position, geometry.index.getX(triangle + (edge + 1) % 3));
      if ((a.y - waterline) * (b.y - waterline) < 0) {
        c.lerpVectors(a, b, (waterline - a.y) / (b.y - a.y)); waterRadii.push(Math.hypot(c.x, c.z));
      }
    }
    assert.ok(Math.max(...waterRadii) - Math.min(...waterRadii) > .07, 'visible shoreline varies, not only the submerged outer rim');
    assert.ok(color.getX(0) > color.getX(position.count - 1), 'dry and wet sand retain a soft color difference');
  } finally { geometry.dispose(); second.dispose(); }
});

test('batched shores fit their prior island envelopes and ground actual palm bases and gator feet', () => {
  const world = createWorld(), banks = world.userData.shoreBanks, shores = [], solids = [];
  world.updateMatrixWorld(true);
  world.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.userData.shore) shores.push(mesh);
    else if (mesh.parent?.name.startsWith('scenery-chunk-')) solids.push(mesh);
  });
  const solidBounds = solids.map(mesh => {
    mesh.geometry.computeBoundingBox();
    return { mesh, bounds: mesh.geometry.boundingBox.clone().expandByScalar(.001) };
  });
  const primitive = createShoreBankGeometry(), point = new THREE.Vector3(), matrix = new THREE.Matrix4();
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  let palms = 0, gators = 0, contacts = 0;
  try {
    assert.ok(Object.isFrozen(banks) && banks.length > 40); assert.ok(shores.length > 3 && shores.length < 12);
    assert.equal(shores.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count / 3, 0), banks.length * 160);
    assert.equal(new Set(shores.map(mesh => mesh.material)).size, 1, 'all bank batches share one sand material');
    for (const shore of shores) {
      assert.ok(shore.frustumCulled && shore.material.vertexColors && shore.material.roughness >= .9);
      assert.equal(shore.material.map, null, 'shore colors need no additional texture');
      for (const attribute of Object.values(shore.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      assert.equal(shore.geometry.attributes.position.count, shore.geometry.attributes.color.count);
    }
    for (const bank of banks) {
      if (bank.kind === 'palm') palms++; else gators++;
      matrix.fromArray(bank.matrix);
      const frame = sampleTrack(bank.distance), lateral = new THREE.Vector3(...bank.center).sub(frame.position).dot(frame.right);
      assert.equal(isAdventureClearing(bank.distance, lateral), false);
      assert.ok(bank.distance > 1110);
      for (let index = 0; index < primitive.attributes.position.count; index++) {
        point.fromBufferAttribute(primitive.attributes.position, index).applyMatrix4(matrix);
        const radius = ((point.x - bank.center[0]) / bank.oldRadius[0]) ** 2 + ((point.z - bank.center[2]) / bank.oldRadius[1]) ** 2;
        assert.ok(radius <= 1.00001, `${bank.kind} bank expands its previous island envelope`);
        if (primitive.attributes.position.getY(index) === 0) assert.ok(point.y < -1.9, 'outer rim is submerged rather than coplanar with water');
      }
      assert.ok(bank.contacts.length >= (bank.kind === 'palm' ? 10 : 4));
      for (const contact of bank.contacts) {
        point.set(...contact);
        ray.set(point.clone().add(new THREE.Vector3(0, 2, 0)), down);
        const hit = ray.intersectObjects(shores, false)[0];
        assert.ok(hit, `${bank.kind} at ${bank.distance} has real sand beneath every contact point`);
        const embed = hit.point.y - point.y;
        assert.ok(embed >= -.012 && embed <= .14, `${bank.kind} floats or sinks at ${bank.distance}: ${embed}`);
        // The retained samples must still be vertices in the actual final model
        // batches, so metadata cannot conceal a moved trunk or foot.
        let actual = false;
        for (const { mesh, bounds } of solidBounds) {
          if (!bounds.containsPoint(point)) continue;
          const positions = mesh.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            if ((positions.getX(i) - point.x) ** 2 + (positions.getY(i) - point.y) ** 2 + (positions.getZ(i) - point.z) ** 2 < 1e-8) { actual = true; break; }
          }
          if (actual) break;
        }
        assert.ok(actual, 'contact sample belongs to actual merged trunk/foot geometry'); contacts++;
      }
    }
    assert.ok(palms > 30 && gators > 5 && contacts > 400);
  } finally { primitive.dispose(); }
});

test('every actual bank triangle edge clears the curved road, including all close gator banks', () => {
  const world = createWorld(), centers = [], a = new THREE.Vector3(), b = new THREE.Vector3(), point = new THREE.Vector3();
  for (let distance = 1080; distance <= 2080; distance += .5) centers.push(sampleTrack(distance).position);
  world.updateMatrixWorld(true);
  let minimum = Infinity, checked = 0;
  world.traverse(mesh => {
    if (!mesh.userData.shore) return;
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    const road = centers.filter(center => center.z >= bounds.min.z - 15 && center.z <= bounds.max.z + 15);
    const positions = mesh.geometry.attributes.position;
    for (let triangle = 0; triangle < positions.count; triangle += 3) for (let edge = 0; edge < 3; edge++) {
      a.fromBufferAttribute(positions, triangle + edge).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(positions, triangle + (edge + 1) % 3).applyMatrix4(mesh.matrixWorld);
      const steps = Math.max(1, Math.ceil(a.distanceTo(b) / .5));
      for (let sample = 0; sample <= steps; sample++) {
        point.lerpVectors(a, b, sample / steps);
        let nearest = Infinity;
        for (const center of road) nearest = Math.min(nearest, (point.x - center.x) ** 2 + (point.z - center.z) ** 2);
        minimum = Math.min(minimum, Math.sqrt(nearest));
        assert.ok(nearest >= 10 ** 2, `bank crosses the road clearance at ${point.toArray()}: ${Math.sqrt(nearest)}`);
        assert.ok(point.y < -.65, 'low shores never become raised roadside obstructions'); checked++;
      }
    }
  });
  assert.ok(checked > 100000); assert.ok(minimum >= 10 && minimum < 13, 'the close gator banks are included');
});

test('shore builds are deterministic and reuse cached sand without sharing owned merged geometry', () => {
  const a = createWorld(), b = createWorld(), first = [], second = [];
  a.traverse(mesh => { if (mesh.userData.shore) first.push(mesh); });
  b.traverse(mesh => { if (mesh.userData.shore) second.push(mesh); });
  assert.deepEqual(a.userData.shoreBanks, b.userData.shoreBanks);
  assert.equal(first.length, second.length);
  first.forEach((mesh, index) => {
    assert.equal(mesh.material, second[index].material, 'material belongs to the existing world cache');
    assert.notEqual(mesh.geometry, second[index].geometry);
    assert.deepEqual(mesh.geometry.attributes.position.array, second[index].geometry.attributes.position.array);
    assert.deepEqual(mesh.geometry.attributes.color.array, second[index].geometry.attributes.color.array);
  });
});
