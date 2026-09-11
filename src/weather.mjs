import * as THREE from 'three';
import { sampleTrack, laneOffset } from './track.mjs';

const RAIN_COUNT = 96;
const SPRAY_COUNT = 72;
const EMISSION_RATE = 18;
const LATERAL_STEPS = 8;
const MUD_LIFT = .045;
const PATCHES = Object.freeze([
  { start: 222, end: 244, center: -.5, width: 6.3, seed: 1 },
  { start: 256, end: 278, center: .5, width: 6.4, seed: 3 },
  { start: 1232, end: 1258, center: -.4, width: 6.5, seed: 5 },
  { start: 1282, end: 1312, center: .3, width: 6.4, seed: 7 },
].map(Object.freeze));
const fract = value => value - Math.floor(value);

function patchWidth(patch, distance) {
  const t = (distance - patch.start) / (patch.end - patch.start);
  if (t <= 0 || t >= 1) return 0;
  return patch.width * Math.sin(t * Math.PI) ** .35 * (.91 + .09 * Math.sin(t * 31 + patch.seed));
}

function mudGeometry() {
  const positions = [], colors = [], indices = [], samples = [];
  const color = new THREE.Color(), point = new THREE.Vector3();
  for (const patch of PATCHES) {
    const steps = Math.ceil(patch.end - patch.start), base = positions.length / 3;
    for (let row = 0; row <= steps; row++) {
      const distance = THREE.MathUtils.lerp(patch.start, patch.end, row / steps);
      const frame = sampleTrack(distance), width = patchWidth(patch, distance);
      for (let column = 0; column <= LATERAL_STEPS; column++) {
        const lateral = patch.center + (column / LATERAL_STEPS * 2 - 1) * width;
        point.copy(frame.position).addScaledVector(frame.right, lateral).addScaledVector(frame.up, MUD_LIFT);
        positions.push(point.x, point.y, point.z);
        // A wet, warm brown with subtle mottling, all in one opaque draw call.
        color.setHex((row + column + patch.seed) % 5 === 0 ? 0x98623b : 0x805033);
        colors.push(color.r, color.g, color.b);
        samples.push(distance, lateral);
        if (row < steps && column < LATERAL_STEPS) {
          const a = base + row * (LATERAL_STEPS + 1) + column, b = a + LATERAL_STEPS + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.trackSamples = samples;
  return geometry;
}

/** Cosmetic weather only: never writes the race state or the truck pose. */
export class RaceWeather {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'friendly-race-weather';
    this.mud = new THREE.Mesh(mudGeometry(), new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: .47, metalness: 0, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    this.mud.name = 'shallow-mud-patches';
    this.mud.receiveShadow = true;
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_COUNT * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({
      color: 0xa4e4e8, transparent: true, opacity: 0, depthWrite: false,
    }));
    this.rain.name = 'gentle-bay-rain';
    this.rain.frustumCulled = false;
    this.spray = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x966037, roughness: .65 }), SPRAY_COUNT);
    this.spray.name = 'mud-tire-spray';
    this.spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.spray.frustumCulled = false;
    this.group.add(this.mud, this.rain, this.spray);
    scene.add(this.group);
    this.patches = PATCHES;
    this.particles = Array.from({ length: SPRAY_COUNT }, () => ({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, duration: 0, size: 0,
    }));
    this.dummy = new THREE.Object3D();
    this.origin = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.disposed = false;
    this.reset();
  }

  clearMoving() {
    for (const particle of this.particles) particle.life = 0;
    this.emission = 0;
    this.cursor = 0;
    this.rain.visible = false;
    this.rain.material.opacity = 0;
    this.spray.visible = false;
    this.spray.count = 0;
  }

  reset() {
    this.clearMoving();
    this.time = 0;
    this.group.visible = false;
    this.rain.geometry.attributes.position.array.fill(0);
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.spray.instanceMatrix.array.fill(0);
    this.spray.instanceMatrix.needsUpdate = true;
  }

  update(dt, { race, truck, mode, reducedMotion }) {
    if (this.disposed) return;
    if (mode !== 'race') {
      if (this.group.visible) this.reset();
      return;
    }
    this.group.visible = true;
    if (reducedMotion) { this.clearMoving(); return; }
    // No writes to buffers, matrices, time, or the emitter accumulator on pause.
    if (race.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(dt, .1);
    this.time += step;
    truck.group.updateWorldMatrix(true, false);
    this.origin.setFromMatrixPosition(truck.group.matrixWorld);
    this.scale.setFromMatrixScale(truck.group.matrixWorld);
    const fade = Math.min(THREE.MathUtils.smoothstep(race.distance, 1190, 1230), 1 - THREE.MathUtils.smoothstep(race.distance, 1430, 1470));
    this.rain.visible = fade > 0;
    this.rain.material.opacity = fade * .38;
    if (this.rain.visible) {
      const positions = this.rain.geometry.attributes.position.array;
      for (let index = 0; index < RAIN_COUNT; index++) {
        const offset = index * 6;
        const x = this.origin.x + (fract(index * .6180339) - .5) * 34;
        const y = this.origin.y + 1.5 + fract(index * .4142136 - this.time * .75) * 17;
        const z = this.origin.z + (fract(index * .7548776) - .5) * 46;
        positions[offset] = x; positions[offset + 1] = y; positions[offset + 2] = z;
        positions[offset + 3] = x + .08; positions[offset + 4] = y - .85; positions[offset + 5] = z - .035;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    // Existing flecks finish their short arc after leaving a patch or jumping.
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life = Math.max(0, particle.life - step);
      particle.velocity.y -= step * 12;
      particle.position.addScaledVector(particle.velocity, step);
    }
    const grounded = race.height <= .05 && Math.abs(race.velocityY || 0) < .5;
    let onMud = false;
    if (grounded) {
      for (const patch of PATCHES) {
        if (race.distance >= patch.start - 3 && race.distance <= patch.end + 3) { onMud = true; break; }
      }
    }
    this.emission = onMud ? this.emission + step * EMISSION_RATE : 0;
    const count = Math.floor(this.emission);
    this.emission -= count;
    if (count) {
      for (const wheel of truck.wheels) {
        const distance = race.distance + wheel.position.z * this.scale.z;
        const lateral = laneOffset(race.lane) + wheel.position.x * this.scale.x;
        let contact = false;
        for (const patch of PATCHES) {
          if (Math.abs(lateral - patch.center) < patchWidth(patch, distance)) { contact = true; break; }
        }
        if (!contact) continue;
        for (let index = 0; index < count; index++) {
          const particle = this.particles[this.cursor];
          this.cursor = (this.cursor + 1) % SPRAY_COUNT;
          particle.duration = .38 + (this.cursor % 5) * .025;
          particle.life = particle.duration;
          particle.size = this.scale.x * (.10 + (this.cursor % 3) * .025);
          // Wheel centers belong to the truck group, so wheel spin and sprung
          // body lift cannot move the contact point off the tire's lower edge.
          particle.position.set(wheel.position.x, wheel.position.y - 1.05 + .10, wheel.position.z - .28).applyMatrix4(truck.group.matrixWorld);
          particle.velocity.set(Math.sign(wheel.position.x) * (1.1 + (this.cursor % 3) * .25), 3.7, -3.9)
            .transformDirection(truck.group.matrixWorld).multiplyScalar(5.5 * this.scale.x);
        }
      }
    }
    this.spray.count = 0;
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      this.dummy.position.copy(particle.position);
      this.dummy.scale.setScalar(particle.size * Math.min(1, particle.life / .16));
      this.dummy.updateMatrix();
      this.spray.setMatrixAt(this.spray.count++, this.dummy.matrix);
    }
    this.spray.visible = this.spray.count > 0;
    this.spray.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.group.removeFromParent();
    for (const object of [this.mud, this.rain, this.spray]) {
      object.geometry.dispose();
      object.material.dispose();
    }
    this.spray.dispose();
    this.disposed = true;
  }
}
