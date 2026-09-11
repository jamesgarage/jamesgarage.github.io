import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RaceWeather } from '../src/weather.mjs';
import { sampleTrack, laneOffset } from '../src/track.mjs';
import { RAMPS, LOOP_START, LOOP_END, TRUCKS } from '../src/core.mjs';
import { makeTruck, disposeTruck } from '../src/models.mjs';

function rig(distance = 1245, spec = TRUCKS[0]) {
  const scene = new THREE.Scene(), group = new THREE.Group();
  group.scale.setScalar(spec.scale);
  const wheels = [-1.5, 1.5].flatMap(z => [-1, 1].map(side => {
    const wheel = new THREE.Group(); wheel.position.set(side * 1.65, 1.05, z); group.add(wheel); return wheel;
  }));
  scene.add(group);
  const target = { scene, truck: { group, wheels }, weather: new RaceWeather(scene), race: { phase: 'running', distance, lane: 0, height: 0, velocityY: 0 } };
  pose(target);
  return target;
}
function pose({ truck, race }) {
  const frame = sampleTrack(race.distance);
  truck.group.position.copy(frame.position).addScaledVector(frame.right, laneOffset(race.lane)).addScaledVector(frame.up, race.height);
  truck.group.quaternion.copy(frame.quaternion);
}
function update(target, dt = 1 / 60, overrides = {}) {
  target.weather.update(dt, { truck: target.truck, race: target.race, mode: 'race', reducedMotion: false, ...overrides });
}
function snapshot(weather) {
  return {
    rain: Array.from(weather.rain.geometry.attributes.position.array),
    spray: Array.from(weather.spray.instanceMatrix.array),
    lives: weather.particles.map(p => p.life),
    emission: weather.emission, time: weather.time, count: weather.spray.count,
    rainVersion: weather.rain.geometry.attributes.position.version,
    sprayVersion: weather.spray.instanceMatrix.version,
  };
}

test('mud is a shallow sampled road ribbon with clear rails and no ramps or loop', () => {
  const { weather } = rig();
  const geometry = weather.mud.geometry, positions = geometry.attributes.position.array;
  assert.ok(positions.every(Number.isFinite));
  assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
  assert.equal(weather.group.children.length, 3);
  assert.ok(geometry.index.count / 3 < 2000);
  const point = new THREE.Vector3();
  for (let index = 0; index < positions.length / 3; index++) {
    const distance = geometry.userData.trackSamples[index * 2], lateral = geometry.userData.trackSamples[index * 2 + 1];
    assert.ok(Math.abs(lateral) <= 7.4, 'mud leaves the road rail and edge stripe clear');
    assert.ok(distance < LOOP_START || distance > LOOP_END);
    assert.ok(RAMPS.every(ramp => distance < ramp - 24 || distance > ramp + 38));
    const frame = sampleTrack(distance);
    point.fromArray(positions, index * 3).sub(frame.position);
    assert.ok(Math.abs(point.dot(frame.up) - .045) < .0001, 'each vertex follows the bank and road height');
    assert.ok(Math.abs(point.dot(frame.right) - lateral) < .0001);
  }
  assert.ok(weather.mud.material.polygonOffset);
  weather.dispose();
});

test('rain fades at both bay edges and never changes lighting or the race', () => {
  const target = rig(), { weather } = target;
  const opacities = [];
  for (const distance of [1189, 1190, 1210, 1230, 1330, 1430, 1450, 1470, 1480]) {
    target.race.distance = distance; pose(target);
    const state = JSON.stringify(target.race);
    update(target);
    opacities.push(weather.rain.material.opacity);
    assert.equal(JSON.stringify(target.race), state);
    assert.ok(weather.rain.geometry.attributes.position.array.every(Number.isFinite));
  }
  assert.deepEqual(opacities, [0, 0, .19, .38, .38, .38, .19, 0, 0]);
  assert.ok(weather.rain.isLineSegments);
  assert.equal(weather.rain.geometry.attributes.position.count, 192);
  assert.equal(target.scene.children.length, 2);
  weather.dispose();
});

test('mud stays above the actual two-unit road triangles without a raised obstacle', () => {
  const { weather } = rig(), geometry = weather.mud.geometry;
  const point = new THREE.Vector3(), hit = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  const ray = new THREE.Ray();
  for (let index = 0; index < geometry.attributes.position.count; index++) {
    point.fromBufferAttribute(geometry.attributes.position, index);
    ray.origin.copy(point).y += 1; ray.direction.copy(down);
    const distance = geometry.userData.trackSamples[index * 2];
    let clearance = Infinity;
    // makeRoad uses two-unit station spacing and the same diagonal split.
    for (let station = Math.floor(distance / 2) * 2 - 2; station <= distance + 2; station += 2) {
      const f0 = sampleTrack(station), f1 = sampleTrack(station + 2);
      const a = f0.position.clone().addScaledVector(f0.right, -8.5);
      const b = f1.position.clone().addScaledVector(f1.right, -8.5);
      const c = f0.position.clone().addScaledVector(f0.right, 8.5);
      const d = f1.position.clone().addScaledVector(f1.right, 8.5);
      for (const triangle of [[a, b, c], [c, b, d]]) {
        if (ray.intersectTriangle(...triangle, false, hit)) clearance = Math.min(clearance, point.y - hit.y);
      }
    }
    assert.ok(clearance > .035 && clearance < .055, `mud clearance ${clearance} at station ${distance}`);
  }
  weather.dispose();
});

test('dt zero and paused frames preserve every buffer and the fractional emission', () => {
  const target = rig();
  update(target, .08);
  assert.ok(target.weather.spray.count > 0 && target.weather.rain.visible);
  const before = snapshot(target.weather);
  for (let frame = 0; frame < 30; frame++) update(target, 0);
  assert.deepEqual(snapshot(target.weather), before);
  target.race.phase = 'paused';
  for (let frame = 0; frame < 30; frame++) update(target, .08);
  assert.deepEqual(snapshot(target.weather), before);
  target.race.phase = 'running'; update(target);
  assert.notDeepEqual(snapshot(target.weather), before);
  target.weather.dispose();
});

test('grounded tires spray on mud but never on clean road or during jumps', () => {
  const target = rig();
  for (const distance of [230, 267, 1245, 1297]) {
    target.weather.reset(); target.race.distance = distance; pose(target); update(target, .06);
    assert.equal(target.weather.spray.count, 4, `four tire contacts at ${distance}`);
  }
  for (const state of [{ distance: 310, height: 0 }, { distance: 1245, height: 3 }, { distance: 1245, height: 0, velocityY: 10 }]) {
    target.weather.reset(); Object.assign(target.race, state); pose(target); update(target, .06);
    assert.equal(target.weather.spray.count, 0);
  }
  target.weather.dispose();
});

test('spray contact follows actual tire positions for all truck scales and widened guardian wheels', () => {
  for (const spec of TRUCKS) {
    const target = rig(1245, spec);
    target.scene.remove(target.truck.group);
    target.truck = makeTruck(spec); target.scene.add(target.truck.group);
    target.truck.body.position.y = 1.8;
    for (const wheel of target.truck.wheels) {
      wheel.position.x = Math.sign(wheel.position.x) * 2.35;
      wheel.rotation.x = 1.3;
    }
    pose(target); update(target, .06);
    const live = target.weather.particles.filter(p => p.life > 0);
    assert.equal(live.length, 4);
    for (let index = 0; index < live.length; index++) {
      const wheel = target.truck.wheels[index];
      const expected = new THREE.Vector3(wheel.position.x, .10, wheel.position.z - .28).applyMatrix4(target.truck.group.matrixWorld);
      assert.ok(live[index].position.distanceTo(expected) < .00001, `${spec.id} contact remains at the tire rather than the lifted body`);
      assert.ok(live[index].size >= spec.scale * .1 - 1e-8 && live[index].size <= spec.scale * .15 + 1e-8);
    }
    target.weather.dispose(); disposeTruck(target.truck);
  }
});

test('menu/reset flush old particles and reduced motion retains only static mud', () => {
  const target = rig(), { weather } = target;
  for (const action of [() => weather.reset(), () => update(target, 0, { mode: 'menu' }), () => update(target, 0, { reducedMotion: true })]) {
    update(target, .08);
    assert.ok(weather.spray.count > 0);
    action();
    assert.equal(weather.spray.count, 0);
    assert.equal(weather.spray.visible, false);
    assert.equal(weather.rain.visible, false);
    assert.ok(weather.particles.every(p => p.life === 0));
    assert.equal(weather.emission, 0);
  }
  assert.ok(weather.group.visible && weather.mud.visible);
  const before = snapshot(weather);
  update(target, .08, { reducedMotion: true });
  assert.deepEqual(snapshot(weather), before);
  weather.reset();
  target.race.distance = 500; pose(target); update(target, .08);
  assert.equal(weather.spray.count, 0);
  assert.ok(weather.spray.instanceMatrix.array.every(value => value === 0));
  weather.dispose();
});

test('sustained weather reuses a finite fixed pool and disposes all owned resources once', () => {
  const target = rig(), { weather } = target;
  const objects = weather.group.children.slice(), pool = weather.particles.slice();
  const rainBuffer = weather.rain.geometry.attributes.position.array, sprayBuffer = weather.spray.instanceMatrix.array;
  for (let frame = 0; frame < 2400; frame++) {
    target.race.distance = frame % 500 < 350 ? 1245 : 1340;
    pose(target); update(target, [1 / 60, 1 / 30, .08][frame % 3]);
    assert.ok(weather.spray.count <= 72);
    if (frame % 100 === 0) {
      assert.ok(sprayBuffer.every(Number.isFinite));
      assert.ok(rainBuffer.every(Number.isFinite));
    }
  }
  assert.deepEqual(weather.group.children, objects);
  weather.particles.forEach((p, i) => assert.equal(p, pool[i]));
  assert.equal(weather.rain.geometry.attributes.position.array, rainBuffer);
  assert.equal(weather.spray.instanceMatrix.array, sprayBuffer);
  let disposed = 0;
  for (const object of objects) {
    object.geometry.addEventListener('dispose', () => disposed++);
    object.material.addEventListener('dispose', () => disposed++);
  }
  weather.spray.addEventListener('dispose', () => disposed++);
  weather.dispose(); weather.dispose(); update(target);
  assert.equal(disposed, 7);
  assert.equal(weather.group.parent, null);
  assert.equal(weather.group.visible, false);
  assert.equal(target.scene.children.length, 1);
});
