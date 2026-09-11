import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sampleTrack, trackCenter, laneOffset } from '../src/track.mjs';
import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS } from '../src/core.mjs';

test('the road and truck share a finite orthonormal frame for the entire course', () => {
  for (let d = -30; d <= COURSE_LENGTH + 60; d += .8) {
    const frame = sampleTrack(d);
    for (const vector of [frame.position, frame.forward, frame.right, frame.up]) {
      assert.ok(vector.toArray().every(Number.isFinite));
    }
    for (const axis of [frame.forward, frame.right, frame.up]) assert.ok(Math.abs(axis.length() - 1) < 1e-6);
    assert.ok(Math.abs(frame.forward.dot(frame.up)) < 1e-6);
    assert.ok(Math.abs(frame.forward.dot(frame.right)) < 1e-6);
    assert.ok(Math.abs(frame.right.dot(frame.up)) < 1e-6);
    assert.ok(frame.position.distanceTo(trackCenter(d)) < 1e-6);
  }
});

test('loop entry and exit remain continuous and the truck goes upside down', () => {
  for (const d of [LOOP_START, LOOP_END, ...RAMPS]) {
    assert.ok(trackCenter(d - .01).distanceTo(trackCenter(d + .01)) < .05);
  }
  assert.ok(sampleTrack(LOOP_START).up.y > .95);
  assert.ok(sampleTrack((LOOP_START + LOOP_END) / 2).up.y < -.95);
  assert.ok(sampleTrack(LOOP_END).up.y > .95);
  assert.ok(trackCenter((LOOP_START + LOOP_END) / 2).y - trackCenter(LOOP_START).y > 55);
});

test('logical right projects right of the road from a chase camera throughout the driving sections', () => {
  for (const aspect of [1024 / 768, 768 / 1024]) {
    const camera = new THREE.PerspectiveCamera(55, aspect, .1, 500);
    for (let distance = 0; distance <= COURSE_LENGTH; distance += 5) {
      if (distance > LOOP_START - 18 && distance < LOOP_END + 15) continue;
      const frame = sampleTrack(distance);
      const horizontal = frame.forward.clone().setY(0).normalize();
      camera.position.copy(frame.position).addScaledVector(horizontal, -26).add(new THREE.Vector3(0, 13.5, 0));
      camera.lookAt(frame.position.clone().addScaledVector(horizontal, 3).add(new THREE.Vector3(0, 2.4, 0)));
      camera.updateMatrixWorld();
      const center = frame.position.clone().project(camera).x;
      for (const lane of [-1, 1]) {
        const x = frame.position.clone().addScaledVector(frame.right, laneOffset(lane)).project(camera).x;
        assert.ok((x - center) * lane > 0, `screen direction at ${distance}, lane ${lane}, aspect ${aspect}`);
      }
    }
  }
});
