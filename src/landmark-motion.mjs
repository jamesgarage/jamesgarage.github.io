const TAU = Math.PI * 2;
const seedValue = value => Number.isFinite(value) ? Math.trunc(value) >>> 0 : 0;

/** Borrows factory-owned pivots; owns no geometry, material, texture or timer. */
export class LandmarkMotion {
  constructor(targets = []) {
    this.targets = targets.map(target => ({ ...target, phase: 0 }));
    this.disposed = false; this.time = 0; this.variant = 0;
    this.reset();
  }

  get diagnostics() {
    return Object.freeze({ disposed: this.disposed, time: this.time, variant: this.variant,
      targets: this.targets.length, angles: Object.freeze(this.targets.map(target => target.pivot.rotation.z)) });
  }

  reset(variant = 0) {
    if (this.disposed) return;
    this.variant = seedValue(variant); this.time = 0;
    for (let index = 0; index < this.targets.length; index++) {
      const target = this.targets[index];
      // A small reproducible phase preserves each landmark's familiar pose.
      const n = Math.imul(this.variant, 0x9e3779b9 + index * 2) >>> 0;
      target.phase = this.variant ? (n / 4294967296 - .5) * .28 : 0;
      target.pivot.rotation.z = target.phase;
    }
  }

  update(dt, { race, mode = 'race', reducedMotion = false } = {}) {
    // Freeze before any clock, transform or buffer can change.
    if (this.disposed || reducedMotion || !Number.isFinite(dt) || dt <= 0) return;
    if (mode !== 'menu' && (mode !== 'race' || race?.phase !== 'running')) return;
    const step = Math.min(dt, .1);
    this.time += step;
    for (const target of this.targets) {
      target.pivot.rotation.z = (target.pivot.rotation.z + target.speed * step) % TAU;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.targets.length = 0;
  }
}
