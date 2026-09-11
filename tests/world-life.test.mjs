import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldLife } from '../src/world-life.mjs';
import { sampleTrack } from '../src/track.mjs';
import { isAdventureClearing } from '../src/adventure.mjs';

function visualState(life) {
  const state = [];
  life.group.traverse(mesh => {
    if (!mesh.isInstancedMesh) return;
    state.push({ matrix: Array.from(mesh.instanceMatrix.array), version: mesh.instanceMatrix.version,
      color: mesh.instanceColor && Array.from(mesh.instanceColor.array), colorVersion: mesh.instanceColor?.version, visible: mesh.visible });
  });
  return state;
}
const running = { race: Object.freeze({ phase: 'running', distance: 100 }), mode: 'race' };

test('ambient life is reproducible, varies only its accents, and reuses every GPU buffer on replay', () => {
  const a = new WorldLife(new THREE.Scene()), b = new WorldLife(new THREE.Scene());
  try {
    a.reset(27); b.reset(27);
    assert.deepEqual(visualState(a), visualState(b));
    for (let i = 0; i < 240; i++) { a.update(1 / 60, running); b.update(1 / 60, running); }
    assert.deepEqual(visualState(a), visualState(b));
    const anchors = a.habitats.map(habitat => habitat.group.position.toArray());
    const buffers = a.habitats.flatMap(habitat => habitat.group.children.map(mesh => mesh.instanceMatrix.array));
    const old = a.habitats.map(habitat => habitat.accents.slice());
    for (let variant = 0; variant < 80; variant++) a.reset(variant);
    assert.notDeepEqual(a.habitats.map(habitat => habitat.accents), old);
    assert.deepEqual(a.habitats.map(habitat => habitat.group.position.toArray()), anchors);
    a.habitats.flatMap(habitat => habitat.group.children.map(mesh => mesh.instanceMatrix.array)).forEach((buffer, i) => assert.equal(buffer, buffers[i]));
    assert.equal(a.diagnostics.meshes, 20); assert.equal(a.diagnostics.geometries, 5);
    assert.ok(Object.isFrozen(a.diagnostics));
  } finally { a.dispose(); b.dispose(); }
});

test('paused, zero, invalid and gentler-motion updates freeze every visible buffer and timer', () => {
  const life = new WorldLife(new THREE.Scene());
  try {
    life.update(.1, running); const before = visualState(life), time = life.time;
    for (const dt of [0, -1, NaN, Infinity]) life.update(dt, running);
    for (const phase of ['paused', 'finished', 'ready']) life.update(.1, { ...running, race: { phase } });
    for (let i = 0; i < 240; i++) life.update(.1, { ...running, reducedMotion: true });
    assert.deepEqual(visualState(life), before); assert.equal(life.time, time);
    life.update(.1, { mode: 'menu' }); assert.notDeepEqual(visualState(life), before, 'the menu can show gentle life');
    life.reset(Infinity); assert.equal(life.variant, 0); assert.equal(life.time, 0);
  } finally { life.dispose(); }
});

test('animated habitat geometry remains clear of the real road, named landmarks and loop', () => {
  const life = new WorldLife(new THREE.Scene()), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  try {
    const samples = life.habitats.map(habitat => {
      assert.equal(isAdventureClearing(habitat.distance, habitat.lateral), false);
      assert.ok(habitat.distance < 780 || habitat.distance > 1060);
      return Array.from({ length: 97 }, (_, i) => sampleTrack(habitat.distance - 24 + i * .5).position);
    });
    let triangles = 0;
    life.group.traverse(mesh => { if (mesh.isMesh) triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * mesh.count; });
    assert.ok(triangles < 2500, `bounded full-course ambient geometry: ${triangles}`);
    for (let frame = 0; frame < 120; frame++) {
      life.update(.1, running); life.group.updateMatrixWorld(true);
      for (const [index, habitat] of life.habitats.entries()) for (const mesh of habitat.group.children) {
        const positions = mesh.geometry.attributes.position;
        for (let instance = 0; instance < mesh.count; instance++) {
          mesh.getMatrixAt(instance, matrix); matrix.premultiply(mesh.matrixWorld);
          for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
            assert.ok(point.toArray().every(Number.isFinite));
            const nearest = Math.min(...samples[index].map(center => Math.hypot(point.x - center.x, point.z - center.z)));
            assert.ok(nearest > 12.5, `${mesh.name} stays outside the guardian corridor: ${nearest}`);
          }
        }
      }
    }
  } finally { life.dispose(); }
});

test('each world-life instance owns its resources and disposal is complete and idempotent', () => {
  const scene = new THREE.Scene(), a = new WorldLife(scene), b = new WorldLife(scene), resources = [...a.geometries, ...a.materials];
  const disposed = new Map(resources.map(resource => [resource, 0]));
  resources.forEach(resource => resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1)));
  a.group.traverse(mesh => { if (mesh.isInstancedMesh) { disposed.set(mesh, 0); mesh.addEventListener('dispose', () => disposed.set(mesh, disposed.get(mesh) + 1)); } });
  for (const resource of [...b.geometries, ...b.materials]) assert.ok(!disposed.has(resource));
  a.dispose(); a.dispose(); a.reset(7); a.update(.1, running);
  assert.ok([...disposed.values()].every(count => count === 1));
  assert.equal(a.group.parent, null); assert.equal(a.group.children.length, 0); assert.equal(a.diagnostics.meshes, 0);
  b.update(.1, running); assert.equal(b.group.parent, scene); assert.ok(b.time > 0); b.dispose();
});
