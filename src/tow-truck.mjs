import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeBuddyTruck, disposeBuddyTruck } from './buddy-models.mjs';
import { sampleTrack, laneOffset } from './track.mjs';

const UP = new THREE.Vector3(0, 1, 0);

/** A cached original rescue pickup. Rules own every phase and the elapsed
 * clock; this renderer only poses borrowed recovery data and owned meshes. */
export class TowTruck {
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'roadside-rescue';
    this.truck = makeBuddyTruck({ id: 'tow-rescue', style: 'tow-rescue', scale: 1,
      color: 0xf68732, accent: 0xffe6a0 });
    this.group.add(this.truck.group);
    this.geometries = new Set(); this.materials = new Set();
    const paint = (color, metalness = 0) => { const material = new THREE.MeshStandardMaterial({ color, roughness: .5, metalness }); this.materials.add(material); return material; };
    const steel = paint(0x53636a, .5), cream = paint(0xffefbf), lamp = paint(0xffbc39), cablePaint = paint(0x344851, .2);
    const add = (geometry, material, position, parent = this.truck.body) => {
      this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position);
      mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    add(new RoundedBoxGeometry(2.1, .58, .48, 2, .08), steel, [0, 1.42, 2.05]);
    this.drum = add(new THREE.CylinderGeometry(.25, .25, 1.22, 16), cream, [0, 1.62, 2.22]); this.drum.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      const flange = add(new THREE.CylinderGeometry(.34, .34, .1, 16), steel, [side * .66, 1.62, 2.22]); flange.rotation.z = Math.PI / 2;
      add(new RoundedBoxGeometry(.54, .26, .38, 2, .05), lamp, [side * .72, 3.64, -.2]);
    }
    add(new RoundedBoxGeometry(2.25, .18, .5, 2, .05), cream, [0, 3.47, -.2]);
    this.cable = add(new THREE.CylinderGeometry(.04, .04, 1, 8), cablePaint, [0, 0, 0], this.group); this.cable.castShadow = false;
    this.start = new THREE.Vector3(); this.end = new THREE.Vector3(); this.delta = new THREE.Vector3(); this.direction = new THREE.Vector3();
    this.disposed = false; this.reset();
  }

  reset() {
    if (this.disposed) return;
    this.group.visible = false; this.cable.visible = false; this.phase = null; this.elapsed = 0;
    this.drum.rotation.set(0, 0, Math.PI / 2);
    this.truck.wheels.forEach(wheel => wheel.rotation.set(0, 0, 0));
  }

  update(dt, race) {
    if (this.disposed) return;
    const recovery = race?.recovery;
    if (!recovery || !['running', 'paused'].includes(race.phase)) { this.reset(); return; }
    if (race.phase === 'paused' || !Number.isFinite(dt) || dt <= 0) return;
    if (!['hook', 'pull', 'release'].includes(recovery.phase) ||
        ![recovery.distance, recovery.fromLane, recovery.elapsed, recovery.duration, race.lane].every(Number.isFinite) || recovery.duration <= 0) { this.reset(); return; }
    const frame = sampleTrack(recovery.distance), side = Math.sign(recovery.fromLane) || 1;
    this.group.visible = true; this.group.position.copy(frame.position); this.group.quaternion.copy(frame.quaternion);
    this.truck.group.position.set(side * 14.5, 0, 0); this.truck.group.rotation.set(0, -side * Math.PI / 2, 0);
    this.phase = recovery.phase; this.elapsed = Math.max(0, Math.min(recovery.duration, recovery.elapsed));
    this.drum.rotation.x = Math.max(0, Math.min(2.2, this.elapsed - .4)) * 5;
    const truckScale = Number.isFinite(race.truckScale) && race.truckScale > 0 ? race.truckScale : 1;
    this.start.set(side * 12.2, 1.62, 0);
    this.end.set(laneOffset(race.lane) + side * 2.1 * truckScale, 1.6 * truckScale, 0);
    this.delta.subVectors(this.end, this.start);
    this.cable.visible = recovery.phase !== 'release';
    this.cable.position.copy(this.start).add(this.end).multiplyScalar(.5);
    this.cable.quaternion.setFromUnitVectors(UP, this.direction.copy(this.delta).normalize());
    this.cable.scale.set(1, this.delta.length(), 1);
    this.group.updateMatrixWorld(true);
  }

  get diagnostics() { return Object.freeze({ visible: this.group.visible, phase: this.phase, elapsed: this.elapsed, disposed: this.disposed }); }

  dispose() {
    if (this.disposed) return;
    this.reset(); this.group.removeFromParent(); disposeBuddyTruck(this.truck);
    this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose());
    this.disposed = true;
  }
}
