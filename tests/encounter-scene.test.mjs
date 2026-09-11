import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RoadEncounters } from '../src/encounter-scene.mjs';
import { CRUSH_CARS, TURBO_PADS } from '../src/encounters.mjs';
import { sampleTrack, laneOffset } from '../src/track.mjs';

function rig() {
  const scene = new THREE.Scene();
  return { scene, encounters: new RoadEncounters(scene), race: { phase: 'running', crushedCars: [] } };
}
function update(target, dt = 1 / 60, overrides = {}) {
  target.encounters.update(dt, { race: target.race, mode: 'race', reducedMotion: false, ...overrides });
}
function snapshot(encounters) {
  return {
    visible: encounters.group.visible,
    cars: encounters.cars.map(car => ({
      crush: car.crush, position: car.body.position.toArray(), scale: car.body.scale.toArray(),
      wheels: Array.from(car.wheelMesh.instanceMatrix.array), version: car.wheelMesh.instanceMatrix.version,
    })),
  };
}

test('six detailed toy cars use the shared stations and screen-correct logical lanes', () => {
  const { encounters } = rig();
  assert.equal(encounters.cars.length, CRUSH_CARS.length);
  for (let i = 0; i < CRUSH_CARS.length; i++) {
    const definition = CRUSH_CARS[i], car = encounters.cars[i], frame = sampleTrack(definition.distance);
    assert.equal(car.id, definition.id);
    assert.ok(car.group.position.distanceTo(frame.position.clone().addScaledVector(frame.right, laneOffset(definition.lane)).addScaledVector(frame.up, .035)) < 1e-7);
    assert.ok(car.group.quaternion.angleTo(frame.quaternion) < 1e-7);
    assert.equal(car.wheels.length, 4);
    assert.equal(car.wheelMesh.count, 4);
    assert.equal(car.paint.material.color.getHex(), definition.color);
    const bounds = new THREE.Box3().setFromObject(car.body);
    assert.ok(bounds.min.y < bounds.max.y);
    assert.equal(car.body.children.length, 3, 'painted shell, dark glazing and contrasting details');
    car.group.position.set(0, 0, 0); car.group.quaternion.identity(); car.group.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(car.group).getSize(new THREE.Vector3());
    assert.ok(size.x > 2 && size.x < 2.25 && size.y > 1 && size.y < 1.2 && size.z > 3.2 && size.z < 3.4,
      'the intact toy remains visibly much smaller than every monster truck');
  }
  encounters.dispose();
});

test('front and rear glazing remain visible outside the beveled toy shell', () => {
  const { encounters } = rig(), car = encounters.cars[0];
  car.group.position.set(0, 0, 0); car.group.quaternion.identity(); car.group.updateMatrixWorld(true);
  for (const side of [-1, 1]) for (const height of [.76, .85, .95]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(0, height, side * 3), new THREE.Vector3(0, 0, -side));
    const hits = ray.intersectObject(car.body, true);
    assert.equal(hits[0]?.object, car.body.children[1], 'dark glass is in front of the painted shell');
  }
  encounters.dispose();
});

test('all car and pad geometry is finite and remains within its added rendering budget', () => {
  const { encounters } = rig();
  let calls = 0, triangles = 0;
  encounters.group.traverse(object => {
    if (!object.isMesh) return;
    calls++;
    const geometry = object.geometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
    assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
  });
  assert.ok(calls <= 40, `${calls} added meshes`);
  assert.ok(triangles < 15000, `${triangles} triangles`);
  assert.equal(encounters.pads.length, TURBO_PADS.length);
  encounters.dispose();
});

test('boost paint follows the bank and actual road triangles without a raised obstacle', () => {
  const { encounters } = rig(), ray = new THREE.Ray(), point = new THREE.Vector3(), hit = new THREE.Vector3();
  ray.direction.set(0, -1, 0);
  for (let index = 0; index < encounters.pads.length; index++) {
    const pad = encounters.pads[index], definition = TURBO_PADS[index];
    assert.equal(pad.id, definition.id);
    for (const mesh of [pad.base, pad.arrows]) {
      const geometry = mesh.geometry;
      for (let vertex = 0; vertex < geometry.attributes.position.count; vertex++) {
        const [distance, lateral, lift] = geometry.userData.trackSamples.slice(vertex * 3, vertex * 3 + 3);
        assert.ok(Math.abs(lateral) <= 7.3 + 1e-7, 'edge stripes and rails stay exposed');
        assert.ok(Math.abs(distance - definition.distance) <= definition.length / 2 + 1e-7);
        const frame = sampleTrack(distance);
        point.fromBufferAttribute(geometry.attributes.position, vertex);
        assert.ok(Math.abs(point.clone().sub(frame.position).dot(frame.up) - lift) < .0002);
        ray.origin.copy(point).y += 1;
        let clearance = Infinity;
        for (let station = Math.floor(distance / 2) * 2 - 2; station <= distance + 2; station += 2) {
          const aFrame = sampleTrack(station), bFrame = sampleTrack(station + 2);
          const a = aFrame.position.clone().addScaledVector(aFrame.right, -8.5), b = bFrame.position.clone().addScaledVector(bFrame.right, -8.5);
          const c = aFrame.position.clone().addScaledVector(aFrame.right, 8.5), d = bFrame.position.clone().addScaledVector(bFrame.right, 8.5);
          for (const triangle of [[a, b, c], [c, b, d]]) {
            if (ray.intersectTriangle(...triangle, false, hit)) clearance = Math.min(clearance, point.y - hit.y);
          }
        }
        assert.ok(clearance > .035 && clearance < .11, `${pad.id} paint clearance ${clearance}`);
      }
    }
  }
  encounters.dispose();
});

test('crushing affects one identified car, visibly flattens its body and splays its four wheels', () => {
  const target = rig(), { encounters } = target;
  update(target);
  const before = snapshot(encounters);
  target.race.crushedCars.push(CRUSH_CARS[2].id);
  update(target, .1);
  assert.ok(encounters.cars[2].crush > 0 && encounters.cars[2].crush < 1);
  for (let frame = 0; frame < 30; frame++) update(target);
  const after = snapshot(encounters), car = encounters.cars[2];
  assert.equal(car.crush, 1);
  assert.ok(car.body.scale.y <= .25);
  car.wheels.forEach(wheel => {
    assert.ok(Math.abs(wheel.position.x) > 1.15);
    assert.ok(Math.abs(wheel.rotation.z) > 1.4);
    assert.ok(wheel.position.y < .2);
  });
  before.cars.forEach((state, index) => { if (index !== 2) assert.deepEqual(after.cars[index], state); });
  const settled = snapshot(encounters);
  for (let frame = 0; frame < 100; frame++) update(target);
  assert.deepEqual(snapshot(encounters), settled, 'a settled crush never reanimates');
  assert.deepEqual(target.race.crushedCars, [CRUSH_CARS[2].id]);
  encounters.dispose();
});

test('paused and zero-time frames freeze every animation transform and buffer exactly', () => {
  const target = rig();
  target.race.crushedCars.push(CRUSH_CARS[0].id); update(target, .08);
  const before = snapshot(target.encounters);
  target.race.crushedCars.push(CRUSH_CARS[1].id);
  for (let frame = 0; frame < 30; frame++) update(target, 0);
  assert.deepEqual(snapshot(target.encounters), before);
  target.race.phase = 'paused';
  for (let frame = 0; frame < 30; frame++) update(target, .08, { reducedMotion: true });
  assert.deepEqual(snapshot(target.encounters), before);
  target.race.phase = 'finished'; update(target, .08);
  assert.deepEqual(snapshot(target.encounters), before);
  target.race.phase = 'running'; update(target, .08);
  assert.notDeepEqual(snapshot(target.encounters), before);
  target.encounters.dispose();
});

test('gentler motion shows instant flattened outcomes; reset and menu restore fresh toys', () => {
  const target = rig(), { encounters } = target;
  const fresh = snapshot(encounters);
  target.race.crushedCars = CRUSH_CARS.map(car => car.id);
  update(target, .01, { reducedMotion: true });
  assert.ok(encounters.cars.every(car => car.crush === 1));
  encounters.reset();
  const reset = snapshot(encounters);
  assert.equal(reset.visible, false);
  reset.cars.forEach((state, index) => {
    assert.equal(state.crush, 0);
    assert.deepEqual(state.scale, fresh.cars[index].scale);
    assert.deepEqual(state.wheels, fresh.cars[index].wheels);
  });
  update(target, .1); update(target, 0, { mode: 'menu' });
  assert.ok(encounters.cars.every(car => car.crush === 0));
  assert.equal(encounters.group.visible, false);
  target.race.crushedCars = []; update(target);
  assert.ok(encounters.cars.every(car => car.crush === 0));
  encounters.dispose();
});

test('updates reuse all objects and buffers, and every owned GPU resource is disposed exactly once', () => {
  const target = rig(), { encounters } = target;
  const objects = [], geometrySet = new Set(), materialSet = new Set();
  encounters.group.traverse(object => {
    objects.push(object);
    if (object.isMesh) { geometrySet.add(object.geometry); materialSet.add(object.material); }
  });
  const buffers = encounters.cars.map(car => car.wheelMesh.instanceMatrix.array);
  for (let frame = 0; frame < 1200; frame++) {
    if (frame % 100 === 0) encounters.reset();
    target.race.crushedCars = CRUSH_CARS.map(car => car.id);
    update(target);
  }
  const after = []; encounters.group.traverse(object => after.push(object));
  assert.deepEqual(after, objects);
  encounters.cars.forEach((car, index) => assert.equal(car.wheelMesh.instanceMatrix.array, buffers[index]));
  const counts = new Map();
  for (const resource of [...geometrySet, ...materialSet, ...encounters.cars.map(car => car.wheelMesh)]) {
    counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  encounters.dispose(); encounters.dispose(); update(target);
  assert.ok([...counts.values()].every(count => count === 1));
  assert.equal(encounters.group.parent, null);
  assert.equal(target.scene.children.length, 0);
});
