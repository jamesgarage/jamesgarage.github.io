import * as THREE from 'three';

const CAPACITY = 64;
const EMISSION_RATE = 45;
const BACK = new THREE.Vector3(0, 0, -1);
const EXHAUST_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .12);

// The boxes only bound the volume. Eighteen short samples draw a soft, flowing
// density field inside them, so there are no visible polygon tips or billboard
// edges and the hot core remains visible when looking straight up the exhaust.
function flameMaterial() {
  return new THREE.ShaderMaterial({
    name: 'flowing-exhaust-volume', transparent: true, depthWrite: false,
    side: THREE.BackSide, toneMapped: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute vec4 flame;
      varying vec3 localEye;
      varying vec3 localSurface;
      varying vec4 plume;
      varying vec4 clipZ;
      varying vec4 clipW;
      void main() {
        plume = flame;
        mat4 clip = projectionMatrix * modelViewMatrix * instanceMatrix;
        clipZ = vec4(clip[0][2], clip[1][2], clip[2][2], clip[3][2]);
        clipW = vec4(clip[0][3], clip[1][3], clip[2][3], clip[3][3]);
        localSurface = position;
        localEye = (inverse(modelMatrix * instanceMatrix) * vec4(cameraPosition, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float time;
      varying vec3 localEye;
      varying vec3 localSurface;
      varying vec4 plume;
      varying vec4 clipZ;
      varying vec4 clipW;
      void main() {
        vec3 ray = normalize(localSurface - localEye);
        vec3 inv = sign(ray + vec3(0.000001)) / max(abs(ray), vec3(0.000001));
        vec3 t0 = (vec3(-0.6, -0.6, -1.0) - localEye) * inv;
        vec3 t1 = (vec3(0.6, 0.6, 0.0) - localEye) * inv;
        vec3 nearT = min(t0, t1), farT = max(t0, t1);
        float entry = max(0.0, max(nearT.x, max(nearT.y, nearT.z)));
        float end = min(farT.x, min(farT.y, farT.z));
        if (end <= entry) discard;
        float stepSize = (end - entry) / 18.0;
        vec4 sum = vec4(0.0);
        float firstDensity = end;
        float flow = time * 8.0 + plume.x;
        for (int i = 0; i < 18; i++) {
          vec3 p = localEye + ray * (entry + (float(i) + 0.5) * stepSize);
          float along = clamp(-p.z, 0.0, 1.0);
          float wave = along * 10.0 - flow;
          vec2 bend = vec2(sin(wave) + .4 * sin(wave * 1.73 + 1.8), cos(wave * .83));
          bend *= .055 * along;
          bend.y += .13 * along * along;
          float ripple = sin(wave * 1.4 + p.x * 9.0) * sin(wave * .7 + p.y * 12.0);
          float radius = .135 + .155 * sin(along * 3.14159);
          radius *= 1.0 + .19 * ripple * along;
          float radial = length(p.xy - bend) / radius;
          float edge = 1.0 - smoothstep(.36, 1.1, radial);
          float tip = 1.0 - smoothstep(.68, 1.0, along + .07 * ripple);
          float root = smoothstep(0.0, .035, along);
          // Trail segments are translucent cooling gas, overlapping the main
          // plume without painting detached hot spots into its wake.
          float wisps = .78 + .22 * sin(wave * 2.1 + p.x * 23.0 + p.y * 17.0);
          float density = edge * tip * root * plume.y * wisps;
          float heat = (1.0 - smoothstep(.0, .82, along)) * (1.0 - smoothstep(.0, .9, radial));
          heat *= 1.0 - plume.z * .8;
          vec3 color = mix(vec3(1.0, .085, .008), vec3(1.0, .43, .025), smoothstep(.0, .4, heat));
          color = mix(color, vec3(1.25, 1.08, .64), smoothstep(.12, .5, heat));
          if (density > .02) firstDensity = min(firstDensity, entry + (float(i) + .5) * stepSize);
          float alpha = 1.0 - exp(-density * stepSize * 8.0);
          sum.rgb += (1.0 - sum.a) * alpha * color;
          sum.a += (1.0 - sum.a) * alpha;
        }
        if (sum.a < .004) discard;
        // Depth belongs to the near visible gas, not the back of its box.
        // This also works when a close camera enters a large guardian plume.
        vec4 hit = vec4(localEye + ray * firstDensity, 1.0);
        gl_FragDepth = clamp(.5 + .5 * dot(clipZ, hit) / dot(clipW, hit), 0.0, 1.0);
        gl_FragColor = vec4(sum.rgb / max(sum.a, .001), sum.a);
        #include <colorspace_fragment>
      }`,
  });
}

export class ExhaustFlames {
  constructor(scene) {
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1).translate(0, 0, -.5);
    this.flameData = new THREE.InstancedBufferAttribute(new Float32Array((CAPACITY + 2) * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('flame', this.flameData);
    this.mesh = new THREE.InstancedMesh(geometry, flameMaterial(), CAPACITY + 2);
    this.mesh.name = 'exhaust-flames';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.particles = Array.from({ length: CAPACITY }, () => ({ life: 0, duration: 0, size: 0, length: 0, seed: 0, position: new THREE.Vector3(), velocity: new THREE.Vector3(), quaternion: new THREE.Quaternion() }));
    this.dummy = new THREE.Object3D();
    this.emitter = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();
    this.worldScale = new THREE.Vector3();
    this.previous = [new THREE.Vector3(), new THREE.Vector3()];
    this.hasPrevious = false;
    this.disposed = false;
    this.clear();
  }

  clear() {
    this.particles.forEach(p => { p.life = 0; });
    this.cursor = 0;
    this.emission = 0;
    this.hasPrevious = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  dispose() {
    if (this.disposed) return;
    this.clear();
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
    this.disposed = true;
  }

  add(position, quaternion, width, length, seed, opacity = 1, trail = 0) {
    this.dummy.position.copy(position);
    this.dummy.quaternion.copy(quaternion);
    this.dummy.scale.set(width, width, length);
    this.dummy.updateMatrix();
    const index = this.mesh.count++;
    this.mesh.setMatrixAt(index, this.dummy.matrix);
    this.flameData.setXYZW(index, seed, opacity, trail, 0);
  }

  update(dt, { truck, time, mode, race, transform = 0, reducedMotion }) {
    if (this.disposed) return;
    const running = mode === 'race' && race.phase === 'running';
    const paused = mode === 'race' && race.phase === 'paused';
    // Ignore even nonzero caller dt/time while paused. Accessibility toggles
    // are intentional state changes and may replace the trail with two jets.
    if (paused && this.mesh.count && this.reducedMotion === !!reducedMotion) return;
    this.reducedMotion = !!reducedMotion;
    dt = paused ? 0 : Math.max(0, Math.min(dt, .1));
    const cruising = running || paused;
    const boost = cruising ? transform + (race.turboTime > 0 ? 1.2 : 0) : 0;
    const speed = Number.isFinite(race.speed) ? Math.max(0, race.speed) : 26;
    const airborne = cruising && race.height > .2;
    truck.body.updateWorldMatrix(true, false);
    truck.body.getWorldScale(this.worldScale);
    const size = this.worldScale.x;
    const power = reducedMotion ? (cruising ? .85 : .45) : cruising ? 5.2 + boost * 4.5 + Math.min(.5, Math.max(0, speed - 26) * .025) + (airborne ? .5 : 0) : .65;
    if (reducedMotion) this.clear();
    this.mesh.count = 0;
    this.mesh.material.uniforms.time.value = reducedMotion ? 0 : time;
    truck.body.getWorldQuaternion(this.orientation);
    this.orientation.multiply(EXHAUST_TILT);
    this.direction.copy(BACK).applyQuaternion(this.orientation);
    this.emission = running && !reducedMotion ? this.emission + dt * EMISSION_RATE : 0;
    const emitCount = Math.min(5, Math.floor(this.emission));
    this.emission -= emitCount;
    for (let index = 0; index < 2; index++) {
      const side = index ? 1 : -1;
      this.emitter.set(side * 1.05, 3.09, -2.16).applyMatrix4(truck.body.matrixWorld);
      const pulse = reducedMotion ? 1 : 1 + .045 * Math.sin(time * 11 + side * 2);
      this.add(this.emitter, this.orientation, size * (cruising ? 1 : .7), size * power * pulse, side * 2.7);
      for (let i = 0; i < emitCount; i++) {
        const p = this.particles[this.cursor];
        this.cursor = (this.cursor + 1) % CAPACITY;
        const age = (emitCount - i - 1) / EMISSION_RATE;
        p.duration = .23 + boost * .04;
        p.life = Math.max(0, p.duration - age);
        p.size = size * (.8 + boost * .12);
        p.length = size * (1.4 + boost * .3) + speed / EMISSION_RATE;
        p.seed = side * 2.7 + time * 2;
        // Interpolate actual world-space outlets through jumps and turns,
        // rather than reconstructing a straight trail from scalar road speed.
        p.position.copy(this.emitter);
        if (this.hasPrevious && dt > 0) p.position.lerp(this.previous[index], Math.min(1, age / dt));
        p.position.addScaledVector(this.direction, size * power * .5);
        p.velocity.copy(this.direction).multiplyScalar(4 + boost * 2);
        p.velocity.y += .65;
        p.quaternion.copy(this.orientation);
      }
      this.previous[index].copy(this.emitter);
    }
    this.hasPrevious = true;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life = Math.max(0, p.life - dt);
      if (!p.life) continue;
      p.position.addScaledVector(p.velocity, dt);
      const remaining = p.life / p.duration;
      this.add(p.position, p.quaternion, p.size * (.7 + remaining * .3), p.length, p.seed, Math.pow(remaining, 1.4) * .24, 1);
    }
    this.mesh.visible = this.mesh.count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.flameData.needsUpdate = true;
  }
}
