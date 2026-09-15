import * as THREE from 'three';
import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS } from './core.mjs';
import { turnOffset } from './turns.mjs';
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
// Models face local +Z; viewed from behind, local +X is screen-left.
// Logical lanes follow the controls: negative left, positive right.
export function laneOffset(lane) { return -lane * 3.4; }

export function trackCenter(distance) {
  const d = clamp(distance, -80, COURSE_LENGTH + 160);
  const loopLength = LOOP_END - LOOP_START;
  // A complete circle with a gentle sideways exit keeps entry/exit separate.
  const radius = loopLength / TAU;
  let z = d, y = 0, xOffset = 0;
  if (d >= LOOP_START && d <= LOOP_END) {
    const t = (d - LOOP_START) / loopLength;
    const theta = t * TAU;
    z = LOOP_START + radius * Math.sin(theta);
    y = radius * (1 - Math.cos(theta));
    xOffset = 13 * (t * t * (3 - 2 * t));
  } else if (d > LOOP_END) { z = d - loopLength; xOffset = 13; }
  let hill = 1.2 * Math.sin(z / 150);
  let ramp = 0;
  for (const r of RAMPS) {
    const diff = d - r;
    if (diff > -24 && diff <= 0) ramp = 2.6 * ((diff + 24) / 24) ** 2;
    else if (diff > 0 && diff < 38) ramp = 2.6 * (1 - diff / 38);
  }
  // The timber bridge rises gently, with zero added slope at either end. Every
  // actor and road treatment uses this same centerline, including nearby cars.
  const bridgeT = (d - 310) / 65;
  const bridge = bridgeT > 0 && bridgeT < 1 ? 2.4 * Math.sin(Math.PI * bridgeT) ** 2 : 0;
  return new THREE.Vector3(13 * Math.sin(z / 135) + 6 * Math.sin(z / 57) + xOffset + turnOffset(d), 1.5 + hill + y + ramp + bridge, z);
}

export function sampleTrack(distance) {
  const position = trackCenter(distance);
  const forward = trackCenter(distance + 0.12).sub(trackCenter(distance - 0.12)).normalize();
  let right, up;
  if (distance >= LOOP_START && distance <= LOOP_END) {
    const theta = (distance - LOOP_START) / (LOOP_END - LOOP_START) * TAU;
    up = new THREE.Vector3(0, Math.cos(theta), -Math.sin(theta));
    right = new THREE.Vector3().crossVectors(up, forward).normalize();
    up.crossVectors(forward, right).normalize();
  } else {
    right = new THREE.Vector3().crossVectors(UP, forward).normalize();
    up = new THREE.Vector3().crossVectors(forward, right).normalize();
    const bank = Math.sin(position.z / 135) * 0.07;
    right.applyAxisAngle(forward, bank); up.applyAxisAngle(forward, bank);
  }
  const matrix = new THREE.Matrix4().makeBasis(right, up, forward);
  return { position, forward, right, up, quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix) };
}
