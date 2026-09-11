import * as THREE from 'three';
import { LOOP_START, LOOP_END } from './core.mjs';
import { raceCrew } from './crew.mjs';

function polygon(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath(); return shape;
}

function icons() {
  const star = polygon(Array.from({ length: 10 }, (_, i) => {
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .31 : .72;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }));
  const drop = new THREE.Shape();
  drop.moveTo(0, .8); drop.bezierCurveTo(-.2, .35, -.58, .06, -.52, -.28);
  drop.bezierCurveTo(-.4, -.88, .4, -.88, .52, -.28); drop.bezierCurveTo(.58, .06, .2, .35, 0, .8);
  const eyes = [-.3, .3].map(x => { const s = new THREE.Shape(); s.absarc(x, .25, .095, 0, Math.PI * 2); return s; });
  const smile = new THREE.Shape();
  smile.moveTo(-.52, -.12); smile.quadraticCurveTo(0, -.86, .52, -.12);
  smile.lineTo(.39, -.07); smile.quadraticCurveTo(0, -.57, -.39, -.07); smile.closePath();
  return {
    hello: new THREE.ShapeGeometry([...eyes, smile]),
    star: new THREE.ShapeGeometry(star),
    jump: new THREE.ShapeGeometry(polygon([[-.65, .12], [0, .78], [.65, .12], [.25, .12], [.25, -.66], [-.25, -.66], [-.25, .12]])),
    turbo: new THREE.ShapeGeometry(polygon([[.12, .8], [-.58, -.12], [-.08, -.12], [-.2, -.85], [.6, .24], [.08, .24]])),
    splash: new THREE.ShapeGeometry(drop, 16),
  };
}

/** Pictorial, camera-facing reactions. Fixed owned geometry; no text or textures. */
export class BuddySignals {
  constructor(scene, crew = raceCrew()) {
    this.disposed = false;
    this.icons = icons();
    this.circle = new THREE.CircleGeometry(1, 32);
    this.tail = new THREE.ShapeGeometry(polygon([[-.28, -.75], [0, -1.34], [.28, -.75]]));
    this.geometries = new Set([this.circle, this.tail, ...Object.values(this.icons)]);
    this.cream = new THREE.MeshBasicMaterial({ color: 0xfff6db, depthWrite: false });
    this.ink = new THREE.MeshBasicMaterial({ color: 0x17485a, depthWrite: false });
    this.accents = crew.map(({ color }) => new THREE.MeshBasicMaterial({ color, depthWrite: false }));
    this.materials = new Set([this.cream, this.ink, ...this.accents]);
    this.badges = this.accents.map((accent, i) => {
      const badge = new THREE.Group(); badge.name = `buddy-signal-${i}`;
      const tail = new THREE.Mesh(this.tail, accent);
      const rim = new THREE.Mesh(this.circle, accent); rim.scale.setScalar(1.15);
      const face = new THREE.Mesh(this.circle, this.cream); face.position.z = .025;
      const icon = new THREE.Mesh(this.icons.hello, this.ink); icon.position.z = .05; icon.name = 'pictogram';
      // These overlay layers do not write depth. Explicit ordering keeps the
      // opaque material sorter from painting the colored rim over the icon.
      [tail, rim, face, icon].forEach((mesh, layer) => { mesh.renderOrder = 20 + layer; });
      badge.add(tail, rim, face, icon); badge.visible = false; scene.add(badge); return badge;
    });
  }

  get visibleCount() { return this.badges.filter(badge => badge.visible).length; }

  update(dt, { race, poses, trucks, camera, reducedMotion = false, visible = true }) {
    if (this.disposed) return;
    if (!visible) { this.badges.forEach(b => { b.visible = false; }); return; }
    if (!Number.isFinite(dt) || dt <= 0 || race?.phase === 'paused') return;
    this.badges.forEach((badge, i) => {
      const pose = poses[i];
      badge.visible = Boolean(camera && pose?.signalTime > 0 && this.icons[pose.signal]
        && !(pose.distance > LOOP_START - 20 && pose.distance < LOOP_END + 20));
      if (!badge.visible) return;
      badge.getObjectByName('pictogram').geometry = this.icons[pose.signal];
      badge.userData.signal = pose.signal;
      badge.position.copy(trucks[i].group.position); badge.position.y += 3.6;
      badge.quaternion.copy(camera.quaternion);
      badge.scale.setScalar(.66 * (reducedMotion ? 1 : 1 + .055 * Math.sin(pose.signalTime * 8)));
    });
  }

  reset(crew) {
    if (this.disposed) return;
    this.badges.forEach((badge, i) => {
      if (crew?.[i]) { this.accents[i].color.setHex(crew[i].color); badge.name = `buddy-signal-${crew[i].id}`; }
      badge.visible = false; badge.position.set(0, 0, 0); badge.quaternion.identity(); badge.scale.setScalar(1);
      badge.userData.signal = ''; badge.getObjectByName('pictogram').geometry = this.icons.hello;
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.badges.forEach(b => b.removeFromParent());
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
  }
}
