import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BurstParticles } from '../src/burst-particles.mjs';
import { GameScene } from '../src/scene.mjs';

const running = Object.freeze({ phase: 'running', mode: 'race', reducedMotion: false });
const palette = [0xffd75e, 0xff805a, 0x79e5d9, 0xf9f0ca];

test('current scene context permits the first reward after leaving gentler motion without leaking menu effects', () => {
  const scene = new THREE.Scene(), bursts = new BurstParticles(scene);
  const target = Object.assign(Object.create(GameScene.prototype), {
    mode:'race', reducedMotion:true, bursts, truck:{group:new THREE.Group()},
  });
  try {
    bursts.update(1/60,{phase:'running',mode:'race',reducedMotion:true});
    target.crush();
    assert.equal(bursts.diagnostics.count,0);
    target.reducedMotion=false;
    // Main dispatches core events before this frame's visual update.
    target.crush();
    assert.equal(bursts.diagnostics.count,14);
    assert.ok(bursts.particles.filter(p=>p.life>0).every(p=>p.color.getHex()===0xffd75e));
    bursts.clear();target.mode='menu';
    bursts.update(1/60,{phase:'ready',mode:'menu'});
    assert.equal(target.burst(true,25),0);
    target.mode='race';
    assert.equal(target.burst(true,25),25);
    assert.equal(bursts.diagnostics.count,25);
  } finally { bursts.dispose(); }
});
const near = (actual, expected, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} should equal ${expected}`);

function fixture(random = () => .5) {
  const scene = new THREE.Scene(), bursts = new BurstParticles(scene, { random });
  return { scene, bursts };
}

function snapshot(bursts) {
  return { diagnostics: bursts.diagnostics, visible: bursts.mesh.visible,
    matrix: Array.from(bursts.mesh.instanceMatrix.array), colors: Array.from(bursts.mesh.instanceColor.array),
    matrixVersion: bursts.mesh.instanceMatrix.version, colorVersion: bursts.mesh.instanceColor.version,
    bound: { center: bursts.mesh.boundingSphere.center.toArray(), radius: bursts.mesh.boundingSphere.radius },
    particles: bursts.particles.map(p => ({ life: p.life, duration: p.duration, size: p.size, visible: p.mesh.visible,
      position: p.mesh.position.toArray(), rotation: p.mesh.rotation.toArray(), scale: p.mesh.scale.toArray(),
      v: p.v.toArray(), color: p.color.toArray(), paint: p.paint.toArray() })) };
}

test('the entire celebration pool owns one renderable mesh and fixed position/color buffers', () => {
  const { scene, bursts } = fixture();
  try {
    assert.deepEqual(scene.children, [bursts.mesh]);
    assert.equal(bursts.particles.length, 80);
    assert.equal(bursts.mesh.instanceMatrix.count, 80);
    assert.equal(bursts.mesh.instanceColor.count, 80);
    assert.equal(bursts.mesh.count, 0); assert.equal(bursts.mesh.visible, false);
    assert.equal(bursts.mesh.geometry, bursts.geometry); assert.equal(bursts.mesh.material, bursts.material);
    assert.equal(bursts.geometry.attributes.position.count / 3, 20);
    near(bursts.geometry.boundingSphere.radius, .16);
    assert.equal(bursts.material.roughness, .4); assert.equal(bursts.material.metalness, 0);
    assert.equal(bursts.mesh.castShadow, false); assert.equal(bursts.mesh.receiveShadow, false);
    bursts.particles.forEach((particle, index) => {
      assert.ok(particle.mesh.isObject3D && !particle.mesh.isMesh);
      assert.equal(particle.mesh.parent, null);
      assert.equal(particle.paint.getHex(), palette[index % palette.length]);
      assert.notEqual(particle.paint, particle.color);
    });
    assert.ok(Object.isFrozen(bursts.diagnostics));
    assert.equal(bursts.burst({ kind: 'celebrate', count: 200, origin: new THREE.Vector3() }), 80);
    assert.equal(bursts.mesh.count, 80);
    assert.equal(bursts.burst({ kind: 'reward', count: 8, origin: new THREE.Vector3() }), 0);
    assert.equal(bursts.mesh.count * bursts.geometry.attributes.position.count / 3, 1600);
  } finally { bursts.dispose(); }
});

test('dust, confetti and reward preserve the existing sampled dimensions, colors, gravity and spin', () => {
  for (const kind of ['celebrate', 'dust', 'reward']) {
    let index = 0;
    const { bursts } = fixture(() => [.2, .8, .1, .3, .6, .9][index++ % 6]);
    try {
      const origin = new THREE.Vector3(4, 5, 6);
      bursts.burst({ kind, count: 1, origin });
      const p = bursts.particles[0], dust = kind === 'dust';
      near(p.duration, dust ? .4 : .65); near(p.life, p.duration); near(p.size, dust ? 2.8 : 1.5);
      const initial = dust ? [5.5, 5.25, 4.4] : [4.3, 6, 5.6];
      p.mesh.position.toArray().forEach((value, axis) => near(value, initial[axis]));
      const velocity = dust ? [-1, 3.2, 2] : [-2.2, 6.8, 4.4];
      p.v.toArray().forEach((value, axis) => near(value, velocity[axis]));
      assert.equal(p.color.getHex(), dust ? 0xdfbb83 : 0xffd75e);
      assert.deepEqual(origin.toArray(), [4, 5, 6]);
      bursts.update(.05, running);
      near(p.life, p.duration - .05);
      near(p.v.y, velocity[1] - .6);
      p.mesh.position.toArray().forEach((value, axis) => near(value, initial[axis] + (axis === 1 ? velocity[axis] - .6 : velocity[axis]) * .05));
      near(p.mesh.rotation.x, .2); near(p.mesh.rotation.z, .15);
      near(p.mesh.scale.x, p.size * p.life / p.duration);
      const matrix = new THREE.Matrix4(), color = new THREE.Color();
      bursts.mesh.getMatrixAt(0, matrix); bursts.mesh.getColorAt(0, color);
      matrix.elements.forEach((value, offset) => near(value, p.mesh.matrix.elements[offset], .000001));
      near(color.r, p.color.r, .000001); near(color.g, p.color.g, .000001); near(color.b, p.color.b, .000001);
    } finally { bursts.dispose(); }
  }
});

test('expired slots compact active matrices and colors without attaching the inspection transforms', () => {
  const { scene, bursts } = fixture();
  try {
    bursts.burst({ kind: 'dust', count: 1, origin: new THREE.Vector3(-20, 2, 0) });
    bursts.update(.1, running);
    bursts.burst({ kind: 'celebrate', count: 3, origin: new THREE.Vector3(30, 5, 0) });
    for (let frame = 0; frame < 5; frame++) bursts.update(.1, running);
    assert.ok(bursts.particles[0].life <= 0 && !bursts.particles[0].mesh.visible);
    assert.equal(bursts.mesh.count, 3);
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    for (let index = 0; index < 3; index++) {
      bursts.mesh.getMatrixAt(index, matrix); bursts.mesh.getColorAt(index, color);
      matrix.elements.forEach((value, offset) => near(value, bursts.particles[index + 1].mesh.matrix.elements[offset], .000002));
      assert.equal(color.getHex(), palette[index + 1]);
    }
    const oldRotation = bursts.particles[0].mesh.rotation.clone();
    bursts.burst({ kind: 'reward', count: 1, origin: new THREE.Vector3() });
    assert.ok(bursts.particles[0].mesh.rotation.equals(oldRotation), 'Reused flakes retain their previous rotation as before');
    assert.equal(bursts.particles[0].color.getHex(), 0xffd75e);
    assert.deepEqual(scene.children, [bursts.mesh]);
  } finally { bursts.dispose(); }
});

test('paused and invalid frames freeze every state and GPU buffer even when modes or preferences change', () => {
  const { bursts } = fixture();
  try {
    bursts.burst({ kind: 'celebrate', count: 12, origin: new THREE.Vector3(0, 4, 0) });
    bursts.update(.05, running);
    const before = snapshot(bursts);
    for (const dt of [0, -1, NaN, Infinity, -Infinity]) bursts.update(dt, { phase: 'running', mode: 'menu', reducedMotion: true });
    bursts.update(.1, { phase: 'paused', mode: 'menu', reducedMotion: true });
    bursts.update(.1, { ...running, phase: 'ready' });
    assert.deepEqual(snapshot(bursts), before);
    bursts.update(.05, { ...running, phase: 'finished' });
    assert.notDeepEqual(snapshot(bursts), before, 'The finish celebration keeps moving after the race ends');
  } finally { bursts.dispose(); }
});

test('invalid emissions are harmless, inactive frames stay clean and unusually long frames remain bounded', () => {
  const { bursts } = fixture();
  try {
    const empty = snapshot(bursts);
    for (const count of [0, -1, .1, NaN, Infinity, '20']) assert.equal(bursts.burst({ count }), 0);
    assert.equal(bursts.burst({ kind: 'unknown' }), 0);
    assert.equal(bursts.burst({ origin: new THREE.Vector3(NaN, 0, 0) }), 0);
    bursts.update(.08, running);
    assert.deepEqual(snapshot(bursts), empty);
    bursts.burst({ kind: 'dust', count: 1, origin: new THREE.Vector3() });
    const initial = bursts.particles[0].life;
    bursts.update(1000, running);
    near(bursts.particles[0].life, initial - .1);
    assert.ok(bursts.mesh.instanceMatrix.array.every(Number.isFinite));
  } finally { bursts.dispose(); }
});

test('gentler and menu updates clear old bursts and suppress emission until normal race updates resume', () => {
  const { bursts } = fixture();
  try {
    for (const setting of [{ ...running, reducedMotion: true }, { ...running, mode: 'menu' }]) {
      bursts.burst({ kind: 'celebrate', count: 12, origin: new THREE.Vector3() });
      bursts.update(.05, setting);
      assert.equal(bursts.mesh.count, 0); assert.equal(bursts.mesh.visible, false);
      assert.ok(bursts.particles.every(p => p.life === 0 && !p.mesh.visible));
      assert.equal(bursts.burst({ kind: 'reward', count: 5, origin: new THREE.Vector3() }), 0);
      bursts.update(.05, running);
      assert.equal(bursts.burst({ kind: 'reward', count: 5, origin: new THREE.Vector3() }), 5);
      bursts.clear();
    }
  } finally { bursts.dispose(); }
});

test('every active vertex stays inside current culling bounds after spread, shrink and distant replay', () => {
  const { bursts } = fixture();
  try {
    const vertices = bursts.geometry.attributes.position, matrix = new THREE.Matrix4(), point = new THREE.Vector3();
    for (const origin of [new THREE.Vector3(-800, 200, 750), new THREE.Vector3(950, -20, -610)]) {
      bursts.clear();
      bursts.burst({ kind: 'celebrate', count: 80, origin });
      assert.ok(bursts.mesh.boundingSphere.center.distanceTo(origin) < 4, 'No stale faraway bound survives clear and replay');
      for (let frame = 0; frame < 70; frame++) {
        for (let instance = 0; instance < bursts.mesh.count; instance++) {
          bursts.mesh.getMatrixAt(instance, matrix);
          for (let vertex = 0; vertex < vertices.count; vertex++) {
            point.fromBufferAttribute(vertices, vertex).applyMatrix4(matrix);
            assert.ok(bursts.mesh.boundingSphere.containsPoint(point), 'Sphere includes the actual transformed icosahedron');
            assert.ok(bursts.mesh.boundingBox.containsPoint(point), 'Box includes the actual transformed icosahedron');
          }
        }
        bursts.update(1 / 60, running);
      }
      assert.equal(bursts.mesh.count, 0); assert.equal(bursts.mesh.visible, false);
    }
  } finally { bursts.dispose(); }
});

test('bursts and updates reuse every slot, buffer and resource, and dispose independently exactly once', () => {
  const { scene, bursts } = fixture(), other = new BurstParticles(scene);
  const particles = bursts.particles.slice(), transforms = particles.map(p => p.mesh), colors = particles.map(p => p.color);
  const matrix = bursts.mesh.instanceMatrix.array, color = bursts.mesh.instanceColor.array;
  const resources = [bursts.geometry, bursts.material, bursts.mesh], counts = new Map(resources.map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  let otherDisposals = 0;
  for (const resource of [other.geometry, other.material, other.mesh]) resource.addEventListener('dispose', () => otherDisposals++);
  for (let frame = 0; frame < 1000; frame++) {
    if (frame % 20 === 0) bursts.burst({ kind: ['dust', 'celebrate', 'reward'][frame % 3], count: 80, origin: new THREE.Vector3(frame, 4, 0) });
    if (frame % 70 === 0) bursts.clear();
    bursts.update(1 / 60, running);
  }
  assert.deepEqual(bursts.particles, particles);
  bursts.particles.forEach((p, index) => { assert.equal(p.mesh, transforms[index]); assert.equal(p.color, colors[index]); });
  assert.equal(bursts.mesh.instanceMatrix.array, matrix); assert.equal(bursts.mesh.instanceColor.array, color);
  bursts.dispose(); bursts.dispose(); bursts.clear(); bursts.update(.05, running);
  assert.equal(bursts.burst({ kind: 'celebrate', count: 20, origin: new THREE.Vector3() }), 0);
  assert.ok([...counts.values()].every(count => count === 1));
  assert.equal(otherDisposals, 0); assert.deepEqual(scene.children, [other.mesh]);
  assert.equal(bursts.diagnostics.disposed, true);
  other.dispose(); assert.equal(scene.children.length, 0);
});
