import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleTrack, trackCenter } from '../src/track.mjs';
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
