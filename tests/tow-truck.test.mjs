import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TowTruck } from '../src/tow-truck.mjs';
import { sampleTrack } from '../src/track.mjs';

const raceAt = (side, elapsed = 1.5) => ({ phase: 'running', courseId: 'skyway', truckScale: 1.5, lane: side * 1.2,
  recovery: { phase: 'pull', distance: 118, fromLane: side * 2.4, toLane: 0, elapsed, duration: 3 } });
const snapshot = tow => { tow.group.updateMatrixWorld(true); const result = []; tow.group.traverse(object => result.push([object.id, object.visible, object.matrixWorld.toArray()])); return result; };

test('tow occupies the opposite supported shoulder and its actual cable ends meet the winch and vehicle side', () => {
  const tow = new TowTruck();
  try {
    for (const side of [-1, 1]) for (const lane of [side * 2.4, side * 1.2, 0]) {
      const race = raceAt(side); race.lane = lane; tow.update(1 / 60, race);
      const frame = sampleTrack(race.recovery.distance), inverse = new THREE.Matrix4().compose(frame.position, frame.quaternion, new THREE.Vector3(1, 1, 1)).invert();
      const point = new THREE.Vector3(); let minimum = Infinity, maximum = -Infinity;
      tow.truck.group.traverseVisible(mesh => { if (!mesh.isMesh) return; const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) { point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse); minimum = Math.min(minimum, point.x); maximum = Math.max(maximum, point.x); } });
      assert.ok(minimum > -18 && maximum < 18, `full rescue truck remains on the dirt shoulder: ${minimum}..${maximum}`);
      assert.ok(side > 0 ? minimum > 10 : maximum < -10, 'rescue truck stays clear of the recovering player and road lanes');
      const ends = [-.5, .5].map(y => new THREE.Vector3(0, y, 0).applyMatrix4(tow.cable.matrix));
      assert.ok(ends.some(point => point.distanceTo(tow.start) < 1e-6));
      assert.ok(ends.some(point => point.distanceTo(tow.end) < 1e-6));
      assert.equal(tow.group.visible, true);
    }
  } finally { tow.dispose(); }
});

test('tow uses only the rule clock and freezes exact poses on pause or invalid time, then clears on ready/reset', () => {
  const tow = new TowTruck();
  try {
    const race = raceAt(1); tow.update(1 / 60, race); const before = snapshot(tow);
    for (const dt of [0, -1, NaN, Infinity]) { tow.update(dt, { ...race, lane: 0, recovery: { ...race.recovery, elapsed: 2.5 } }); assert.deepEqual(snapshot(tow), before); }
    tow.update(.1, { ...race, phase: 'paused', lane: 0 }); assert.deepEqual(snapshot(tow), before);
    tow.update(1 / 60, { ...race, recovery: { ...race.recovery, phase: 'release', elapsed: 2.8 } }); assert.equal(tow.cable.visible, false);
    tow.update(0, { ...race, phase: 'ready' }); assert.equal(tow.group.visible, false);
    tow.update(1 / 60, race); tow.reset(); assert.equal(tow.group.visible, false); assert.equal(tow.diagnostics.phase, null);
  } finally { tow.dispose(); }
});

test('each tow instance owns its resources and disposes them exactly once without touching another instance', () => {
  const first = new TowTruck(), second = new TowTruck(), owned = new Set(), survivor = new Set(), counts = new Map();
  const resources = (tow, result) => tow.group.traverse(mesh => { if (mesh.isMesh) { result.add(mesh.geometry); [].concat(mesh.material).forEach(material => result.add(material)); } });
  resources(first, owned); resources(second, survivor);
  for (const resource of owned) { assert.ok(!survivor.has(resource)); counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1)); }
  let otherDisposals = 0; survivor.forEach(resource => resource.addEventListener('dispose', () => otherDisposals++));
  first.dispose(); first.dispose(); first.update(1 / 60, raceAt(1));
  assert.ok([...counts.values()].every(value => value === 1)); assert.equal(otherDisposals, 0); assert.equal(first.group.visible, false);
  second.update(1 / 60, raceAt(-1)); assert.equal(second.group.visible, true); second.dispose();
});
