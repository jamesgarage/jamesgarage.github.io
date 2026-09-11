import * as THREE from 'three';

const CAPACITY = 64;
const EMISSION_RATE = 60;
const BACK = new THREE.Vector3(0, 0, -1);
const EXHAUST_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .12);

// A small, faceted flame with a warm core and orange tips. Vertex colors keep
// it bright in daylight without lights, textures, transparency, or shadows.
function flameGeometry() {
  const positions = [], colors = [], indices = [];
  const rings = [[0, .2, 0xfff2aa], [.18, .34, 0xffd34e], [.48, .25, 0xff962c], [.76, .14, 0xff6623], [1, 0, 0xf64424]];
  const color = new THREE.Color();
  for (let ring = 0; ring < rings.length; ring++) {
    const [length, radius, hex] = rings[ring];
    color.setHex(hex);
    for (let side = 0; side < 7; side++) {
      const angle = side / 7 * Math.PI * 2;
      positions.push(Math.cos(angle) * radius + Math.sin(length * 5) * .08, Math.sin(angle) * radius + length * length * .18, -length);
      colors.push(color.r, color.g, color.b);
      if (ring < rings.length - 1) {
        const a = ring * 7 + side, b = ring * 7 + (side + 1) % 7;
        indices.push(a, b, a + 7, b, b + 7, a + 7);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

export class ExhaustFlames {
  constructor(scene) {
    this.mesh = new THREE.InstancedMesh(flameGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide }), CAPACITY + 6);
    this.mesh.name = 'exhaust-flames';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.particles = Array.from({ length: CAPACITY }, () => ({ life: 0, duration: 0, size: 0, position: new THREE.Vector3(), velocity: new THREE.Vector3(), quaternion: new THREE.Quaternion() }));
    this.dummy = new THREE.Object3D();
    this.emitter = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();
    this.clear();
  }

  clear() {
    this.particles.forEach(p => { p.life = 0; });
    this.cursor = 0;
    this.emission = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  add(position, quaternion, width, length) {
    this.dummy.position.copy(position);
    this.dummy.quaternion.copy(quaternion);
    this.dummy.scale.set(width, width, length);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.mesh.count++, this.dummy.matrix);
  }

  update(dt, { truck, time, mode, race, transform, reducedMotion }) {
    const running = mode === 'race' && race.phase === 'running';
    const paused = mode === 'race' && race.phase === 'paused';
    const cruising = running || paused;
    const boost = cruising ? transform : 0;
    const airborne = cruising && race.height > .2;
    const size = truck.group.scale.x;
    const power = reducedMotion ? (cruising ? .85 : .45) : cruising ? 2.4 + boost * 1.7 + (airborne ? .6 : 0) : .5;
    // Reduced motion retains steady exhaust flames, without a moving trail.
    if (reducedMotion) this.clear();
    this.mesh.count = 0;
    truck.body.updateWorldMatrix(true, false);
    this.orientation.copy(truck.group.quaternion).multiply(EXHAUST_TILT);
    this.direction.copy(BACK).applyQuaternion(this.orientation);
    const previousEmission = this.emission;
    this.emission = running && !reducedMotion ? this.emission + dt * EMISSION_RATE : 0;
    const emitCount = Math.min(6, Math.floor(this.emission));
    this.emission -= emitCount;
    // A pause freezes existing instances; it never accumulates new emissions.
    if (paused) this.emission = previousEmission;
    for (const side of [-1, 1]) {
      this.emitter.set(side * 1.05, 3.09, -2.16).applyMatrix4(truck.body.matrixWorld);
      const pulse = reducedMotion ? 1 : 1 + .09 * Math.sin(time * 19 + side * 2) + .045 * Math.sin(time * 31);
      this.add(this.emitter, this.orientation, size * (cruising ? 1 : .65), size * power * pulse);
      if (!reducedMotion && cruising) {
        // Two smaller tongues give each exhaust an irregular flame silhouette.
        for (const wing of [-1, 1]) {
          this.dummy.position.set(side * 1.05 + wing * .19, 3.08 + wing * .1, -2.32).applyMatrix4(truck.body.matrixWorld);
          this.add(this.dummy.position, this.orientation, size * .46, size * power * (.7 + wing * .12) / pulse);
        }
      }
      for (let i = 0; i < emitCount; i++) {
        const p = this.particles[this.cursor];
        this.cursor = (this.cursor + 1) % CAPACITY;
        p.duration = .3 + boost * .13;
        p.life = p.duration;
        p.size = size * (.7 + boost * .22);
        // Stagger births along the previous frame's path, including slow frames.
        const age = (emitCount - i - 1) / EMISSION_RATE;
        p.position.copy(this.emitter).addScaledVector(this.direction, size * power * .5 + age * 26);
        p.velocity.copy(this.direction).multiplyScalar(5 + boost * 3);
        p.velocity.y += 1.3;
        p.quaternion.copy(this.orientation);
      }
    }
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life = Math.max(0, p.life - dt);
      if (!p.life) continue;
      p.position.addScaledVector(p.velocity, dt);
      const remaining = p.life / p.duration;
      this.add(p.position, p.quaternion, p.size * remaining, p.size * remaining * 3.4);
    }
    this.mesh.visible = this.mesh.count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
