import * as THREE from 'three';

const CAPACITY = 80;
const PALETTE = [0xffd75e, 0xff805a, 0x79e5d9, 0xf9f0ca];
const ORIGIN = new THREE.Vector3();

/** Fixed celebration storage. Only the instanced mesh belongs to the scene;
 * each particle keeps an unparented transform for animation and inspection. */
export class BurstParticles {
  constructor(scene, { random = Math.random } = {}) {
    this.random = random;
    this.disposed = false; this.suppressed = false;
    this.geometry = new THREE.IcosahedronGeometry(.16, 0);
    this.geometry.computeBoundingSphere();
    // One neutral material preserves per-instance colors. Gold reward flakes
    // share the ordinary matte finish instead of the former .25 metalness.
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .4, metalness: 0 });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, CAPACITY);
    this.mesh.name = 'celebration-particles';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.boundingBox = new THREE.Box3();
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    this.particles = Array.from({ length: CAPACITY }, (_, index) => {
      const mesh = new THREE.Object3D(), paint = new THREE.Color(PALETTE[index % PALETTE.length]);
      mesh.visible = false;
      return { mesh, paint, color: paint.clone(), life: 0, duration: 1, size: 1, v: new THREE.Vector3() };
    });
    this.mesh.count = 0; this.mesh.visible = false;
    scene.add(this.mesh);
  }

  get diagnostics() {
    return Object.freeze({ count: this.mesh.count, capacity: CAPACITY, disposed: this.disposed });
  }

  burst({ kind = 'celebrate', count = 20, origin = ORIGIN, enabled = !this.suppressed } = {}) {
    // Event dispatch can precede this frame's update (for example immediately
    // after leaving settings). An owner with current context may supply it.
    if (this.disposed || !enabled || !['celebrate', 'dust', 'reward'].includes(kind) ||
        !Number.isFinite(count) || count <= 0 || !origin || !Number.isFinite(origin.x) ||
        !Number.isFinite(origin.y) || !Number.isFinite(origin.z)) return 0;
    const wanted = Math.min(CAPACITY, Math.floor(count));
    if (!wanted) return 0;
    const colorful = kind !== 'dust', spread = colorful ? 11 : 5;
    let emitted = 0;
    for (const p of this.particles) {
      if (p.life > 0) continue;
      p.life = p.duration = (colorful ? .55 : .3) + this.random() * .5;
      p.size = colorful ? 1.5 : 2.8;
      if (kind === 'celebrate') p.color.copy(p.paint);
      else p.color.setHex(kind === 'reward' ? 0xffd75e : 0xdfbb83);
      p.mesh.visible = true;
      // Keep the former six random samples per particle in their original order.
      p.mesh.position.set(origin.x + (this.random() - .5) * (colorful ? 1 : 5),
        origin.y + (colorful ? 1 : .25), origin.z + (this.random() - .5) * (colorful ? 1 : 4));
      p.v.set((this.random() - .5) * spread, this.random() * (colorful ? 8 : 2) + 2, (this.random() - .5) * spread);
      p.mesh.scale.setScalar(p.size);
      if (++emitted >= wanted) break;
    }
    if (emitted) this.upload();
    return emitted;
  }

  update(dt, { phase, mode = 'race', reducedMotion = false } = {}) {
    // A paused/invalid frame cannot apply even a pending preference change.
    if (this.disposed || !Number.isFinite(dt) || dt <= 0 || phase === 'paused') return;
    if (mode === 'menu' || reducedMotion) { this.suppressed = true; this.clear(); return; }
    if (mode !== 'race' || (phase !== 'running' && phase !== 'finished')) return;
    this.suppressed = false;
    if (!this.mesh.count) return;
    const step = Math.min(dt, .1);
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= step; p.mesh.visible = p.life > 0;
      p.v.y -= step * 12;
      p.mesh.position.addScaledVector(p.v, step);
      p.mesh.rotation.x += step * 4; p.mesh.rotation.z += step * 3;
      p.mesh.scale.setScalar(p.size * Math.max(0, p.life / p.duration));
    }
    this.upload();
  }

  /** Pack active slots contiguously and bound the actual Float32 GPU matrices. */
  upload() {
    const bounds = this.mesh.boundingBox, data = this.mesh.instanceMatrix.array;
    bounds.makeEmpty();
    let active = 0;
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.mesh.updateMatrix();
      this.mesh.setMatrixAt(active, p.mesh.matrix); this.mesh.setColorAt(active, p.color);
      const offset = active * 16;
      const radius = this.geometry.boundingSphere.radius * Math.max(
        Math.hypot(data[offset], data[offset + 1], data[offset + 2]),
        Math.hypot(data[offset + 4], data[offset + 5], data[offset + 6]),
        Math.hypot(data[offset + 8], data[offset + 9], data[offset + 10]));
      const x = data[offset + 12], y = data[offset + 13], z = data[offset + 14];
      bounds.min.x = Math.min(bounds.min.x, x - radius); bounds.max.x = Math.max(bounds.max.x, x + radius);
      bounds.min.y = Math.min(bounds.min.y, y - radius); bounds.max.y = Math.max(bounds.max.y, y + radius);
      bounds.min.z = Math.min(bounds.min.z, z - radius); bounds.max.z = Math.max(bounds.max.z, z + radius);
      active++;
    }
    this.mesh.count = active; this.mesh.visible = active > 0;
    if (active) bounds.getBoundingSphere(this.mesh.boundingSphere);
    else { this.mesh.boundingSphere.center.set(0, 0, 0); this.mesh.boundingSphere.radius = 0; }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    if (this.disposed) return;
    for (const p of this.particles) { p.life = 0; p.mesh.visible = false; }
    this.mesh.count = 0; this.mesh.visible = false;
    this.mesh.boundingBox.makeEmpty(); this.mesh.boundingSphere.center.set(0, 0, 0); this.mesh.boundingSphere.radius = 0;
  }

  dispose() {
    if (this.disposed) return;
    this.clear(); this.mesh.removeFromParent();
    this.mesh.dispose(); this.geometry.dispose(); this.material.dispose();
    this.disposed = true;
  }
}
