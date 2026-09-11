import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BuddySignals } from '../src/buddy-signals.mjs';

test('pictorial reactions follow their own trucks, face the camera and freeze during pause', () => {
  const scene = new THREE.Scene(), signals = new BuddySignals(scene);
  const camera = new THREE.PerspectiveCamera(); camera.position.set(12, 10, 30); camera.lookAt(0, 0, 0);
  const trucks = [0, 1].map(i => ({ group: new THREE.Group() }));
  trucks[1].group.position.set(8, 0, -6);
  const race = { phase: 'running', distance: 40 };
  const poses = [{ distance: 30, signal: 'star', signalTime: 1.4 }, { distance: 26, signal: 'jump', signalTime: 1.1 }];
  try {
    signals.update(.016, { race, poses, trucks, camera });
    assert.equal(signals.visibleCount, 2);
    assert.ok(signals.badges[1].position.x > signals.badges[0].position.x);
    assert.ok(signals.badges.every(badge => badge.quaternion.angleTo(camera.quaternion) < 1e-7));
    const snapshot = () => signals.badges.map(b => ({ position: b.position.toArray(), rotation: b.quaternion.toArray(), scale: b.scale.toArray(), visible: b.visible, signal: b.userData.signal }));
    const frozen = snapshot();
    poses[0].signal = 'turbo'; trucks[0].group.position.x = 90;
    for (const dt of [0, NaN, -1, Infinity]) { signals.update(dt, { race, poses, trucks, camera }); assert.deepEqual(snapshot(), frozen); }
    signals.update(.016, { race: { ...race, phase: 'paused' }, poses, trucks, camera });
    assert.deepEqual(snapshot(), frozen);
    signals.update(.016, { race, poses, trucks, camera, reducedMotion: true });
    assert.ok(signals.badges.every(b => b.scale.x === .66));
    signals.update(.016, { race, poses: poses.map(p => ({ ...p, distance: 900 })), trucks, camera });
    assert.equal(signals.visibleCount, 0, 'Keep the guided loop overview clear');
  } finally { signals.dispose(); }
});

test('signals reuse their resources, reset cleanly and dispose independently once', () => {
  const scene = new THREE.Scene(), first = new BuddySignals(scene), second = new BuddySignals(scene);
  const counts = new Map([...first.geometries, ...first.materials].map(resource => [resource, 0]));
  for (const resource of counts.keys()) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  let otherDisposals = 0;
  for (const resource of [...second.geometries, ...second.materials]) resource.addEventListener('dispose', () => otherDisposals++);
  const original = [...first.geometries];
  for (let i = 0; i < 100; i++) first.reset();
  assert.deepEqual([...first.geometries], original);
  assert.equal(first.visibleCount, 0);
  first.dispose(); first.dispose(); first.reset();
  assert.ok([...counts.values()].every(count => count === 1));
  assert.equal(otherDisposals, 0);
  assert.ok(second.badges.every(b => b.parent === scene));
  second.dispose(); assert.equal(scene.children.length, 0);
});
