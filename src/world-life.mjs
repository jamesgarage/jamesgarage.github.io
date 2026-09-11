import * as THREE from 'three';
import { sampleTrack } from './track.mjs';

const TAU = Math.PI * 2;
const BUTTERFLY_HABITATS = [[96, -18], [216, 19], [480, -19], [744, 20]];
const REED_HABITATS = [[1152, 25], [1248, -24], [1512, 24], [1728, -25]];
const COLORS = [0xffc64a, 0xf48672, 0xfff1a8];
const seedValue = value => Number.isFinite(value) ? Math.trunc(value) >>> 0 : 0;
const variation = (seed, index) => {
  let n = (seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x21f0aaad); n = Math.imul(n ^ n >>> 15, 0x735a2d97);
  return ((n ^ n >>> 15) >>> 0) / 4294967296;
};

function wingGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(.26, .58); shape.lineTo(.74, .58);
  shape.lineTo(.9, .3); shape.lineTo(.58, -.07); shape.lineTo(.59, -.42);
  shape.lineTo(.26, -.51); shape.lineTo(0, -.13); shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** Fixed, original roadside life. Never reads or changes a truck's controls. */
export class WorldLife {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'living-roadside';
    this.disposed = false; this.time = 0; this.variant = 0;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.habitats = [];
    const wing = wingGeometry(), body = new THREE.CylinderGeometry(.055, .085, .58, 5);
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .11, .55, 0, .06, 1, .14, -.09, .52, 0], 3));
    blade.setIndex([0, 1, 2, 0, 2, 3]); blade.computeVertexNormals();
    const head = new THREE.CylinderGeometry(.11, .12, .5, 5);
    const ripple = new THREE.RingGeometry(.94, 1, 28); ripple.rotateX(-Math.PI / 2);
    const wingPaint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .86, side: THREE.DoubleSide });
    const bodyPaint = new THREE.MeshStandardMaterial({ color: 0x654937, roughness: .94 });
    const leafPaint = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .94, side: THREE.DoubleSide });
    const ripplePaint = new THREE.MeshStandardMaterial({ color: 0xa9e4d1, roughness: .3, side: THREE.DoubleSide });
    this.geometries = new Set([wing, body, blade, head, ripple]);
    this.materials = new Set([wingPaint, bodyPaint, leafPaint, ripplePaint]);
    const instances = (geometry, paint, count, name, parent) => {
      const mesh = new THREE.InstancedMesh(geometry, paint, count); mesh.name = name;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(mesh); return mesh;
    };
    for (const [distance, lateral] of BUTTERFLY_HABITATS) {
      const frame = sampleTrack(distance), group = new THREE.Group();
      group.position.copy(frame.position).addScaledVector(frame.right, lateral); group.position.y = 3.7;
      group.name = `butterfly-meadow-${distance}`; this.group.add(group);
      this.habitats.push({ kind: 'butterflies', distance, lateral, group,
        wings: instances(wing, wingPaint, 8, 'butterfly-wings', group),
        bodies: instances(body, bodyPaint, 4, 'butterfly-bodies', group), accents: [] });
    }
    for (const [distance, lateral] of REED_HABITATS) {
      const frame = sampleTrack(distance), group = new THREE.Group();
      group.position.copy(frame.position).addScaledVector(frame.right, lateral); group.position.y = -1.67;
      group.name = `lagoon-reeds-${distance}`; this.group.add(group);
      this.habitats.push({ kind: 'reeds', distance, lateral, group,
        leaves: instances(blade, leafPaint, 28, 'shoreline-leaves', group),
        heads: instances(head, bodyPaint, 8, 'cattail-seedheads', group),
        ripples: instances(ripple, ripplePaint, 3, 'lagoon-ripples', group), accents: [] });
    }
    scene.add(this.group); this.reset();
    // Fixed conservative local bounds include every phase of the small motions.
    // Per-habitat culling avoids submitting life from the whole course each frame.
    for (const habitat of this.habitats) for (const mesh of habitat.group.children) {
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 9);
      mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-8, -3, -8), new THREE.Vector3(8, 8, 8));
    }
  }

  get diagnostics() {
    return Object.freeze({ variant: this.variant, time: this.time, disposed: this.disposed,
      habitats: this.disposed ? 0 : 8, butterflies: this.disposed ? 0 : 16,
      reedBlades: this.disposed ? 0 : 112, ripples: this.disposed ? 0 : 12,
      meshes: this.disposed ? 0 : 20, geometries: this.disposed ? 0 : this.geometries.size,
      materials: this.disposed ? 0 : this.materials.size });
  }

  reset(variant = 0) {
    if (this.disposed) return;
    this.variant = seedValue(variant); this.time = 0;
    let index = 0;
    for (const habitat of this.habitats) {
      habitat.accents = Array.from({ length: habitat.kind === 'butterflies' ? 4 : 8 }, () => variation(this.variant, index++));
    }
    this.draw();
  }

  update(dt, { race, reducedMotion = false, mode = 'race' } = {}) {
    // No time, transforms, visibility or GPU-buffer writes on a frozen frame.
    if (this.disposed || !Number.isFinite(dt) || dt <= 0 || reducedMotion) return;
    if (mode !== 'menu' && (mode !== 'race' || race?.phase !== 'running')) return;
    this.time = (this.time + Math.min(dt, .1)) % 3600;
    this.draw();
  }

  draw() {
    const dummy = this.dummy, t = this.time;
    for (const habitat of this.habitats) {
      if (habitat.kind === 'butterflies') {
        for (let i = 0; i < 4; i++) {
          const phase = habitat.accents[i] * TAU, flight = t * .52 + phase;
          const x = (i - 1.5) * 1.25 + Math.sin(flight) * .65;
          const y = Math.sin(flight * 1.4) * .4 + (i % 2) * .7;
          const z = Math.cos(flight) * 1.1 + (i % 2) * 1.4;
          const turn = Math.sin(flight) * .5;
          for (const side of [-1, 1]) {
            dummy.position.set(x, y, z); dummy.rotation.set(-.15, turn + side * (.3 + Math.sin(t * 8 + phase) * .62), 0);
            // A half turn mirrors the other wing without a negative determinant.
            if (side < 0) dummy.rotation.y += Math.PI;
            dummy.scale.setScalar(.72 + habitat.accents[i] * .24); dummy.updateMatrix();
            habitat.wings.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
            habitat.wings.setColorAt(i * 2 + (side > 0 ? 1 : 0), this.color.setHex(COLORS[(i + this.variant % 3) % 3]));
          }
          dummy.position.set(x, y, z); dummy.rotation.set(-.15, turn, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
          habitat.bodies.setMatrixAt(i, dummy.matrix);
        }
      } else {
        for (let i = 0; i < 28; i++) {
          const cluster = Math.floor(i / 7), blade = i % 7, phase = habitat.accents[i % 8] * TAU;
          const bend = .09 * Math.sin(t * .7 + phase) + (blade - 3) * .09;
          const height = 2.4 + (i % 5) * .25;
          dummy.position.set((cluster - 1.5) * 1.45 + Math.sin(blade * 3) * .4, 0, Math.cos(blade * 2) * .5 + cluster % 2);
          dummy.rotation.set(.1, blade * 2.4, bend); dummy.scale.set(1.7, height, 1.7); dummy.updateMatrix();
          habitat.leaves.setMatrixAt(i, dummy.matrix);
          habitat.leaves.setColorAt(i, this.color.setHex(i % 3 === 0 ? 0xa7b45b : i % 3 === 1 ? 0x528552 : 0x789d54));
          if (blade < 2) {
            dummy.position.x -= Math.sin(bend) * height * .86;
            dummy.position.y = height * .9; dummy.rotation.set(.1, 0, bend); dummy.scale.setScalar(1); dummy.updateMatrix();
            habitat.heads.setMatrixAt(cluster * 2 + blade, dummy.matrix);
          }
        }
        for (let i = 0; i < 3; i++) {
          const phase = habitat.accents[i] * TAU;
          const size = 1.75 + i * .55 + Math.sin(t * .65 + phase) * .16;
          dummy.position.set(-1 + i * 1.3, .045 + i * .003, -1.7 - i * .6);
          dummy.rotation.set(0, .2 * i, 0); dummy.scale.set(size, 1, size * .64); dummy.updateMatrix();
          habitat.ripples.setMatrixAt(i, dummy.matrix);
        }
      }
      for (const mesh of habitat.group.children) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.group.removeFromParent();
    for (const habitat of this.habitats) for (const mesh of habitat.group.children) mesh.dispose();
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.group.clear(); this.habitats.length = 0; this.geometries.clear(); this.materials.clear();
  }
}
