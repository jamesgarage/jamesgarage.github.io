import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TRUCKS } from '../src/core.mjs';
import { raceCrew } from '../src/crew.mjs';
import { VictoryCeremony } from '../src/victory-ceremony.mjs';

function participants(seed = 0, spec = TRUCKS[0], winnerId = 'player') {
  const entries = [{ id: 'player', kind: 'player', spec },
    ...raceCrew(seed).map(spec => ({ id: spec.id, kind: 'buddy', spec }))];
  return entries.map((entry, index) => Object.freeze({ ...entry,
    place: entry.id === winnerId ? 1 : 2 + entries.slice(0, index).filter(p => p.id !== winnerId).length }));
}

function matrices(ceremony) {
  const result = [];
  ceremony.group.traverse(object => result.push(...object.matrix.elements, ...object.matrixWorld.elements));
  return result;
}

function resources(group) {
  const result = new Set();
  group.traverse(object => {
    if (!object.isMesh) return;
    result.add(object.geometry);
    for (const material of [].concat(object.material)) result.add(material);
  });
  return result;
}

function finish(ceremony) {
  for (let i = 0; i < 100 && !ceremony.diagnostics.complete; i++) ceremony.update(.1);
  assert.equal(ceremony.diagnostics.complete, true);
}

test('every actual roster winner performs exactly four contacts, then all original toys return intact', () => {
  const ceremony = new VictoryCeremony();
  const observedWinners = new Set();
  try {
    for (let seed = 0; seed < 6; seed++) for (const candidate of participants(seed)) {
      const entries = participants(seed, TRUCKS[seed % TRUCKS.length], candidate.id);
      const before = JSON.stringify(entries);
      ceremony.start({ participants: entries, winnerId: candidate.id });
      observedWinners.add(candidate.id);
      assert.equal(ceremony.diagnostics.winnerId, candidate.id);
      assert.equal(ceremony.winner.truck.spec, entries.find(p => p.id === candidate.id).spec);
      const neutral = matrices(ceremony);
      assert.equal(ceremony.stomp(), true);
      assert.equal(ceremony.stomp(), false, 'Held/repeated action cannot restart an active sequence');
      let lastCount = 0;
      for (let frame = 0; frame < 300 && !ceremony.diagnostics.complete; frame++) {
        ceremony.update(.025);
        const current = ceremony.diagnostics;
        assert.ok(current.contactIds.length >= lastCount);
        if (current.contactIds.length > lastCount) {
          assert.equal(current.contactIds.length, lastCount + 1);
          const target = ceremony.losers[lastCount];
          assert.equal(ceremony.winner.root.position.x, target.root.position.x);
          assert.equal(ceremony.winner.root.position.z, target.root.position.z);
          assert.ok(Math.abs(ceremony.winner.root.position.y - (.068 + target.height * target.squash.scale.y)) < 1e-9,
            'Winner tire-contact plane meets the currently compressed toy roof');
          lastCount++;
        }
      }
      assert.equal(ceremony.diagnostics.complete, true);
      assert.equal(lastCount, 4);
      assert.equal(new Set(ceremony.diagnostics.contactIds).size, 4);
      assert.ok(!ceremony.diagnostics.contactIds.includes(candidate.id));
      assert.deepEqual(matrices(ceremony), neutral, 'All model transforms return exactly to their intact presentation');
      assert.equal(JSON.stringify(entries), before, 'Specs, places and identities remain unchanged');
      assert.ok(ceremony.actors.every(a => a.crush === 0 && a.squash.scale.equals(new THREE.Vector3(1, 1, 1))));
      assert.equal(ceremony.stomp(), true, 'Cosmetic replay is available');
      assert.equal(ceremony.diagnostics.stompCount, 2);
      assert.deepEqual(ceremony.diagnostics.contactIds, []);
      ceremony.skip();
    }
    assert.deepEqual([...observedWinners].sort(), ['player', 'sunny', 'splash', 'ember', 'pebble', 'bolt', 'digger'].sort());
  } finally { ceremony.dispose(); }
});

test('automatic demonstration waits two seconds and frozen/invalid updates cannot advance any pose or preference', () => {
  const ceremony = new VictoryCeremony();
  try {
    ceremony.start({ participants: participants(), winnerId: 'player' });
    for (let i = 0; i < 19; i++) ceremony.update(.1);
    assert.equal(ceremony.diagnostics.phase, 'ready');
    assert.equal(ceremony.diagnostics.stompCount, 0);
    const before = { diagnostics: ceremony.diagnostics, matrices: matrices(ceremony), reducedMotion: ceremony.reducedMotion };
    for (const dt of [0, -1, NaN, Infinity, -Infinity]) ceremony.update(dt, { reducedMotion: true });
    ceremony.update(.1, { paused: true, reducedMotion: true });
    assert.deepEqual({ diagnostics: ceremony.diagnostics, matrices: matrices(ceremony), reducedMotion: ceremony.reducedMotion }, before);
    ceremony.update(.1);
    assert.equal(ceremony.diagnostics.phase, 'stomping');
    assert.equal(ceremony.diagnostics.stompCount, 1);
    ceremony.update(100);
    assert.ok(ceremony.diagnostics.elapsed <= .1, 'A resumed browser frame cannot skip the ceremony');
    const moving = { diagnostics: ceremony.diagnostics, matrices: matrices(ceremony) };
    ceremony.update(.1, { paused: true });
    assert.deepEqual({ diagnostics: ceremony.diagnostics, matrices: matrices(ceremony) }, moving);
    finish(ceremony);
    for (let i = 0; i < 40; i++) ceremony.update(.1);
    assert.equal(ceremony.diagnostics.stompCount, 1, 'Automatic demonstration runs once');
  } finally { ceremony.dispose(); }
});

test('gentler motion preserves four contacts with smaller arcs and no restoration overshoot', () => {
  const ordinary = new VictoryCeremony(), gentle = new VictoryCeremony();
  try {
    for (const ceremony of [ordinary, gentle]) {
      ceremony.start({ participants: participants(1, TRUCKS[7], 'splash'), winnerId: 'splash', reducedMotion: ceremony === gentle });
      ceremony.stomp();
    }
    for (let i = 0; i < 3; i++) { ordinary.update(.1); gentle.update(.1); }
    assert.ok(ordinary.winner.root.position.y - gentle.winner.root.position.y > 1.5);
    assert.equal(gentle.winner.root.rotation.x, 0);
    finish(ordinary); finish(gentle);
    assert.deepEqual(ordinary.diagnostics.contactIds, gentle.diagnostics.contactIds);
    assert.ok(gentle.actors.every(actor => actor.crush === 0 && actor.squash.scale.y === 1));
    assert.equal(gentle.reducedMotion, true, 'Omitted update option preserves the start preference');
  } finally { ordinary.dispose(); gentle.dispose(); }
});

test('skip and reset restore or discard toys safely from every animation interval', () => {
  const ceremony = new VictoryCeremony();
  try {
    for (const updates of [0, 3, 9, 17, 28, 41, 49, 55]) {
      ceremony.start({ participants: participants(2), winnerId: 'player' });
      const neutral = matrices(ceremony);
      ceremony.stomp();
      for (let i = 0; i < updates; i++) ceremony.update(.1);
      ceremony.skip();
      assert.equal(ceremony.diagnostics.complete, true);
      assert.deepEqual(matrices(ceremony), neutral);
      ceremony.reset();
      assert.equal(ceremony.diagnostics.active, false);
      assert.deepEqual(ceremony.diagnostics.participants, []);
      assert.equal(ceremony.group.visible, false);
      assert.equal(ceremony.stomp(), false);
    }
  } finally { ceremony.dispose(); }
});

test('owned geometry is finite and bounded; every player fits portrait and landscape results-safe framing', () => {
  const ceremony = new VictoryCeremony();
  const corner = new THREE.Vector3();
  try {
    for (const spec of TRUCKS) {
      ceremony.start({ participants: participants(0, spec), winnerId: 'player' });
      let meshes = 0, triangles = 0;
      ceremony.group.traverseVisible(object => {
        if (!object.isMesh) return;
        meshes++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
        for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      });
      assert.ok(meshes < 125, `${spec.id}: ${meshes} visible meshes`);
      assert.ok(triangles < 120000, `${spec.id}: ${triangles} visible triangles`);
      for (const [width, height] of [[1024, 768], [768, 1024], [390, 844], [844, 390]]) {
        ceremony.resize(width, height); ceremony.stomp();
        const short = width > height && height < 560;
        const left = 16, right = short ? Math.min(320, width * .38) + 16 : 16;
        const top = short ? 65 : Math.min(120, height * .2);
        const bottom = short ? 18 : Math.min(width < height ? 280 : 210, height * .4);
        for (let frame = 0; frame < 58; frame++) {
          ceremony.update(.1);
          for (const actor of ceremony.actors) actor.root.traverseVisible(object => {
            if (!object.isMesh) return;
            const box = object.geometry.boundingBox;
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
              corner.set(x, y, z).applyMatrix4(object.matrixWorld).project(ceremony.camera);
              const px = (corner.x + 1) * width / 2, py = (1 - corner.y) * height / 2;
              assert.ok(px >= left - 1 && px <= width - right + 1 && py >= top - 1 && py <= height - bottom + 1,
                `${spec.id} ${width}x${height}: actor ${actor.entry.id} projects to ${px.toFixed(1)},${py.toFixed(1)}`);
              assert.ok(corner.z >= -1 && corner.z <= 1);
            }
          });
        }
      }
    }
  } finally { ceremony.dispose(); }
});

test('model replacement and repeated disposal release only owned resources, preserving borrowed environment and attachments', () => {
  const environment = new THREE.Texture(); let environmentDisposals = 0;
  environment.addEventListener('dispose', () => environmentDisposals++);
  const ceremony = new VictoryCeremony({ environment });
  const stage = resources(ceremony.group), counts = new Map();
  const track = collection => { for (const resource of collection) {
    if (counts.has(resource)) continue;
    counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  } };
  track(stage);
  for (let seed = 0; seed < 6; seed++) {
    ceremony.start({ participants: participants(seed, TRUCKS[seed]), winnerId: 'player' });
    track(resources(ceremony.group));
    ceremony.stomp(); ceremony.update(.1);
  }
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  const borrowed = new THREE.Mesh(geometry, material); let borrowedDisposals = 0;
  geometry.addEventListener('dispose', () => borrowedDisposals++); material.addEventListener('dispose', () => borrowedDisposals++);
  ceremony.group.add(borrowed);
  ceremony.dispose(); ceremony.dispose(); ceremony.reset(); ceremony.update(.1);
  assert.ok([...counts.values()].every(count => count === 1));
  assert.equal(environmentDisposals, 0); assert.equal(borrowedDisposals, 0);
  assert.equal(ceremony.scene.environment, null);
  assert.equal(ceremony.start({ participants: participants(), winnerId: 'player' }), false);
  geometry.dispose(); material.dispose(); environment.dispose();
});

test('invalid final participants cannot silently substitute a winner or disturb an existing ceremony', () => {
  const ceremony = new VictoryCeremony();
  try {
    ceremony.start({ participants: participants(), winnerId: 'player' });
    const before = ceremony.diagnostics;
    for (const options of [{ participants: [], winnerId: 'player' },
      { participants: participants(), winnerId: 'missing' },
      { participants: participants().map(p => ({ ...p, id: 'same' })), winnerId: 'same' }]) {
      assert.throws(() => ceremony.start(options), TypeError);
      assert.deepEqual(ceremony.diagnostics, before);
    }
  } finally { ceremony.dispose(); }
});
