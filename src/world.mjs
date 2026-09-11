import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COURSE_LENGTH, LOOP_START, LOOP_END, RAMPS } from './core.mjs';
import { sampleTrack, trackCenter } from './track.mjs';
import { isAdventureClearing } from './adventure.mjs';
import { createSurfaceTexture, surfaceUVs } from './surfaces.mjs';
import { createShoreBankGeometry } from './shore-banks.mjs';

export const DRIVE_HALF_WIDTH = 8.02;

// A gently uneven shared silhouette reads as foliage/stone, without assigning
// hundreds of new sphere subdivisions to every distant tree in the forest.
function organicSphere(segments, rings, foliage = false) {
  let geometry = new THREE.SphereGeometry(1, segments, rings);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const bulge = 1 + .075 * Math.sin(x * 5.4 + y * 2) * Math.sin(z * 5.7 + 1.3) + .04 * Math.cos(y * 7 - z * 2.4);
    positions.setXYZ(i, x * bulge, y * (1 + .045 * Math.sin(x * 4 + z * 3)), z * bulge);
  }
  geometry.deleteAttribute('uv'); geometry.deleteAttribute('normal');
  const welded = mergeVertices(geometry); geometry.dispose(); geometry = welded;
  geometry.computeVertexNormals();
  // Other cached world primitives retain UVs for compatible material batches.
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
  if (foliage) {
    const colors = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      const y = geometry.attributes.position.getY(i);
      const light = .82 + .18 * (y + 1) / 2;
      colors.push(light, light, light);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  return geometry;
}

function palmTrunk() {
  const geometry = new THREE.CylinderGeometry(.12, .19, 3, 10, 5);
  const positions = geometry.attributes.position, colors = [];
  for (let i = 0; i < positions.count; i++) {
    const t = (positions.getY(i) + 1.5) / 3;
    positions.setX(i, positions.getX(i) + .4 * t * t);
    const shade = .83 + .17 * (Math.round(t * 5) % 2);
    colors.push(shade, shade, shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); return geometry;
}

function palmFrond() {
  const positions = [], indices = [], segments = 7;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, width = Math.sin(Math.PI * t) * .3;
    for (let side = 0; side < 4; side++) {
      const a = side / 4 * Math.PI * 2;
      positions.push(t * 2, .14 * Math.sin(Math.PI * t) - .55 * t * t + Math.sin(a) * width * .16, Math.cos(a) * width);
      if (i < segments) { const v = i * 4 + side, next = i * 4 + (side + 1) % 4; indices.push(v, v + 4, next, next, v + 4, next + 4); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rounded: new RoundedBoxGeometry(1, 1, 1, 1, .12),
  ball: new THREE.SphereGeometry(1, 12, 8),
  shore: createShoreBankGeometry(),
  rock: organicSphere(10, 6),
  crown: organicSphere(20, 12, true),
  farCrown: organicSphere(8, 6, true),
  hill: organicSphere(24, 14),
  palmTrunk: palmTrunk(),
  frond: palmFrond(),
  cone: new THREE.ConeGeometry(1, 1, 9),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 10),
};
const materials = new Map();
function material(color, roughness = .8, vertexColors = false, surface = '') {
  const key = `${color}:${roughness}:${vertexColors}:${surface}`;
  if (!materials.has(key)) {
    const map = surface ? createSurfaceTexture(surface) : null;
    const paint = new THREE.MeshStandardMaterial({ color, roughness, vertexColors, map, bumpMap: map, bumpScale: surface === 'wood' ? .045 : .07 });
    paint.userData.surface = surface; materials.set(key, paint);
  }
  return materials.get(key);
}
function piece(group, kind, color, position, scale, rotation = [0, 0, 0], shadow = true) {
  const foliage = kind === 'crown' || kind === 'farCrown';
  const shore = kind === 'shore';
  const surface = kind === 'rock' ? 'stone' : [0x8e5834, 0xbd8c51, 0x927055].includes(color) ? 'wood' : '';
  const mesh = new THREE.Mesh(geo[kind], material(color, foliage || surface || shore ? .94 : .8, foliage || kind === 'palmTrunk' || shore, surface));
  mesh.userData.canopy = foliage;
  mesh.userData.frond = kind === 'frond';
  mesh.userData.shore = shore;
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
  mesh.castShadow = shadow; mesh.receiveShadow = shadow;
  group.add(mesh); return mesh;
}
const box = (g, c, p, s, r, shadow = true) => piece(g, 'box', c, p, s, r, shadow);
const round = (g, c, p, s, r) => piece(g, 'rounded', c, p, s, r);
const ball = (g, c, p, s) => piece(g, 'ball', c, p, s);

// Deterministic placement gives each stretch an authored composition on reload.
function noise(n) { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); }
function batch(source) {
  source.updateMatrixWorld(true);
  const buckets = new Map();
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    const key = `${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material: mesh.material, cast: mesh.castShadow, receive: mesh.receiveShadow, canopy: mesh.userData.canopy === true, frond: mesh.userData.frond === true, shore: mesh.userData.shore === true, parts: [] });
    let geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (mesh.material.userData.surface) surfaceUVs(geometry, mesh.material.userData.surface);
    if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
    buckets.get(key).parts.push(geometry);
  });
  const group = new THREE.Group(); group.name = source.name;
  for (const { material: paint, cast, receive, canopy, frond, shore, parts } of buckets.values()) {
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, paint);
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    mesh.userData.canopy = canopy;
    mesh.userData.frond = frond;
    mesh.userData.shore = shore;
    group.add(mesh);
  }
  return group;
}

function roadRibbon(start, end, left, right, paint) {
  const positions = [], indices = [];
  const steps = Math.ceil((end - start) / 2);
  for (let i = 0; i <= steps; i++) {
    const f = sampleTrack(THREE.MathUtils.lerp(start, end, i / steps));
    for (const [x, y] of [left, right]) {
      const p = f.position.clone().addScaledVector(f.right, x).addScaledVector(f.up, y);
      positions.push(p.x, p.y, p.z);
    }
    if (i < steps) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, paint);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.roadInterval = Object.freeze([start, end]);
  return mesh;
}

export function makeRoad({ gaps = [] } = {}) {
  const road = new THREE.Group(); road.name = 'molded-orange-skyway';
  const openings = gaps.filter(gap => Number.isFinite(gap.start) && Number.isFinite(gap.end) && gap.end > gap.start).slice().sort((a, b) => a.start - b.start);
  const paints = {
    top: new THREE.MeshStandardMaterial({ color: 0xf56618, roughness: .66, envMapIntensity: .08, side: THREE.DoubleSide }),
    side: new THREE.MeshStandardMaterial({ color: 0xc53e0c, roughness: .65, envMapIntensity: .08, side: THREE.DoubleSide }),
    rail: new THREE.MeshStandardMaterial({ color: 0xffa62a, roughness: .48, envMapIntensity: .12, side: THREE.DoubleSide }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xffe9ac, roughness: .65, envMapIntensity: .08, side: THREE.DoubleSide }),
  };
  // Short sections keep geometry cullable rather than submitting a whole world.
  for (let d = -30; d < COURSE_LENGTH + 70; d += 90) {
    const sectionEnd = Math.min(d + 90, COURSE_LENGTH + 70), spans = [];
    let cursor = d;
    for (const gap of openings) {
      if (gap.end <= cursor || gap.start >= sectionEnd) continue;
      if (gap.start > cursor) spans.push([cursor, gap.start]);
      cursor = Math.max(cursor, Math.min(sectionEnd, gap.end));
    }
    if (cursor < sectionEnd) spans.push([cursor, sectionEnd]);
    for (const [start, end] of spans) {
      const add = (left, right, paint) => {
        const ribbon = roadRibbon(start, end, left, right, paint);
        ribbon.userData.roadSection = d; road.add(ribbon);
      };
      add([-8.5, 0], [8.5, 0], paints.top);
      add([8.5, -.65], [-8.5, -.65], paints.side);
      for (const side of [-1, 1]) {
        add([side * 8.5, -.65], [side * 8.5, .64], paints.side);
        add([side * 8.5, .64], [side * DRIVE_HALF_WIDTH, .64], paints.rail);
        add([side * DRIVE_HALF_WIDTH, .64], [side * DRIVE_HALF_WIDTH, .06], paints.rail);
        add([side * 7.58, .025], [side * 7.77, .025], paints.stripe);
      }
    }
  }
  return road;
}

function terrainHeight(x, z) {
  const trackX = 13 * Math.sin(z / 135) + 6 * Math.sin(z / 57) + (z > LOOP_START ? 13 : 0);
  const shoulder = THREE.MathUtils.smoothstep(Math.abs(x - trackX), 11, 75);
  const hills = 3 + Math.sin(x / 34 + z / 76) * 3.8 + Math.cos(z / 53 - x / 57) * 2.8;
  return z > 920 ? -3.8 : -1.5 + shoulder * hills;
}
function makeTerrain() {
  const geometry = new THREE.PlaneGeometry(580, 2100, 48, 180);
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, 850);
  const positions = geometry.attributes.position, colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), y = terrainHeight(x, z);
    positions.setY(i, y);
    color.setHex(z > 920 ? 0x3d9f8d : y > 2 ? 0x64a547 : 0x82bc50);
    // Larger dry/moss patches read at driving distance; the fine texture only
    // adds a soft tactile finish when close to the bank.
    const meadow = Math.sin(x / 18 + z / 23) * Math.cos(z / 31 - x / 13);
    color.lerp(new THREE.Color(0xb3bd69), Math.max(0, meadow) * .28);
    color.multiplyScalar(.92 + .10 * Math.sin(x / 31 + z / 40));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const map = createSurfaceTexture('ground'); surfaceUVs(geometry, 'ground');
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map, bumpMap: map, bumpScale: .035 }));
  mesh.name = 'rolling-landscape'; mesh.receiveShadow = true;
  return mesh;
}

function woodlandTree(parent, position, size, distant = false) {
  const g = new THREE.Group(); g.position.copy(position); parent.add(g);
  const lean = (noise(position.z) - .5) * .14;
  piece(g, 'cylinder', 0x8e5834, [0, size * .78, 0], [.2 * size, size * 1.65, .2 * size], [0, 0, lean]);
  if (distant) {
    piece(g, 'farCrown', 0x23966b, [0, size * 1.9, 0], [size * .94, size * 1.05, size * .86], [0, noise(position.x) * 6, .09]);
  } else {
    piece(g, 'cylinder', 0x8e5834, [-size * .24, size * 1.27, 0], [.11 * size, size * .85, .11 * size], [0, 0, .55]);
    piece(g, 'crown', 0x23966b, [-size * .2, size * 1.77, 0], [size * .78, size * .79, size * .81], [0, noise(position.x) * 6, -.18]);
    piece(g, 'crown', 0x4daf76, [size * .28, size * 2.15, .06 * size], [size * .71, size * .89, size * .74], [0, noise(position.z) * 6, .16]);
  }
}
function palm(parent, position, size) {
  const g = new THREE.Group(); g.position.copy(position); parent.add(g);
  const trunk = piece(g, 'palmTrunk', 0xbd8c51, [0, size * 1.5, 0], [size, size, size]);
  trunk.userData.shoreContact = true;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const leaf = new THREE.Group(); leaf.position.set(.4 * size, 2.9 * size, 0); leaf.rotation.y = a; g.add(leaf);
    piece(leaf, 'frond', i % 2 ? 0x269d6b : 0x49bd72, [0, 0, 0], [size, size, size], [0, 0, -.05]);
  }
  for (let i = 0; i < 3; i++) ball(g, 0x815237, [.4 * size + Math.cos(i * 2) * .25 * size, 2.65 * size, Math.sin(i * 2) * .25 * size], [.22 * size, .25 * size, .22 * size]);
  return g;
}
function bear(parent, position, size = 1, wave = false) {
  const g = new THREE.Group(); g.position.copy(position); g.scale.setScalar(size); g.rotation.y = position.x < 0 ? Math.PI / 2 : -Math.PI / 2; parent.add(g);
  ball(g, 0x9e673b, [0, 1.35, 0], [.91, 1.13, .73]);
  ball(g, 0xd4a16b, [0, 1.35, .58], [.62, .79, .2]);
  ball(g, 0xaa7545, [0, 2.64, 0], [.85, .78, .69]);
  for (const side of [-1, 1]) {
    ball(g, 0xaa7545, [side * .6, 3.18, -.04], [.33, .34, .25]);
    ball(g, 0xe3b884, [side * .6, 3.18, .15], [.19, .21, .1]);
    ball(g, 0xfff4d6, [side * .28, 2.78, .6], [.14, .18, .1]);
    ball(g, 0x192e36, [side * .26, 2.76, .69], [.075, .11, .04]);
    const arm = ball(g, 0x9e673b, [side * .95, wave && side > 0 ? 2.29 : 1.42, .04], [.34, .75, .38]);
    arm.rotation.z = wave && side > 0 ? -.62 : side * .16;
    ball(g, 0x754629, [side * .49, .3, .25], [.46, .32, .57]);
  }
  ball(g, 0xe3b884, [0, 2.4, .62], [.43, .3, .2]);
  ball(g, 0x24383b, [0, 2.49, .8], [.17, .12, .07]);
  round(g, 0xffcc42, [0, 2.02, 0], [1.4, .2, 1.1]);
  round(g, 0xf99a31, [.44, 1.82, .58], [.26, .45, .15], [0, 0, -.2]);
}
function gator(parent, position, size = 1) {
  const g = new THREE.Group(); g.position.copy(position); g.scale.setScalar(size); g.rotation.y = position.x > 0 ? -.7 : .7; parent.add(g);
  ball(g, 0x359758, [0, .66, 0], [1.03, .63, 1.85]);
  round(g, 0x72be59, [0, .85, 1.65], [1.6, .6, 2.05]);
  round(g, 0xd4df8d, [0, .53, 1.7], [1.5, .2, 1.96]);
  for (const side of [-1, 1]) {
    ball(g, 0x72be59, [side * .48, 1.24, 1.34], [.35, .36, .34]);
    ball(g, 0xfff8e0, [side * .48, 1.34, 1.59], [.23, .22, .13]);
    ball(g, 0x173b39, [side * .48, 1.36, 1.7], [.09, .13, .06]);
    for (const z of [-.9, .65]) ball(g, 0x359758, [side * 1.05, .22, z], [.43, .25, .56]).userData.shoreContact = true;
    for (const z of [1.25, 1.9, 2.4]) piece(g, 'cone', 0xfff5c6, [side * .68, .65, z], [.11, .2, .11], [Math.PI, 0, 0]);
  }
  piece(g, 'cone', 0x359758, [0, .48, -2.04], [.72, 2, .43], [-Math.PI / 2, 0, 0]);
  for (let z = -1.5; z < .9; z += .45) piece(g, 'cone', 0x9bd060, [0, 1.23, z], [.21, .4, .23]);
  return g;
}

function shoreBank(parent, root, kind, size, distance, side, occupant) {
  const frame = sampleTrack(distance), turn = Math.atan2(frame.forward.x, frame.forward.z);
  const minor = 5 + size;
  const scale = kind === 'palm'
    ? [minor * (.92 + noise(distance + side * 3) * .025), root.y + .04 + 2.05, minor * (.77 + noise(distance * 2 + side) * .055)]
    : [4.2, root.y + .04 + 2.05, 5.8];
  const yaw = kind === 'palm' ? noise(distance * 3 + side) * Math.PI * 2 : turn + (noise(distance + side) - .5) * .24;
  const bank = piece(parent, 'shore', 0xffffff, [root.x, -2.05, root.z], scale, [0, yaw, 0]);
  bank.updateWorldMatrix(true, false); occupant.updateWorldMatrix(true, true);
  // Retain contact samples from actual trunk/foot geometry before chunk batching
  // removes the original authoring meshes. Tests raycast the real merged banks.
  const contacts = [], point = new THREE.Vector3();
  occupant.traverse(mesh => {
    if (!mesh.userData.shoreContact) return;
    const positions = mesh.geometry.attributes.position;
    let lowest = Infinity;
    for (let i = 0; i < positions.count; i++) lowest = Math.min(lowest, positions.getY(i));
    const seen = new Set();
    for (let i = 0; i < positions.count; i++) {
      if (positions.getY(i) > lowest + .00001) continue;
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const key = point.toArray().map(value => value.toFixed(6)).join(',');
      if (!seen.has(key)) { seen.add(key); contacts.push(Object.freeze(point.toArray())); }
    }
  });
  return Object.freeze({ kind, distance, center: Object.freeze(root.toArray()),
    oldRadius: Object.freeze(kind === 'palm' ? [6 + size, 5 + size] : [7.4, 6]),
    matrix: Object.freeze(bank.matrixWorld.toArray()), contacts: Object.freeze(contacts) });
}

function gate(parent, d, accent, label, finish = false) {
  const f = sampleTrack(d), g = new THREE.Group(); g.position.copy(f.position); g.quaternion.copy(f.quaternion);
  const posts = new THREE.Group(), overhead = new THREE.Group(), markings = new THREE.Group();
  posts.name = `${label}-gate-posts`; overhead.name = `${label}-gate-overhead`;
  g.add(posts, overhead, markings);
  // Move the complete assembly together, including its lowest checker tiles.
  // Rocket flight also carries a previous jump's height. The complete opening
  // clears that arc and the pitched robot, including its forward overhang.
  overhead.position.y = 16.9;
  for (const side of [-1, 1]) {
    round(posts, 0x194b62, [side * 10, 14.25, 0], [1.15, 28.5, 1.2]);
    round(posts, accent, [side * 10, 12.5, .72], [1.23, 22.6, .26]);
    round(posts, 0xffedb8, [side * 10, 25.7, .72], [1.25, .5, .3]);
    round(posts, 0x13394e, [side * 10, .2, 0], [2.2, .45, 2.2]);
  }
  round(overhead, 0x163d54, [0, 11.2, 0], [21.1, 2.6, 1.25]);
  round(overhead, accent, [0, 12.42, 0], [20, .22, 1.4]);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const context = canvas.getContext('2d'); context.fillStyle = '#fff6d6';
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '900 78px "Trebuchet MS", sans-serif';
    context.fillText({ start: 'MONSTER SKYWAY', 'sky-loop': 'SKY LOOP', 'gator-bay': 'GATOR BAY', finish: 'FINISH!' }[label], 512, 68, 940);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const signGeometry = new THREE.PlaneGeometry(14.5, 1.8);
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
    for (const side of [-1, 1]) {
      const sign = new THREE.Mesh(signGeometry, signMaterial);
      sign.position.set(0, 11.67, side * .69); sign.rotation.y = side < 0 ? Math.PI : 0; overhead.add(sign);
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 20; i++) for (let row = 0; row < 2; row++) {
      box(overhead, (i + row) % 2 ? 0xffedb8 : 0x19465a, [-9.5 + i, 10.42 + row * .45, side * .652], [1, .45, .045], undefined, false);
    }
    // Original star emblems identify checkpoints even before a child can read.
    for (const edge of [-1, 1]) {
      const emblem = piece(overhead, 'cone', 0xffd451, [edge * 8.1, 11.77, side * .71], [.35, .7, .09], [0, 0, Math.PI]);
      emblem.name = label;
    }
  }
  if (finish) for (let i = 0; i < 16; i++) for (let row = 0; row < 3; row++) {
    box(markings, (i + row) % 2 ? 0x203b49 : 0xffefcb, [-7.5 + i, .032, -1 + row], [1, .035, 1], undefined, false);
  }
  g.updateMatrixWorld(true);
  const result = new THREE.Group(); result.name = `${label}-gate`; result.userData.distance = d;
  result.add(batch(posts), batch(overhead), batch(markings)); parent.add(result);
}

export function makeLoopSupport() {
  const support = new THREE.Group(); support.name = 'loop-support';
  // Sample both overlapping approaches and the whole loop, including outer lanes,
  // road lips and the conservative fully transformed vehicle envelope.
  const swept = new THREE.Box3();
  for (let d = LOOP_START - 40; d <= LOOP_END + 40; d += .5) {
    const f = sampleTrack(d);
    for (const [width, low, high, length] of [[8.5, -.65, .64, 0], [7.9, -.2, 10.2, 7.2]]) {
      for (const x of [-width, width]) for (const y of [low, high]) for (const z of [-length, length]) {
        swept.expandByPoint(f.position.clone().addScaledVector(f.right, x).addScaledVector(f.up, y).addScaledVector(f.forward, z));
      }
    }
  }
  const leftInner = Math.min(-11, swept.min.x - 1.35) - 1;
  const beamBottom = Math.max(60.5, swept.max.y + 1.35);
  const z = trackCenter(LOOP_START).z;
  const x = leftInner - 3.5;
  const towerZ = [z - 38, z + 38];
  for (let side = 0; side < 2; side++) {
    const tower = new THREE.Group(); tower.name = `loop-support-rear-${side ? 'exit' : 'entry'}`;
    const z = towerZ[side], bottom = -1.5, top = beamBottom + 2.8;
    for (const offset of [-1.9, 1.9]) round(tower, 0x237788, [x + offset, (top + bottom) / 2, z], [.9, top - bottom, 2]);
    for (let y = 3; y < beamBottom - 8; y += 9) {
      round(tower, 0x37b7b8, [x, y, z], [4.8, .8, 2.2]);
      const brace = box(tower, 0x2b8c98, [x, y + 4.1, z], [.5, 9, 1.1]); brace.rotation.z = (Math.floor(y / 9) % 2 ? -1 : 1) * .42;
    }
    round(tower, 0xdcd5b1, [x, -.8, z], [7, 1.1, 6]);
    round(tower, 0x37b7b8, [x, top, z], [5.3, 1, 3.6]);
    support.add(batch(tower));
  }
  // A rear gantry leaves the positive-X camera side completely open. Its two
  // towers sit beyond the ring in Z and carry a longitudinal spine. Crown arms
  // cantilever from that spine to the existing exterior gold attachments.
  const overhead = new THREE.Group(); overhead.name = 'loop-support-overhead';
  const spine = new THREE.Group(); spine.name = 'loop-support-spine';
  round(spine, 0x237788, [x, beamBottom + 1.4, z], [3.2, 2.8, towerZ[1] - towerZ[0] + 5.3]);
  round(spine, 0x37b7b8, [x, beamBottom + 2.7, z], [3.5, .35, towerZ[1] - towerZ[0] + 5.8]);
  const pennants = new THREE.Group(); pennants.name = 'loop-support-pennants';
  // Face the festival row toward the side-on view, suspended above the rear spine.
  const flagX = x + 1.7, stringY = beamBottom + 4.95;
  for (const endZ of towerZ) round(pennants, 0x237788, [flagX, beamBottom + 3.85, endZ], [.18, 2.2, .18]);
  box(pennants, 0xffedb8, [flagX, stringY, z], [.065, .065, towerZ[1] - towerZ[0]], undefined, false);
  for (let i = 0; i < 13; i++) {
    piece(pennants, 'cone', [0xffb72e, 0x1b98ba, 0xf36e3a][i % 3], [flagX, stringY - .95, z - 31.2 + i * 5.2], [1.05, 1.9, .06], [0, Math.PI / 2, Math.PI], false);
  }
  overhead.add(batch(spine), batch(pennants));
  // At the inverted crown, the road underside faces upward. These short exterior
  // connections meet that underside without entering the vehicle side of the road.
  const connections = new THREE.Group(); connections.name = 'loop-support-connections';
  const crown = sampleTrack((LOOP_START + LOOP_END) / 2);
  const arms = new THREE.Group(); arms.name = 'loop-support-arms';
  for (const side of [-1, 1]) {
    const p = crown.position.clone().addScaledVector(crown.right, side * 6).addScaledVector(crown.up, -.65);
    round(connections, 0xffbc47, [p.x, (p.y + beamBottom + .2) / 2, p.z], [1.1, beamBottom + .2 - p.y, 1.1]);
    const armZ = p.z - side * .65;
    round(arms, 0x237788, [(x + p.x) / 2, beamBottom + 1.4, armZ], [p.x - x + 1.1, 2.8, 1.1]);
    round(arms, 0x37b7b8, [(x + p.x) / 2, beamBottom + 2.7, armZ], [p.x - x + 1.3, .35, 1.2]);
  }
  overhead.add(batch(arms));
  support.add(overhead, batch(connections));
  return support;
}

export function createWorld() {
  const world = new THREE.Group(); world.name = 'monster-skyway-world';
  world.userData.shoreBanks = [];
  world.add(makeTerrain(), makeRoad());
  const waterMap = createSurfaceTexture('water');
  const waterPaint = new THREE.MeshStandardMaterial({ color: 0x32b8bd, roughness: .38, envMapIntensity: .11, map: waterMap, bumpMap: waterMap, bumpScale: .045 });
  const waterGeometry = new THREE.PlaneGeometry(550, 1100);
  waterGeometry.rotateX(-Math.PI / 2); waterGeometry.translate(0, -1.7, 1450); surfaceUVs(waterGeometry, 'water');
  const water = new THREE.Mesh(waterGeometry, waterPaint);
  water.receiveShadow = true; water.name = 'gator-lagoon'; world.add(water);

  for (let start = -48; start < COURSE_LENGTH + 90; start += 144) {
    const chunk = new THREE.Group(); chunk.name = `scenery-chunk-${start}`;
    for (let d = start; d < Math.min(start + 144, COURSE_LENGTH + 90); d += 24) {
      const f = sampleTrack(d);
      const loop = d > LOOP_START - 12 && d < LOOP_END + 15;
      const bay = d > 1110;
      if (!loop) {
        // Supports visually connect elevated track to land or lagoon.
        for (const side of [-1, 1]) {
          const p = f.position.clone().addScaledVector(f.right, side * 6.2);
          const bottom = bay ? -3 : terrainHeight(p.x, p.z);
          const height = Math.max(.5, p.y - bottom - .4);
          round(chunk, bay ? 0x927055 : 0x2b7e86, [p.x, bottom + height / 2, p.z], [.55, height, .85]);
        }
        const seam = box(chunk, 0xe14e12, [f.position.x, f.position.y + .012, f.position.z], [14.4, .015, .065], undefined, false); seam.quaternion.copy(f.quaternion);
        for (const side of [-1, 1]) {
          const size = 2.4 + noise(d * 2 + side) * 1.8;
          const baseOffset = 17 + noise(d + side) * 13;
          const offset = side * (bay ? Math.max(baseOffset, 12.5 + 2.5 * size) : baseOffset);
          if (isAdventureClearing(d, offset)) continue;
          const p = f.position.clone().addScaledVector(f.right, offset); p.y = bay ? -1.2 : terrainHeight(p.x, p.z);
          if (bay) {
            const tree = palm(chunk, p, size);
            world.userData.shoreBanks.push(shoreBank(chunk, p, 'palm', size, d, side, tree));
            for (let i = 0; i < 3; i++) piece(chunk, 'rock', 0x5bb675, [p.x + 2.2 + i * .6, -.8, p.z + 1.3], [.3, 1.2 + i * .2, .22], [0, 0, -.1 - i * .12]);
          } else {
            const clearOfLoop = d < LOOP_START - 40 || d > LOOP_END + 40;
            if (clearOfLoop) woodlandTree(chunk, p, size);
            const flowers = f.position.clone().addScaledVector(f.right, side * (11.8 + noise(d + 3) * 2));
            flowers.y = terrainHeight(flowers.x, flowers.z);
            for (let i = 0; i < 4; i++) {
              const x = flowers.x + i * .33, z = flowers.z + Math.sin(i * 2) * .6;
              piece(chunk, 'cylinder', 0x42874b, [x, flowers.y + .22, z], [.035, .5, .035], undefined, false);
              piece(chunk, 'rock', i % 2 ? 0xffd559 : 0xfff2ae, [x, flowers.y + .5, z], [.2, .1, .2], undefined, false);
            }
            if (d % 48 === 0) {
              piece(chunk, 'rock', 0x78978b, [p.x + side * 3, p.y + .65, p.z + 3], [2, 1.3, 1.6], [0, noise(d) * 3, .15]);
              for (let i = 0; i < 3; i++) ball(chunk, [0x448a51, 0x569d53, 0x71ad52][i], [p.x - side * (2 + i), p.y + .55, p.z + i], [1.3, .9, 1.4]);
            }
            const far = p.clone().addScaledVector(f.right, side * 35); far.y = terrainHeight(far.x, far.z);
            if (clearOfLoop) woodlandTree(chunk, far, size * 1.5, true);
          }
        }
        if ((d + 48) % 96 === 0) {
          const side = Math.floor(d / 96) % 2 ? -1 : 1;
          if (!isAdventureClearing(d, side * 15)) {
            const p = f.position.clone().addScaledVector(f.right, side * 15);
            p.y = bay ? -.75 : terrainHeight(p.x, p.z);
            if (bay) {
              const mascot = gator(chunk, p, 2.1);
              world.userData.shoreBanks.push(shoreBank(chunk, p, 'gator', 1, d, side, mascot));
            }
            else bear(chunk, p, 2.1, true);
          }
        }
      }
    }
    world.add(batch(chunk));
  }

  const landmarks = new THREE.Group();
  gate(world, 0, 0x29b9c3, 'start');
  gate(world, 565, 0xffc546, 'sky-loop');
  gate(world, 1160, 0x51c99a, 'gator-bay');
  gate(world, COURSE_LENGTH, 0xffca42, 'finish', true);
  for (const d of RAMPS) {
    for (let before = 8; before <= 20; before += 6) {
      const f = sampleTrack(d - before);
      for (const side of [-1, 1]) {
        const stripe = box(landmarks, 0xffe8a9, [0, 0, 0], [.24, .045, 1.4], undefined, false);
        stripe.position.copy(f.position).addScaledVector(f.right, side * .46).addScaledVector(f.up, .04);
        stripe.quaternion.copy(f.quaternion); stripe.rotateY(side * -.7);
      }
    }
    const f = sampleTrack(d - 5);
    for (const side of [-1, 1]) {
      const p = f.position.clone().addScaledVector(f.right, side * 9.3);
      round(landmarks, 0x194c60, [p.x, p.y + 1.7, p.z], [.28, 3.4, .28]);
      const flag = piece(landmarks, 'cone', 0xffcf43, [p.x, p.y + 3.5, p.z], [.65, 1.3, .09], [0, 0, -.5]);
      flag.quaternion.premultiply(f.quaternion);
    }
  }
  world.add(makeLoopSupport());
  const friends = sampleTrack(16), startingFriends = new THREE.Group(); startingFriends.name = 'starting-friends';
  for (const side of [-1, 1]) {
    const p = friends.position.clone().addScaledVector(friends.right, side * 17); p.y = -1.2;
    if (side < 0) bear(startingFriends, p, 3, true); else gator(startingFriends, p, 2.8);
  }
  world.add(batch(startingFriends));
  // Large silhouettes at the edge of the horizon supply depth without clutter.
  for (let start = 0; start < 19; start += 3) {
    const hills = new THREE.Group(); hills.name = `distant-hills-${start}`;
    for (let i = start; i < Math.min(start + 3, 19); i++) for (const side of [-1, 1]) {
      const z = i * 102 - 50, x = side * (125 + noise(i + side) * 45);
      piece(hills, 'hill', [0x519884, 0x68a59a, 0x7db2a5][i % 3], [x, 5, z], [32 + noise(i) * 20, 20 + noise(i + 1) * 28, 38], [0, noise(i) * 3, 0], false);
    }
    world.add(batch(hills));
  }
  world.add(batch(landmarks));

  // Clouds and horizon hills used to share course-wide batches. Spatial groups
  // fund nearby organic detail by culling distant geometry behind the camera.
  for (let start = 0; start < 28; start += 4) {
    const clouds = new THREE.Group(); clouds.name = `soft-clouds-${start}`;
    for (let i = start; i < start + 4; i++) {
      const x = Math.sin(i * 8.3) * 120, z = i * 72 - 50, y = 70 + noise(i) * 16;
      for (let j = 0; j < 4; j++) piece(clouds, 'ball', 0xffffff, [x + j * 4.7, y + Math.sin(j * 1.5) * 2, z], [6.4, 3 + noise(j + i), 4.8], undefined, false);
    }
    world.add(batch(clouds));
  }
  Object.freeze(world.userData.shoreBanks);
  return world;
}
