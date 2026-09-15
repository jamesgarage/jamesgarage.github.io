import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BENDS, recoveryZones, turnAt, turnOffset, terrainCenterX } from '../src/turns.mjs';
import { getCourse } from '../src/courses.mjs';
import { sampleTrack, trackCenter } from '../src/track.mjs';
import { makeRoad } from '../src/world.mjs';

test('authored bends have smooth exact joins and preserve all stunt and gap flight intervals', () => {
  for (const bend of BENDS) for (const d of [bend.start, bend.end]) {
    assert.equal(turnOffset(d), 0);
    assert.ok(Math.abs(turnOffset(d + .0001) - turnOffset(d - .0001)) < 1e-9);
  }
  for (let d = 780; d <= 1040; d += .25) assert.equal(turnOffset(d), 0);
  for (const gap of getCourse('canyon').gaps) for (let d = gap.launch; d <= gap.land; d += .25) assert.equal(turnOffset(d), 0);
  for (const bend of BENDS) {
    const headings = []; let maxCurvature = 0;
    for (let d = bend.start; d <= bend.end; d += .5) {
      const frame = sampleTrack(d), info = turnAt(d);
      headings.push(info.heading);
      assert.ok(Math.abs(info.heading - Math.atan2(frame.forward.x, frame.forward.z)) < .00003);
      maxCurvature = Math.max(maxCurvature, Math.abs(info.curvature));
      if (Math.abs(info.curvature) > .005) assert.equal(Math.sign(info.steer), -Math.sign(info.curvature));
      assert.ok(Math.abs(trackCenter(d).x - terrainCenterX(trackCenter(d).z)) < 1e-9);
    }
    assert.ok(Math.max(...headings) - Math.min(...headings) > .8, `${bend.id} makes a visible real turn`);
    assert.ok(maxCurvature < 1 / 30, 'wide road offsets remain below the curve radius');
  }
});

test('recovery metadata excludes canyon gaps, loop, course finishes and invalid stations', () => {
  for (const courseId of ['skyway', 'woods', 'loop', 'bay', 'canyon']) {
    const course = getCourse(courseId);
    for (const zone of recoveryZones(courseId)) {
      assert.ok(Object.isFrozen(zone));
      assert.ok(zone.start >= course.start + 12 && zone.end <= course.end - 18);
      assert.equal(turnAt(zone.enter, courseId).recoverable, true);
      assert.equal(turnAt(zone.exit, courseId).recoverable, true);
      assert.equal(turnAt(zone.start + .1, courseId).recoverable, false);
      assert.ok(course.gaps.every(gap => zone.end < gap.launch - 12 || zone.start > gap.land + 12));
    }
    for (const d of [NaN, Infinity, -Infinity, 820, 900, 1000, course.end]) assert.equal(turnAt(d, courseId).recoverable, false);
  }
  assert.equal(turnAt(480, 'skyway').recoverable, true);
  assert.equal(turnAt(480, 'canyon').recoverable, false);
});

test('actual recovery shoulders support the full width and their matching rail openings are real', () => {
  for (const courseId of ['skyway', 'canyon']) {
    const course = getCourse(courseId), road = makeRoad({ courseId, gaps: course.gaps }); road.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    try {
      for (const zone of recoveryZones(courseId)) {
        for (const d of [zone.enter, (zone.enter + zone.exit) / 2, zone.exit]) {
          const frame = sampleTrack(d);
          for (const side of [-1, 1]) {
            ray.set(frame.position.clone().addScaledVector(frame.right, side * 7.75).addScaledVector(frame.up, .3), frame.right.clone().multiplyScalar(side)); ray.far = 1.6;
            assert.equal(ray.intersectObject(road, true).length, 0, `no invisible rail at ${courseId}:${d}`);
            for (const x of [9, 12, 15, 17.7]) {
              ray.set(frame.position.clone().addScaledVector(frame.right, side * x).addScaledVector(frame.up, 2), frame.up.clone().negate()); ray.far = 3;
              const hit = ray.intersectObject(road, true)[0];
              assert.ok(hit?.object.userData.roadKind === 'shoulder', `solid shoulder at ${courseId}:${d}:${side * x}`);
              assert.ok(Math.abs(hit.point.clone().sub(frame.position).dot(frame.up)) < .05);
            }
          }
        }
        for (const d of [zone.start - 2, zone.end + 2]) {
          const frame = sampleTrack(d);
          ray.set(frame.position.clone().addScaledVector(frame.right, 7.75).addScaledVector(frame.up, .3), frame.right.clone()); ray.far = 1.6;
          assert.ok(ray.intersectObject(road, true).some(hit => hit.object.userData.roadKind === 'rail'), 'rails resume outside the shoulder');
        }
      }
    } finally {
      const resources = new Set(); road.traverse(mesh => { if (mesh.isMesh) { resources.add(mesh.geometry); resources.add(mesh.material); if (mesh.material.map) resources.add(mesh.material.map); } });
      resources.forEach(resource => resource.dispose());
    }
  }
});
