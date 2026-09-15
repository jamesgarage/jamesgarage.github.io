import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeTruck, disposeTruck } from './models.mjs';
import { makeBuddyTruck, disposeBuddyTruck } from './buddy-models.mjs';
import { poseGuardian } from './guardian-pose.mjs';

const EMPTY = Object.freeze({});
const HOME = Object.freeze([0, .82, .4]);
const SPOTS = Object.freeze([[-4.9, 4], [-4.9, -4], [4.9, -4], [4.9, 4]].map(Object.freeze));
const HOP = .7, PRESS = .24, HOLD = .12, STEP = HOP + PRESS + HOLD;
const RETURN = .8, RESTORE = .7, DURATION = STEP * 4 + RETURN + RESTORE;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const ease = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

function visibleBounds(group) {
  const bounds = new THREE.Box3(), piece = new THREE.Box3();
  group.updateMatrixWorld(true);
  // Hidden guardian meshes must not determine the display scale of a truck.
  group.traverseVisible(object => {
    if (!object.isMesh) return;
    object.geometry.computeBoundingBox();
    piece.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    bounds.union(piece);
  });
  return bounds;
}

function checkParticipants(participants, winnerId) {
  if (!Array.isArray(participants) || participants.length !== 5 ||
      new Set(participants.map(p => p?.id)).size !== 5 ||
      !participants.some(p => p?.id === winnerId) ||
      participants.filter(p => p?.kind === 'player').length !== 1 ||
      participants.some(p => !p || typeof p.id !== 'string' || !p.id ||
        !['player', 'buddy'].includes(p.kind) || !p.spec || typeof p.spec.id !== 'string' ||
        !Number.isFinite(p.spec.color) || !Number.isFinite(p.spec.accent) ||
        !Number.isFinite(p.spec.scale) || p.spec.scale <= 0)) {
    throw new TypeError('A victory ceremony needs five distinct model participants and their actual winner.');
  }
}

/** A small, independent display scene. The application supplies its existing
 * renderer and final standings; this controller never changes a race or save. */
export class VictoryCeremony {
  constructor({ environment = null } = {}) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa7deed);
    this.scene.environment = environment; // Borrowed from GameScene; never disposed here.
    this.scene.environmentIntensity = .65;
    this.camera = new THREE.PerspectiveCamera(36, 1, .1, 150);
    this.group = new THREE.Group(); this.group.name = 'victory-ceremony';
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight(0xe5f7ff, 0x75a48a, 2));
    const sun = new THREE.DirectionalLight(0xffefd6, 2.8);
    sun.position.set(-12, 20, 16); this.scene.add(sun);
    this.geometries = new Set(); this.materials = new Set();
    this.actors = []; this.losers = []; this.winner = null;
    this.active = false; this.disposed = false; this.phase = 'idle';
    this.elapsed = 0; this.time = 0; this.contactMask = 0; this.stompCount = 0;
    this.reducedMotion = false;
    this._back = new THREE.Vector3(.24, .48, .844).normalize();
    this._right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this._back).normalize();
    this._up = new THREE.Vector3().crossVectors(this._back, this._right).normalize();
    this._center = new THREE.Vector3(0, 4.9, 0);
    this._point = new THREE.Vector3();
    this.buildStage();
    this.group.visible = false;
    this.resize(1024, 768);
  }

  buildStage() {
    const batches = new Map();
    const part = (geometry, color, x, y, z, rx = 0) => {
      if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
      geometry.rotateX(rx); geometry.translate(x, y, z);
      if (!batches.has(color)) batches.set(color, []);
      batches.get(color).push(geometry);
    };
    const box = (color, x, y, z, w, h, d, radius = .12) =>
      part(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), color, x, y, z);
    const disc = (color, x, y, z, radius, height) => part(new THREE.CylinderGeometry(radius, radius, height, 48), color, x, y, z);
    const cream = 0xfff1c8, gold = 0xffca48, teal = 0x4dbcae, blue = 0x428dab, coral = 0xf38d6d;
    disc(teal, 0, -.32, 0, 12.4, .5);
    disc(cream, 0, -.08, 0, 11.8, .16);
    disc(0x99d6bc, 0, .012, 0, 11.45, .024);
    disc(gold, HOME[0], .12, HOME[2], 2.9, .24);
    disc(blue, HOME[0], .46, HOME[2], 2.72, .6);
    disc(cream, HOME[0], .78, HOME[2], 2.82, .08);
    // Four colored parking mats keep each recovering toy easy to follow.
    for (const [i, spot] of SPOTS.entries()) {
      disc([gold, coral, blue, teal][i], spot[0], .035, spot[1], 2.02, .035);
      disc(cream, spot[0], .057, spot[1], 1.79, .012);
    }
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .22 : .46;
      if (i) star.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else star.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    star.closePath();
    part(new THREE.ExtrudeGeometry(star, { depth: .07, bevelEnabled: true, bevelThickness: .035, bevelSize: .025, bevelSegments: 1, steps: 1 }), gold, 0, .48, 3.11);
    // Compact toy stands and a checkered arch, all batched by paint.
    for (let row = 0; row < 3; row++) {
      box(blue, 0, .25 + row * .62, -9.2 - row * .55, 17.8, .5, 1.3);
      for (let seat = 0; seat < 14; seat++) box([coral, gold, teal][(seat + row) % 3],
        (seat - 6.5) * 1.16, .61 + row * .62, -9.04 - row * .55, .78, .3, .65);
    }
    for (const side of [-1, 1]) {
      part(new THREE.CylinderGeometry(.15, .15, 5.7, 10), cream, side * 9.1, 2.85, -7.75);
      part(new THREE.SphereGeometry(.27, 12, 8), gold, side * 9.1, 5.83, -7.75);
      box(side < 0 ? coral : teal, side * 8.32, 5.25, -7.75, 1.38, .72, .1);
      for (let shrub = 0; shrub < 3; shrub++) part(new THREE.SphereGeometry(.9, 14, 9), 0x4ea893,
        side * (10.1 + (shrub % 2) * .35), .7, -4.8 + shrub * 2.7);
    }
    box(cream, 0, 4.45, -8.3, 14.6, 1.02, .3);
    for (let row = 0; row < 2; row++) for (let column = 0; column < 20; column++) {
      if ((row + column) % 2) continue;
      box(0x285269, (column - 9.5) * .7, 4.2 + row * .49, -8.1, .68, .46, .07, .02);
    }
    // A proper handled cup between the rear parking mats makes the finish
    // venue recognizable even before the winner starts its playful stomp.
    const trophyGold = 0xeeb832;
    disc(blue, 0, .25, -5.9, 1.35, .5);
    disc(cream, 0, .53, -5.9, 1.4, .06);
    disc(trophyGold, 0, .66, -5.9, .83, .18);
    part(new THREE.CylinderGeometry(.21, .27, 1.1, 20), trophyGold, 0, 1.29, -5.9);
    const cup = [[.18, -.65], [.48, -.6], [.73, -.38], [.98, 0], [1.12, .48], [1.08, .64],
      [.97, .64], [.99, .48], [.83, .02], [.62, -.29], [.36, -.47], [0, -.47]];
    part(new THREE.LatheGeometry(cup.map(([r, y]) => new THREE.Vector2(r, y)), 36), trophyGold, 0, 2.5, -5.9);
    for (const side of [-1, 1]) part(new THREE.TorusGeometry(.58, .11, 8, 28), trophyGold, side * 1.02, 2.56, -5.9);
    for (const [color, pieces] of batches) {
      const material = new THREE.MeshStandardMaterial({ color, roughness: color === trophyGold ? .3 : .54, metalness: color === trophyGold ? .5 : .05 });
      this.materials.add(material);
      const geometry = mergeGeometries(pieces, false);
      for (const piece of pieces) piece.dispose();
      geometry.computeBoundingBox(); geometry.computeBoundingSphere(); this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.name = 'ceremony-stage'; this.group.add(mesh);
    }
    this.shadowGeometry = new THREE.CircleGeometry(1, 28);
    this.shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x214c51, transparent: true, opacity: .17, depthWrite: false });
    this.geometries.add(this.shadowGeometry); this.materials.add(this.shadowMaterial);
  }

  start({ participants, winnerId, reducedMotion = false } = {}) {
    if (this.disposed) return false;
    checkParticipants(participants, winnerId);
    this.reset();
    this.reducedMotion = reducedMotion === true;
    try {
      for (const participant of participants) {
        const entry = { ...participant };
        const truck = entry.kind === 'player' ? makeTruck(entry.spec) : makeBuddyTruck(entry.spec);
        if (entry.kind === 'player') poseGuardian(truck, { menu: true, time: 0 });
        const root = new THREE.Group(), squash = new THREE.Group(), presentation = new THREE.Group();
        root.name = `ceremony-${entry.id}`; squash.name = 'toy-squash';
        root.add(squash); squash.add(presentation); presentation.add(truck.group);
        const bounds = visibleBounds(truck.group), size = bounds.getSize(new THREE.Vector3());
        const isWinner = entry.id === winnerId, scale = (isWinner ? 4.1 : 3.05) / size.x;
        truck.group.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
        presentation.scale.setScalar(scale);
        const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
        shadow.name = `ceremony-shadow-${entry.id}`; shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1;
        const actor = { entry, truck, root, squash, presentation, shadow, width: size.x * scale, height: size.y * scale, length: size.z * scale, x: 0, z: 0, crush: 0 };
        this.actors.push(actor); this.group.add(root, shadow);
        if (isWinner) this.winner = actor; else this.losers.push(actor);
      }
    } catch (error) { this.reset(); throw error; }
    this.losers.sort((a, b) => (a.entry.place || 5) - (b.entry.place || 5));
    for (let i = 0; i < this.losers.length; i++) {
      this.losers[i].x = SPOTS[i][0]; this.losers[i].z = SPOTS[i][1];
    }
    this.phase = 'ready'; this.active = true; this.group.visible = true;
    this.applyPose();
    this.resize(this.width, this.height);
    return true;
  }

  resize(width, height) {
    if (this.disposed || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    this.width = width; this.height = height; this.camera.aspect = width / height;
    const tanY = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanX = tanY * this.camera.aspect;
    const portrait = width < height, shortLandscape = !portrait && height < 560;
    const top = shortLandscape ? 65 : Math.min(120, height * .2);
    const bottom = shortLandscape ? 18 : Math.min(portrait ? 280 : 210, height * .4);
    const left = 16, right = shortLandscape ? Math.min(320, width * .38) + 16 : 16;
    const usableWidth = Math.max(80, width - left - right), usableHeight = Math.max(80, height - top - bottom);
    const padX = usableWidth / width * .91, padY = usableHeight / height * .92;
    // Fit the complete hop envelope into the exposed results viewport. The
    // projection shift keeps it above bottom actions (or beside short-screen actions).
    let distance = 0;
    const maxHeight = this.winner ? Math.max(...this.losers.map(a => a.height)) + this.winner.height + 3.2 : 10.8;
    this._center.set(0, maxHeight * .46, 0);
    for (const x of [-7.6, 7.6]) for (const y of [0, maxHeight]) for (const z of [-6.9, 6.9]) {
      this._point.set(x, y, z).sub(this._center);
      const depth = this._point.dot(this._back);
      distance = Math.max(distance, depth + Math.abs(this._point.dot(this._right)) / (tanX * padX),
        depth + Math.abs(this._point.dot(this._up)) / (tanY * padY));
    }
    this.camera.position.copy(this._center).addScaledVector(this._back, distance + .6);
    this.camera.lookAt(this._center); this.camera.far = Math.max(150, distance + 50);
    this.camera.updateProjectionMatrix();
    this.camera.projectionMatrix.elements[8] = -(2 * (left + usableWidth / 2) / width - 1);
    this.camera.projectionMatrix.elements[9] = -(1 - 2 * (top + usableHeight / 2) / height);
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
    this.camera.updateMatrixWorld(true);
  }

  stomp() {
    if (this.disposed || !this.active || this.phase === 'stomping') return false;
    this.phase = 'stomping'; this.elapsed = 0; this.contactMask = 0; this.stompCount++;
    this.applyPose(); return true;
  }

  update(dt, { paused = false, reducedMotion = this.reducedMotion } = EMPTY) {
    if (this.disposed || !this.active || paused || !Number.isFinite(dt) || dt <= 0) return;
    const step = Math.min(dt, .1);
    this.time += step; this.reducedMotion = reducedMotion === true;
    if (this.phase === 'ready') {
      this.elapsed += step;
      if (this.elapsed >= 2) this.stomp();
    } else if (this.phase === 'stomping') {
      this.elapsed = Math.min(DURATION, this.elapsed + step);
      for (let i = 0; i < 4; i++) if (this.elapsed >= i * STEP + HOP) this.contactMask |= 1 << i;
      if (this.elapsed >= DURATION) this.phase = 'restored';
    }
    this.applyPose();
  }

  applyPose() {
    if (!this.winner) return;
    const running = this.phase === 'stomping', elapsed = running ? this.elapsed : 0;
    const restore = running ? ease((elapsed - (STEP * 4 + RETURN)) / RESTORE) : 1;
    for (let i = 0; i < this.losers.length; i++) {
      const actor = this.losers[i];
      const crush = running ? ease((elapsed - i * STEP - HOP) / PRESS) * (1 - restore) : 0;
      actor.crush = crush;
      actor.root.position.set(actor.x, .068, actor.z); actor.root.rotation.set(0, -.12, 0);
      actor.squash.scale.set(1 + crush * .08, 1 - crush * .78, 1 + crush * .08);
      if (running && restore > 0 && restore < 1 && !this.reducedMotion) {
        const pop = Math.sin(restore * Math.PI) * .22;
        actor.root.position.y += pop;
      }
      actor.shadow.position.set(actor.x, .078, actor.z); actor.shadow.scale.set(actor.width * .54, actor.length * .5, 1);
    }
    const winner = this.winner;
    let x = HOME[0], y = HOME[1], z = HOME[2], pitch = 0;
    if (running && elapsed < STEP * 4) {
      const index = Math.min(3, Math.floor(elapsed / STEP)), local = elapsed - index * STEP;
      const target = this.losers[index], previous = index ? this.losers[index - 1] : null;
      const fromX = previous ? previous.x : HOME[0], fromZ = previous ? previous.z : HOME[2];
      const fromY = previous ? .068 + previous.height * .22 : HOME[1];
      if (local < HOP) {
        const progress = local / HOP, travel = ease(progress), arc = Math.sin(progress * Math.PI);
        x = THREE.MathUtils.lerp(fromX, target.x, travel); z = THREE.MathUtils.lerp(fromZ, target.z, travel);
        y = THREE.MathUtils.lerp(fromY, .068 + target.height, travel) + arc * (this.reducedMotion ? .35 : 2.35);
        pitch = this.reducedMotion ? 0 : -Math.sin(progress * Math.PI * 2) * .1;
      } else {
        x = target.x; z = target.z; y = .068 + target.height * (1 - target.crush * .78);
      }
    } else if (running && elapsed < STEP * 4 + RETURN) {
      const last = this.losers[3], progress = (elapsed - STEP * 4) / RETURN, travel = ease(progress);
      x = THREE.MathUtils.lerp(last.x, HOME[0], travel); z = THREE.MathUtils.lerp(last.z, HOME[2], travel);
      y = THREE.MathUtils.lerp(.068 + last.height * .22, HOME[1], travel) + Math.sin(progress * Math.PI) * (this.reducedMotion ? .3 : 2.4);
    }
    winner.root.position.set(x, y, z); winner.root.rotation.set(pitch, -.12, 0); winner.squash.scale.set(1, 1, 1);
    winner.shadow.position.set(x, x === HOME[0] && z === HOME[2] ? HOME[1] + .008 : .078, z);
    winner.shadow.scale.set(winner.width * .5, winner.length * .47, 1);
    // Every pose is absolute; repeated updates never accumulate deformation.
    this.group.updateMatrixWorld(true);
  }

  skip() {
    if (this.disposed || !this.active) return false;
    this.phase = 'restored'; this.elapsed = DURATION; this.applyPose(); return true;
  }

  reset() {
    if (this.disposed) return;
    for (const actor of this.actors) {
      actor.root.removeFromParent(); actor.shadow.removeFromParent();
      if (actor.entry.kind === 'player') disposeTruck(actor.truck); else disposeBuddyTruck(actor.truck);
    }
    this.actors.length = 0; this.losers.length = 0; this.winner = null;
    this.active = false; this.phase = 'idle'; this.elapsed = 0; this.time = 0; this.contactMask = 0; this.stompCount = 0;
    this.group.visible = false;
  }

  get diagnostics() {
    return Object.freeze({ active: this.active, phase: this.phase, winnerId: this.winner?.entry.id ?? null,
      elapsed: this.elapsed, stompCount: this.stompCount, complete: this.phase === 'restored',
      contactIds: this.losers.filter((_, i) => this.contactMask & (1 << i)).map(a => a.entry.id),
      participants: this.actors.map(a => ({ id: a.entry.id, kind: a.entry.kind, specId: a.entry.spec.id, place: a.entry.place,
        winner: a === this.winner, crush: a.crush, x: a.root.position.x, y: a.root.position.y, z: a.root.position.z })) });
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.group.removeFromParent(); this.scene.environment = null; this.disposed = true;
  }
}
