import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SMASH_TARGETS, getSmashTargets } from './encounters.mjs';
import { sampleTrack, laneOffset } from './track.mjs';

/** Fixed authored toys. Only the simulation can break one or award its stars. */
export class SmashTargets {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'smash-playground'; scene.add(this.group);
    this.geometry = new RoundedBoxGeometry(1, 1, 1, 2, .07);
    this.barrel = new THREE.CylinderGeometry(.5, .5, 1, 16);
    this.materials = [0xffb942, 0x48bcc5, 0xf27c65, 0x9c88d6, 0xf6e4b4, 0xa36d43].map(color => new THREE.MeshStandardMaterial({ color, roughness: .68 }));
    this.targets = SMASH_TARGETS.map((definition, index) => {
      const group = new THREE.Group(); group.name = definition.id;
      const frame = sampleTrack(definition.distance);
      group.position.copy(frame.position).addScaledVector(frame.right, laneOffset(definition.lane)); group.quaternion.copy(frame.quaternion);
      this.group.add(group);
      const parts = [];
      const add = (geometry, position, scale, color) => {
        const mesh = new THREE.Mesh(geometry, this.materials[color]); mesh.position.set(...position); mesh.scale.set(...scale);
        // Bodies cast the toy silhouette. Thin painted braces and barrel rings
        // receive lighting without adding tiny separate shadow-map draws.
        mesh.castShadow = scale[1] > .15 && scale[2] > .1; mesh.receiveShadow = true; group.add(mesh);
        parts.push({ mesh, rest: mesh.position.clone(), size: mesh.scale.clone() });
      };
      if (definition.kind === 'barrels') {
        for (let i = 0; i < 3; i++) {
          const x = (i - 1) * 1.03;
          add(this.barrel, [x, .69, 0], [.94, 1.36, .94], (index + i) % 4);
          for (const y of [.27, 1.12]) add(this.barrel, [x, y, 0], [.99, .12, .99], 4);
        }
      } else {
        // A low broad stack reads as a toy obstacle, including from behind.
        for (let row = 0; row < 2; row++) for (let col = 0; col < 3 - row; col++) {
          const x = (col - (2 - row) / 2) * 1.03;
          add(this.geometry, [x, .51 + row * .96, 0], [.96, .96, 1.14], definition.kind === 'crates' ? 5 : (index + col + row) % 4);
          if (definition.kind === 'crates') {
            add(this.geometry, [x, .51 + row * .96, -.586], [.12, .92, .045], 4);
            add(this.geometry, [x, .51 + row * .96, -.587], [.9, .11, .046], 4);
          }
        }
      }
      return { ...definition, group, parts, age: 0, hit: false };
    });
    this.disposed = false; this.reset();
  }
  reset() {
    if (this.disposed) return;
    this.group.visible = false;
    for (const target of this.targets) {
      target.hit = false; target.age = 0;
      for (const part of target.parts) { part.mesh.position.copy(part.rest); part.mesh.scale.copy(part.size); part.mesh.rotation.set(0, 0, 0); }
    }
  }
  update(dt, { race, mode, reducedMotion = false }) {
    if (this.disposed) return;
    if (mode !== 'race') { this.group.visible = false; return; }
    if (race.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
    this.group.visible = true;
    if(this.courseId!==race.courseId||!this.allowed){this.courseId=race.courseId;this.allowed=new Set(getSmashTargets(race.courseId).map(target=>target.id));}
    for (const target of this.targets) {
      target.group.visible = Math.abs(target.distance - race.distance) < 180 && this.allowed.has(target.id);
      if (!race.smashedTargets?.includes(target.id)) continue;
      target.hit = true; target.age = reducedMotion ? 1 : Math.min(1, target.age + Math.min(dt, .1) / .65);
      const t = target.age, hop = reducedMotion ? 0 : Math.sin(t * Math.PI) * 1.4;
      target.parts.forEach((part, index) => {
        const side = index % 2 ? 1 : -1;
        part.mesh.position.set(part.rest.x + side * t * (1 + index % 3 * .35), part.rest.y * (1 - t) + .14 * t + hop, part.rest.z - t * (index % 4 * .45));
        part.mesh.scale.set(part.size.x, part.size.y * (1 - t * .76), part.size.z);
        part.mesh.rotation.z = side * t * .32;
      });
    }
  }
  get diagnostics() { return { count: this.targets.length, broken: this.targets.filter(target => target.hit).map(target => target.id) }; }
  dispose() {
    if (this.disposed) return;
    this.group.removeFromParent(); this.geometry.dispose(); this.barrel.dispose(); this.materials.forEach(material => material.dispose()); this.disposed = true;
  }
}
