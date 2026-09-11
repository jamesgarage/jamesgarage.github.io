import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRace, stepRace, TRUCKS } from '../src/core.mjs';
import { makeTruck, disposeTruck } from '../src/models.mjs';
import { poseGuardian } from '../src/guardian-pose.mjs';
import { RoadEncounters } from '../src/encounter-scene.mjs';
import { SmashTargets } from '../src/smash-scene.mjs';
import { CRUSH_CARS } from '../src/encounters.mjs';
import { sampleTrack, laneOffset } from '../src/track.mjs';

function positionTruck(truck, race, transform) {
  const road = sampleTrack(race.distance);
  truck.group.position.copy(road.position).addScaledVector(road.right, laneOffset(race.lane)).addScaledVector(road.up, race.height);
  truck.group.quaternion.copy(road.quaternion);
  poseGuardian(truck, { transform, time: 0 });
  truck.group.updateMatrixWorld(true);
}

function tireVerticesInside(truck, interiors) {
  const point = new THREE.Vector3(), local = new THREE.Vector3();
  let contained = 0;
  for (const wheel of truck.wheels) wheel.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      if (interiors.some(({ inverse, inside }) => inside(local.copy(point).applyMatrix4(inverse)))) contained++;
    }
  });
  return contained;
}

function toys() {
  const scene = new THREE.Scene(), encounters = new RoadEncounters(scene), smashes = new SmashTargets(scene);
  scene.updateMatrixWorld(true);
  const blocks = smashes.targets.find(target => target.id === 'smash-340');
  const car = encounters.cars.find(target => target.id === 'car-300');
  return {
    encounters, smashes,
    blocks: { definition: blocks, type: 'smash', stars: 3, interiors: blocks.parts.map(part => ({
      inverse: part.mesh.matrixWorld.clone().invert(),
      // Every point is well inside the actual rounded cube, away from its
      // .07-radius edges. This proves solid overlap, not just touching AABBs.
      inside: point => Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) < .4,
    })) },
    car: { definition: CRUSH_CARS.find(target => target.id === car.id), type: 'crush', stars: 2, interiors: [{
      inverse: car.paint.matrixWorld.clone().invert(),
      // Inner solid of the real rounded die-cast shell: its authored body is
      // 1.86×.44×3.02 at y.47 with .12 rounding; this lies inside all bevels.
      inside: point => Math.abs(point.x) < .78 && Math.abs(point.y - .47) < .08 && Math.abs(point.z) < 1.35,
    }] },
  };
}

test('physical robot side contacts break actual cars and block stacks for every truck, including the visible return', () => {
  const rig = toys();
  try {
    for (const spec of TRUCKS) {
      const truck = makeTruck(spec);
      try {
        for (const target of [rig.blocks, rig.car]) for (const returning of [false, true]) {
          const extra = target.type === 'smash' ? .4 : .25;
          const lane = target.definition.lane + ((target.definition.halfWidth ?? 1.05) + 2 * spec.scale + extra) / 3.4;
          const race = { ...createRace(), phase: 'running', truckScale: spec.scale,
            distance: target.definition.distance - 2.25, lane, targetLane: lane,
            transformTime: returning ? 0 : 9, guardianClearTime: returning ? .98 : 1 };
          positionTruck(truck, race, returning ? .9 : 1);
          assert.ok(tireVerticesInside(truck, target.interiors) > 0,
            `${spec.id} ${target.type} ${returning ? 'returning' : 'robot'} fixture has real tire vertices inside the visible solid`);
          const events = stepRace(race, .001).filter(event => event.type === target.type);
          assert.equal(events.length, 1, `${spec.id} ${target.type} ${returning ? 'returning' : 'robot'} visible contact must count`);
          assert.equal(events[0].id, target.definition.id);
          assert.equal(race.stars, target.stars);
          assert.ok(race.speed > 26);
          assert.ok(!stepRace(race, .001).some(event => event.type === target.type), 'The same physical hit pays once');
        }
      } finally { disposeTruck(truck); }
    }
  } finally { rig.encounters.dispose(); rig.smashes.dispose(); }
});

test('Truck input retains the visible return contact, freezes on pause and releases the wider footprint after settling', () => {
  const rig = toys(), truck = makeTruck(TRUCKS.at(-1)), lane = .85;
  try {
    const race = { ...createRace(), phase: 'running', truckScale: truck.spec.scale,
      distance: 10, lane, targetLane: lane, robotMode: true, robotManual: true, transformTime: 9, guardianClearTime: 1 };
    stepRace(race, 1 / 60, { transform: true });
    assert.equal(race.transformTime, 0);
    assert.ok(race.guardianClearTime > .9);
    const returning = structuredClone(race);
    returning.distance = 337.75;
    returning.phase = 'paused';
    const paused = structuredClone(returning);
    assert.deepEqual(stepRace(returning, .05), []);
    assert.deepEqual(returning, paused);
    returning.phase = 'running';
    positionTruck(truck, returning, Math.exp(-5 / 60));
    assert.ok(tireVerticesInside(truck, rig.blocks.interiors) > 0);
    assert.ok(stepRace(returning, .001).some(event => event.type === 'smash'));

    for (let frame = 0; frame < 65; frame++) stepRace(race, 1 / 60);
    assert.equal(race.guardianClearTime, 0);
    race.distance = 337.75;
    positionTruck(truck, race, 0);
    assert.equal(tireVerticesInside(truck, rig.blocks.interiors), 0, 'The settled truck is physically clear of this stack');
    assert.ok(!stepRace(race, .001).some(event => event.type === 'smash'), 'An old transformation cannot collect a distant side target');
  } finally { disposeTruck(truck); rig.encounters.dispose(); rig.smashes.dispose(); }
});

test('wide robots still clear genuinely separated cars and airborne stacks', () => {
  const apart = { ...createRace(), phase: 'running', truckScale: 1.5, distance: 297.75,
    lane: 1, targetLane: 1, transformTime: 9, guardianClearTime: 1 };
  assert.ok(!stepRace(apart, .001).some(event => event.type === 'crush'));
  const airborne = { ...createRace(), phase: 'running', truckScale: 1.5, distance: 337.75,
    lane: .8, targetLane: .8, transformTime: 9, guardianClearTime: 1, height: 4, velocityY: 2 };
  assert.ok(!stepRace(airborne, .001).some(event => event.type === 'smash'));
});
