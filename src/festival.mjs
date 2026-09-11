import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COURSE_LENGTH } from './core.mjs';
import { sampleTrack } from './track.mjs';

const C = { ink: 0x194b62, cream: 0xffefce, gold: 0xffc645, coral: 0xf47c54,
  teal: 0x36bfc2, blue: 0x559cdc, pink: 0xef88ad, wood: 0xad7954, green: 0x5dbb82 };

// Each small venue is a separate culling unit. Its materials are shared only
// inside this returned group, so a normal scene traversal can dispose it safely.
export function createRaceFestival() {
  const festival = new THREE.Group(); festival.name = 'race-festival';
  const paints = Object.fromEntries(Object.entries(C).map(([key, color]) => [key,
    new THREE.MeshStandardMaterial({ color, roughness: key === 'gold' ? .4 : .76 })]));
  const shapes = {
    box: new THREE.BoxGeometry(1, 1, 1),
    ball: new THREE.SphereGeometry(1, 10, 6),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 12),
    ring: new THREE.TorusGeometry(1, .15, 6, 16),
  };
  const rotation = new THREE.Quaternion(), euler = new THREE.Euler();
  const local = new THREE.Matrix4(), transform = new THREE.Matrix4();
  const position = new THREE.Vector3(), scale = new THREE.Vector3();

  function venue(name, distance, build) {
    const frame = sampleTrack(distance);
    // Buildings remain upright even on a banked road. Foundations reach down
    // through the existing terrain/water while their decks follow road height.
    const base = new THREE.Matrix4().makeRotationY(Math.atan2(frame.forward.x, frame.forward.z));
    base.setPosition(frame.position.x, frame.position.y - 1, frame.position.z);
    const buckets = new Map();
    const group = new THREE.Group(); group.name = name; group.userData.distance = distance;
    function part(kind, paint, p, s, r = [0, 0, 0], shadow = true) {
      const key = `${paint}:${shadow}`;
      if (!buckets.has(key)) buckets.set(key, { paint, shadow, parts: [] });
      rotation.setFromEuler(euler.set(...r));
      local.compose(position.set(...p), rotation, scale.set(...s));
      transform.multiplyMatrices(base, local);
      let geometry = shapes[kind].clone().applyMatrix4(transform);
      if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
      buckets.get(key).parts.push(geometry);
    }
    try {
      build(part);
      for (const { paint, shadow, parts } of buckets.values()) {
        const geometry = mergeGeometries(parts);
        if (!geometry) throw new Error(`Could not batch festival venue ${name}`);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, paints[paint]);
        mesh.name = `${name}-${paint}${shadow ? '' : '-trim'}`;
        mesh.castShadow = shadow; mesh.receiveShadow = shadow; group.add(mesh);
      }
      festival.add(group);
    } finally {
      for (const { parts } of buckets.values()) parts.forEach(geometry => geometry.dispose());
    }
  }

  function deck(p, x, width, length, paint = 'wood') {
    p('box', paint, [x, 0, 0], [width, .65, length]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      p('cylinder', 'ink', [x + sx * (width / 2 - .8), -4, sz * (length / 2 - .8)], [.45, 8, .45]);
  }
  function flag(p, x, z, paint, height = 9) {
    p('cylinder', 'cream', [x, height / 2, z], [.12, height, .12]);
    p('ball', 'gold', [x, height + .2, z], [.26, .26, .26]);
    // A real triangular pennant with a thick enough edge to read from both sides.
    p('cone', paint, [x, height - 1, z + 1.4], [1, 2.8, .1], [Math.PI / 2, 0, 0]);
  }
  function checks(p, x, y, z, across = 8, plane = 'z') {
    for (let col = 0; col < across; col++) for (let row = 0; row < 2; row++) {
      const s = .55, a = (col - (across - 1) / 2) * s;
      p('box', (col + row) % 2 ? 'ink' : 'cream',
        [x + (plane === 'z' ? a : 0), y + row * s, z + (plane === 'x' ? a : 0)],
        plane === 'z' ? [s, s, .07] : [.07, s, s], [0, 0, 0], false);
    }
  }
  function bunting(p, x, z, length, paint = 'coral', y = 10) {
    for (const end of [-1, 1]) p('cylinder', 'cream', [x, y / 2, z + end * length / 2], [.11, y, .11]);
    p('box', 'cream', [x, y, z], [.06, .06, length]);
    for (let i = 0; i < 7; i++) p('cone', i % 2 ? 'gold' : paint,
      [x, y - .65, z + (i - 3) * length / 8], [.65, 1.3, .055], [0, Math.PI / 2, Math.PI], false);
  }
  function stand(p, x, accent) {
    const side = Math.sign(x);
    deck(p, x, 10, 19, 'ink');
    for (let row = 0; row < 3; row++) {
      const seatX = x + side * (row - 1) * 2.4, y = 1 + row * 1.3;
      p('box', row % 2 ? 'cream' : accent, [seatX, y, 0], [2.4, .55, 17]);
      for (let i = 0; i < 5; i++) {
        const z = (i - 2) * 3.1;
        p('cylinder', ['teal', 'coral', 'gold', 'pink', 'blue'][(row + i) % 5], [seatX, y + .7, z], [.45, 1, .42]);
        p('ball', 'cream', [seatX, y + 1.55, z], [.56, .58, .5]);
        for (const ear of [-1, 1]) p('ball', 'wood', [seatX, y + 1.98, z + ear * .38], [.22, .23, .2]);
        // Eyes face inward toward the race, with little waving arms.
        for (const eye of [-1, 1]) p('ball', 'ink', [seatX - side * .5, y + 1.6, z + eye * .2], [.06, .085, .075]);
        p('box', 'cream', [seatX, y + 1.15, z + .7], [.22, 1.15, .22], [-.45, 0, 0]);
      }
    }
    for (const z of [-9, 9]) {
      p('cylinder', 'ink', [x + side * 4.4, 4.2, z], [.22, 8.4, .22]);
      p('box', 'cream', [x, 8.35, z], [10, .22, .22]);
    }
    p('box', accent, [x, 8.6, 0], [11, .5, 20]);
    for (let i = -4; i <= 4; i++) p('box', 'cream', [x, 8.88, i * 2.2], [11, .04, .85], [0, 0, 0], false);
    checks(p, x - side * 5.06, .8, 0, 24, 'x');
    bunting(p, x - side * 4.8, 0, 19, accent, 10.8);
  }
  function hut(p, x, accent, beach = false) {
    deck(p, x, 13, 17);
    p('box', 'cream', [x, 2.3, 1], [8, 4.3, 9]);
    p('box', accent, [x, 1, -3.55], [8.1, 1.8, .16]);
    p('box', 'ink', [x, 3, -3.65], [5.7, 1.5, .12]);
    p('box', 'gold', [x, 2, -4], [8.7, .3, 1.3]);
    for (const side of [-1, 1]) p('box', accent, [x + side * 2.3, 5, 1], [5.3, .4, 11], [0, 0, side * .3]);
    p('box', 'cream', [x, 5.85, 1], [.3, .3, 11.3]);
    // Wide striped canopy presents a colorful pit / beach kiosk to the driver.
    for (let i = -3; i <= 3; i++) p('box', i % 2 ? 'cream' : accent, [x + i * 1.3, 4.3, -5.8], [1.3, .25, 4]);
    for (const side of [-1, 1]) p('cylinder', 'ink', [x + side * 4.3, 2.1, -7.3], [.12, 4.2, .12]);
    if (beach) {
      for (let i = 0; i < 3; i++) p('ball', ['coral', 'gold', 'teal'][i], [x + 5, 2.5, -2 + i * 2], [.4, 2.3, .72], [0, 0, -.2]);
    } else {
      for (let i = 0; i < 3; i++) {
        p('cylinder', 'ink', [x + 5, .55 + i * .85, 2], [1.1, .8, 1.1]);
        p('cylinder', 'cream', [x + 5, .98 + i * .85, 2], [.48, .025, .48]);
      }
      checks(p, x, 6.6, -1, 8);
    }
    flag(p, x - 5, 6, accent, 10);
  }
  function balloon(p, x, z, accent, y = 25) {
    p('box', 'wood', [x, y - 7, z], [2, 1.5, 2]);
    for (const side of [-1, 1]) p('box', 'cream', [x + side * .8, y - 5.2, z], [.065, 3.5, .065]);
    p('ball', accent, [x, y, z], [4.5, 5.8, 4.5]);
    p('ring', 'cream', [x, y - .7, z], [4.5, 4.5, 4.5], [Math.PI / 2, 0, 0]);
    p('cone', accent, [x, y - 4.8, z], [1.65, 2.4, 1.65], [0, 0, Math.PI]);
    p('box', 'cream', [x, (y - 7) / 2, z], [.065, y - 7, .065]);
    p('cylinder', 'gold', [x, .2, z], [1.2, .4, 1.2]);
  }
  function trophy(p, x, y, z, s = 1) {
    p('box', 'ink', [x, y + .6 * s, z], [5 * s, 1.2 * s, 4 * s]);
    p('box', 'gold', [x, y + 1.3 * s, z], [3.6 * s, .35 * s, 3 * s]);
    p('cylinder', 'gold', [x, y + 2.5 * s, z], [.45 * s, 2.4 * s, .45 * s]);
    p('ball', 'gold', [x, y + 4.5 * s, z], [1.85 * s, 1.6 * s, 1.45 * s]);
    p('cylinder', 'gold', [x, y + 5.3 * s, z], [1.85 * s, .7 * s, 1.45 * s]);
    p('cylinder', 'wood', [x, y + 5.67 * s, z], [1.5 * s, .025 * s, 1.15 * s]);
    for (const side of [-1, 1]) p('ring', 'gold', [x + side * 1.8 * s, y + 4.45 * s, z], [1.05 * s, 1.15 * s, .8 * s]);
    p('box', 'cream', [x, y + .63 * s, z - 2.02 * s], [.26 * s, .75 * s, .05 * s], [0, 0, 0], false);
  }

  try {
    venue('starting-paddock', 40, p => { hut(p, -26, 'teal'); bunting(p, -18, 0, 24); });
    venue('starting-grandstand', 72, p => { stand(p, 27, 'coral'); flag(p, 21, -13, 'gold'); });
    venue('woodland-picnic-stop', 260, p => {
      hut(p, -29, 'coral');
      for (const z of [-15, 15]) {
        p('box', 'wood', [-23, 1.1, z], [5, .4, 3]);
        for (const side of [-1, 1]) { p('box', 'cream', [-23, .6, z + side * 2], [6, .3, .8]); p('box', 'ink', [-23 + side * 1.5, .45, z], [.25, 1, 3]); }
        p('cylinder', 'cream', [-23, 3.5, z], [.1, 7, .1]);
        p('cone', 'gold', [-23, 6, z], [4.2, 1.8, 4.2]);
      }
    });
    venue('woodland-windmill', 435, p => {
      deck(p, 31, 14, 14);
      p('cylinder', 'cream', [31, 5, 0], [3.5, 10, 3.5]);
      p('cone', 'coral', [31, 12, 0], [5, 4, 5]);
      p('box', 'ink', [31, 2, -3.5], [2, 3, .12]);
      p('ball', 'gold', [31, 9, -4], [.7, .7, .7]);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        p('box', 'ink', [31 + Math.sin(a) * 3, 9 + Math.cos(a) * 3, -4], [.3, 6.8, .3], [0, 0, -a]);
        p('box', 'gold', [31 + Math.sin(a) * 4.7, 9 + Math.cos(a) * 4.7, -4.2], [1.5, 3.2, .15], [0, 0, -a]);
      }
    });
    venue('sky-observatory', 615, p => {
      deck(p, -31, 15, 17, 'cream');
      p('cylinder', 'blue', [-31, 4, 0], [5.1, 8, 5.1]);
      p('ball', 'cream', [-31, 8, 0], [5.3, 4.3, 5.3]);
      p('box', 'ink', [-31, 3, -5.12], [2.5, 4, .2]);
      p('cylinder', 'ink', [-31, 11, -3], [1, 6, 1], [Math.PI / 3, 0, 0]);
      p('cylinder', 'gold', [-31, 12.5, -5.6], [1.3, .5, 1.3], [Math.PI / 3, 0, 0]);
      for (const z of [-7, 7]) flag(p, -24, z, 'blue', 12);
    });
    venue('sky-balloon-meadow', 726, p => { balloon(p, -31, -9, 'coral', 28); balloon(p, -47, 15, 'teal', 38); });
    // No placements in 800..1040: both overlapping loop approaches and the
    // positive-X overview camera have a completely clear festival corridor.
    venue('bay-lighthouse', 1260, p => {
      deck(p, -31, 16, 17, 'cream');
      for (let i = 0; i < 5; i++) p('cylinder', i % 2 ? 'coral' : 'cream', [-31, 1.4 + i * 2.8, 0], [3.2 - i * .17, 2.8, 3.2 - i * .17]);
      p('cylinder', 'ink', [-31, 14.2, 0], [4, .5, 4]);
      p('cylinder', 'gold', [-31, 15.6, 0], [2.2, 2.5, 2.2]);
      for (let i = 0; i < 6; i++) p('cylinder', 'ink', [-31 + Math.sin(i * Math.PI / 3) * 2.6, 15.5, Math.cos(i * Math.PI / 3) * 2.6], [.13, 2.8, .13]);
      p('cone', 'coral', [-31, 18, 0], [4, 2.4, 4]);
      p('ball', 'gold', [-31, 19.4, 0], [.5, .5, .5]);
      p('box', 'teal', [-31, 2, -3.22], [2, 3.2, .15]);
      bunting(p, -23.5, 0, 15, 'teal', 8);
    });
    venue('bay-surf-shack', 1475, p => { hut(p, 28, 'teal', true); flag(p, 21, -11, 'coral'); });
    venue('bay-sailboats', 1600, p => {
      for (let i = 0; i < 2; i++) {
        const x = -31 - i * 15, z = i * 19 - 8;
        p('ball', i ? 'coral' : 'teal', [x, -2, z], [3.2, 1.2, 7]);
        p('box', 'cream', [x, -1, z], [4.8, .25, 9]);
        p('cylinder', 'wood', [x, 4.4, z], [.13, 11, .13]);
        p('cone', i ? 'gold' : 'cream', [x, 5.1, z + 2], [3.5, 8, .11], [0, Math.PI / 2, 0]);
        flag(p, x, z, 'coral', 11);
      }
    });
    venue('finish-grandstand-left', COURSE_LENGTH - 48, p => stand(p, -28, 'blue'));
    venue('finish-grandstand-right', COURSE_LENGTH - 23, p => stand(p, 28, 'coral'));
    venue('winners-trophy-garden', COURSE_LENGTH + 6, p => {
      deck(p, -27, 17, 19, 'cream');
      p('cylinder', 'teal', [-27, 1, 0], [6.5, 2, 6.5]);
      trophy(p, -27, 2, 0, 2);
      for (const z of [-9, 9]) flag(p, -19.5, z, 'gold', 14);
      balloon(p, -44, 3, 'pink', 28);
    });
    venue('victory-podium', COURSE_LENGTH + 35, p => {
      deck(p, 28, 18, 15, 'cream');
      for (let i = -1; i <= 1; i++) {
        const height = i === 0 ? 3.5 : i < 0 ? 2.3 : 1.5;
        p('box', i === 0 ? 'gold' : 'teal', [28 + i * 5, height / 2, 0], [4.7, height, 5]);
        checks(p, 28 + i * 5, .6, -2.54, 6);
      }
      trophy(p, 28, 3.5, 0, .8);
      bunting(p, 20, 0, 15, 'coral', 11);
      balloon(p, 44, 4, 'teal', 30);
    });
  } finally { Object.values(shapes).forEach(geometry => geometry.dispose()); }
  return festival;
}
