import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { sampleTrack } from './track.mjs';
import { createSurfaceTexture, surfaceUVs } from './surfaces.mjs';

// These deliberate clearings make the large landmarks readable from the moving
// chase camera. The opposite sky/bay banks and the entire loop stay untouched.
export function isAdventureClearing(distance, lateral) {
  return (distance >= 290 && distance <= 392 && Math.abs(lateral) >= 11 && Math.abs(lateral) <= 51)
    || (distance >= 615 && distance <= 702 && lateral >= -54 && lateral <= -11)
    || (distance >= 1330 && distance <= 1440 && lateral >= -59 && lateral <= -11);
}

const COLORS = {
  wood: 0xad7248, lightwood: 0xddad70, darkwood: 0x6c4938, ink: 0x164859,
  cream: 0xffefc9, coral: 0xf77a50, gold: 0xffcf45, teal: 0x26b7ae,
  water: 0x55cdd5, foam: 0xdaf9ed, rock: 0x698e82, green: 0x40966e,
};

function wornStone() {
  const source = new THREE.SphereGeometry(1, 14, 8), positions = source.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const width = 1 + .075 * Math.sin(y * 6 + x * 4) * Math.cos(z * 5);
    positions.setXYZ(i, x * width, y * (.96 + .04 * Math.cos(x * 4 - z * 5)), z * width);
  }
  source.deleteAttribute('uv'); source.deleteAttribute('normal');
  const geometry = mergeVertices(source); source.dispose(); geometry.computeVertexNormals(); return geometry;
}

/** Three original destinations, with independently owned, static GPU resources. */
export function createAdventureScenery() {
  const root = new THREE.Group(); root.name = 'adventure-scenery';
  const paints = Object.fromEntries(Object.entries(COLORS).map(([name, color]) => [name,
    new THREE.MeshStandardMaterial({ color, roughness: name === 'water' ? .24 : ['teal', 'gold'].includes(name) ? .4 : .84,
      metalness: name === 'gold' ? .24 : 0, vertexColors: name === 'water' || name === 'foam',
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })]));
  // Textures are owned by this factory instance, shared only within its venues.
  // Existing callers dispose the maps alongside each unique owned material.
  for (const [name, paint] of Object.entries(paints)) {
    const surface = name.includes('wood') ? 'wood' : name === 'rock' ? 'stone' : name === 'water' ? 'water' : '';
    if (!surface) continue;
    paint.map = createSurfaceTexture(surface); paint.bumpMap = paint.map;
    paint.bumpScale = surface === 'stone' ? .13 : surface === 'wood' ? .05 : .07;
    paint.userData.surface = surface;
    if (surface !== 'water') paint.roughness = .94;
  }
  const shapes = {
    box: new THREE.BoxGeometry(1, 1, 1), ball: new THREE.SphereGeometry(1, 10, 6),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 12),
    hull: new THREE.CylinderGeometry(1, 1, 1, 24), nose: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    rounded: new RoundedBoxGeometry(1, 1, 1, 1, .075),
    rock: wornStone(), ring: new THREE.TorusGeometry(1, .1, 8, 32),
  };
  const matrix = new THREE.Matrix4(), world = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const euler = new THREE.Euler(), position = new THREE.Vector3(), scale = new THREE.Vector3();

  function venue(name, distance, build) {
    const frame = sampleTrack(distance), buckets = new Map();
    const base = new THREE.Matrix4().makeRotationY(Math.atan2(frame.forward.x, frame.forward.z));
    base.setPosition(frame.position);
    const group = new THREE.Group(); group.name = name;
    function addGeometry(geometry, paint, shadow = true, roadSurface = false) {
      const key = `${paint}:${shadow}:${roadSurface}`;
      if (!buckets.has(key)) buckets.set(key, { paint, shadow, roadSurface, geometries: [] });
      if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
      // Shapes and sampled surfaces share the same attributes before merging.
      if (paints[paint].userData.surface) surfaceUVs(geometry, paints[paint].userData.surface);
      else geometry.deleteAttribute('uv');
      if (paints[paint].vertexColors && !geometry.hasAttribute('color')) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
      }
      buckets.get(key).geometries.push(geometry);
    }
    function part(kind, paint, p, s, r = [0, 0, 0], shadow = true, transform = base) {
      rotation.setFromEuler(euler.set(...r));
      matrix.compose(position.set(...p), rotation, scale.set(...s)); world.multiplyMatrices(transform, matrix);
      const geometry = shapes[kind].clone().applyMatrix4(world);
      if (paint === 'rock') {
        const positions = geometry.attributes.position, colors = [];
        for (let i = 0; i < positions.count; i++) {
          const localY = (positions.getY(i) - world.elements[13]) / s[1];
          const shade = .77 + .23 * THREE.MathUtils.clamp(localY + .5, 0, 1);
          colors.push(shade, shade, shade);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); paints.rock.vertexColors = true;
      }
      addGeometry(geometry, paint, shadow);
    }
    function atTrack(station, kind, paint, p, s, r = [0, 0, 0]) {
      const f = sampleTrack(station), transform = new THREE.Matrix4().compose(f.position, f.quaternion, new THREE.Vector3(1, 1, 1));
      part(kind, paint, p, s, r, true, transform);
    }
    function surface(start, end, left, right, paint, lift = .07) {
      const vertices = [], indices = [], steps = Math.ceil((end - start) * 2);
      for (let i = 0; i <= steps; i++) {
        const f = sampleTrack(THREE.MathUtils.lerp(start, end, i / steps));
        for (const lateral of [left, right]) {
          const point = f.position.clone().addScaledVector(f.right, lateral).addScaledVector(f.up, lift);
          vertices.push(point.x, point.y, point.z);
        }
        if (i < steps) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals(); addGeometry(geometry, paint, false, true);
    }
    function curtain(x, width, lower, upper, paint, front = 0) {
      const positions = [], colors = [], indices = [], rows = 18, columns = 4;
      for (let row = 0; row <= rows; row++) {
        const v = row / rows;
        for (let column = 0; column <= columns; column++) {
          const u = column / columns;
          const ripple = Math.sin(u * 9 + v * 17) * .07;
          const z = -.95 + v * 1.45 + 1.35 * v ** 8 + ripple - front;
          positions.push(x + (u - .5) * width * (.94 + .06 * Math.sin(v * 8)), lower + (upper - lower) * v, z);
          const shade = .84 + .16 * Math.sin(u * Math.PI) * (.6 + .4 * v);
          colors.push(shade, shade, shade);
          if (row < rows && column < columns) {
            const a = row * (columns + 1) + column;
            indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.applyMatrix4(base);
      addGeometry(geometry, paint, false);
    }
    try {
      build({ part, atTrack, surface, curtain });
      for (const { paint, shadow, roadSurface, geometries } of buckets.values()) {
        const geometry = mergeGeometries(geometries);
        if (!geometry) throw new Error(`Could not batch ${name} ${paint}`);
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, paints[paint]);
        mesh.name = `${name}-${paint}${roadSurface ? '-road' : shadow ? '' : '-detail'}`;
        mesh.castShadow = shadow; mesh.receiveShadow = shadow || roadSurface;
        mesh.userData.roadSurface = roadSurface;
        group.add(mesh);
      }
      root.add(group);
    } finally { for (const bucket of buckets.values()) bucket.geometries.forEach(geometry => geometry.dispose()); }
  }

  function flag(part, x, y, z, paint) {
    part('cylinder', 'cream', [x, y / 2, z], [.11, y, .11]);
    part('ball', 'gold', [x, y + .1, z], [.23, .23, .23]);
    part('cone', paint, [x, y - .9, z + 1.25], [.8, 2.5, .08], [Math.PI / 2, 0, 0], false);
  }

  try {
    venue('bear-creek-bridge', 347, ({ part, atTrack, surface }) => {
      // Wide short planks rise with the real shared bridge; the boost pad keeps
      // its own orange background instead of competing with timber stripes.
      for (let d = 310, i = 0; d < 375; d += 2.6, i++) {
        const end = Math.min(d + 2.35, 375);
        if (end > 348.8 && d < 361.2) continue;
        surface(d, end, -7.3, 7.3, i % 3 === 0 ? 'lightwood' : 'wood');
        for (const side of [-1, 1]) surface(d + .4, Math.min(d + .62, end), side * 6.5 - .15, side * 6.5 + .15, 'darkwood', .086);
      }
      for (let d = 311; d <= 375; d += 4) for (const side of [-1, 1]) {
        atTrack(d, 'box', 'darkwood', [side * 14.25, -.8, 0], [1.1, 1.4, 4.2]);
        atTrack(d, 'box', 'lightwood', [side * 14.25, 2, 0], [.55, .48, 4.2]);
      }
      for (let d = 312; d <= 375; d += 10) for (const side of [-1, 1]) {
        const f = sampleTrack(d), height = f.position.y + 3.5;
        atTrack(d, 'box', 'wood', [side * 14.25, -height / 2 + 2.3, 0], [1.35, height, 1.35]);
        atTrack(d, 'box', 'cream', [side * 14.25, 2.65, 0], [1.7, .28, 1.7]);
        atTrack(d, 'ball', 'gold', [side * 14.25, 3.05, 0], [.42, .42, .42]);
      }
      // A substantial front-facing mill wheel is readable during the approach.
      const x = 30, y = 3.1, z = 1;
      part('rounded', 'rock', [x, -3.4, z + 3], [16, 3, 19]);
      part('rounded', 'lightwood', [x, 2.8, z + 4], [10, 8, 8]);
      for (let i = -4; i <= 4; i++) part('box', 'wood', [x + i, 2.8, z - .02], [.05, 7.7, .055]);
      for (const side of [-1, 1]) {
        part('box', 'darkwood', [x + side * 3.2, 4.4, z - .09], [1.4, 1.9, .13]);
        part('box', 'cream', [x + side * 3.2, 4.4, z - .17], [.09, 1.95, .05]);
        part('box', 'cream', [x + side * 3.2, 4.4, z - .17], [1.45, .09, .05]);
      }
      for (const side of [-1, 1]) part('box', 'coral', [x + side * 2.7, 7.9, z + 4], [6.4, .65, 11], [0, 0, -side * .4]);
      part('box', 'cream', [x, 9.2, z + 4], [.65, .7, 11.1]);
      part('box', 'ink', [x, 4.4, z - .08], [2, 2.6, .12]);
      for (const side of [-1, 1]) part('box', 'darkwood', [x + side * 6, 1, z - 3.4], [.8, 7, .8]);
      for (const face of [-1, 1]) {
        part('ring', 'darkwood', [x, y, z - 4 + face * .72], [5.3, 5.3, 5.3]);
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI / 5;
          part('box', 'wood', [x + Math.sin(a) * 2.5, y + Math.cos(a) * 2.5, z - 4 + face * .72], [.35, 5.2, .3], [0, 0, -a]);
        }
      }
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        part('box', i % 2 ? 'wood' : 'lightwood', [x + Math.sin(a) * 5.2, y + Math.cos(a) * 5.2, z - 4], [1.3, .35, 2], [0, 0, -a]);
      }
      part('cylinder', 'gold', [x, y, z - 4], [.75, 3, .75], [Math.PI / 2, 0, 0]);
      part('box', 'rock', [x, -2.65, z - 6], [18, .55, 8]);
      part('box', 'water', [x, -2.32, z - 6], [16, .07, 6], [0, 0, 0], false);
      for (let i = 0; i < 9; i++) part('ball', 'foam', [x + (i - 4) * 1.4, -2.23, z - 5.5 + Math.sin(i * 2)], [.5, .1, .3], [0, 0, 0], false);
      flag(part, 21, 10, -14, 'coral'); flag(part, -20, 9, 15, 'teal');
    });

    venue('rocket-runway', 664, ({ part, atTrack, surface }) => {
      // Shoulder inlays frame the existing full-width turbo strip without
      // painting over its center chevrons or the automatic ramp's markings.
      for (const side of [-1, 1]) {
        surface(620, 671, side * 6.55 - .45, side * 6.55 + .45, 'teal');
        surface(696, 725, side * 6.55 - .45, side * 6.55 + .45, 'teal');
        for (let d = 622; d <= 724; d += 12) {
          if (d >= 672 && d <= 695) continue;
          surface(d, d + 2.5, side * 5.9 - .2, side * 5.9 + .2, 'gold');
        }
      }
      const x = -27;
      part('hull', 'ink', [x, -.45, 0], [10.5, 1.8, 10.5]);
      part('hull', 'cream', [x, .55, 0], [9.9, .25, 9.9]);
      part('ring', 'gold', [x, .75, 0], [8.5, 8.5, 8.5], [Math.PI / 2, 0, 0]);
      for (const side of [-1, 1]) {
        part('cylinder', 'darkwood', [x + side * 6.8, -4, -5.5], [.65, 7, .65]);
        part('cylinder', 'darkwood', [x + side * 6.8, -4, 5.5], [.65, 7, .65]);
      }
      part('hull', 'cream', [x, 10.6, 0], [3.3, 15.5, 3.3]);
      part('nose', 'coral', [x, 18.35, 0], [3.3, 5.65, 3.3]);
      for (const y of [5.6, 16.3]) part('hull', 'coral', [x, y, 0], [3.35, 1.1, 3.35]);
      part('cylinder', 'ink', [x, 2.7, 0], [2.4, 1.3, 2.4]);
      part('cylinder', 'gold', [x, 2.05, 0], [2.7, .35, 2.7]);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        part('box', 'coral', [x + Math.sin(a) * 3.3, 4.4, Math.cos(a) * 3.3], [1, 7, 4.5], [0, a, 0]);
        part('box', 'ink', [x + Math.sin(a) * 4.4, 1.2, Math.cos(a) * 4.4], [1.6, .5, 2.5], [0, a, 0]);
      }
      // Front porthole and a smaller side one make the rocket recognisable even
      // as it moves from the horizon to the edge of a portrait viewport.
      for (const a of [0, Math.PI / 2]) {
        const nx = Math.sin(a), nz = -Math.cos(a);
        part('cylinder', 'gold', [x + nx * 3.26, 12.5, nz * 3.26], [1.4, .24, 1.4], [Math.PI / 2, 0, -a]);
        part('ball', 'ink', [x + nx * 3.48, 12.5, nz * 3.48], [1.12, 1.12, .18], [0, -a, 0]);
        part('ball', 'foam', [x + nx * 3.58 - .28, 12.84, nz * 3.58], [.25, .25, .06], [0, -a, 0], false);
      }
      // A small control plinth and arm point toward the toy course, never across it.
      part('box', 'teal', [-18.8, 1.7, -3], [3.1, 3.4, 4]);
      part('box', 'ink', [-18.8, 3.5, -3.6], [2.5, .25, 2.2], [.22, 0, 0]);
      for (let i = 0; i < 3; i++) part('ball', i === 1 ? 'gold' : 'cream', [-19.55 + i * .75, 3.77, -4], [.22, .13, .22]);
      for (let d = 631; d <= 716; d += 17) {
        atTrack(d, 'cylinder', 'ink', [-14.5, .8, 0], [.28, 1.6, .28]);
        atTrack(d, 'ball', 'gold', [-14.5, 1.8, 0], [.4, .4, .4]);
      }
      flag(part, -19, 9.5, -14, 'coral'); flag(part, -44, 13, 10, 'teal');
    });

    venue('gator-falls', 1383, ({ part, atTrack, surface, curtain }) => {
      for (const side of [-1, 1]) for (let d = 1330, i = 0; d < 1440; d += 4, i++) {
        surface(d, Math.min(d + 3.5, 1440), side * 6.45 - .72, side * 6.45 + .72, i % 3 ? 'lightwood' : 'wood');
      }
      for (let d = 1338; d <= 1422; d += 12) {
        atTrack(d, 'box', 'darkwood', [-14.6, -.35, 0], [1.1, 1, 12.5]);
        atTrack(d, 'cylinder', 'wood', [-14.6, -.1, 0], [.58, 5, .58]);
        atTrack(d, 'ball', 'cream', [-14.6, 2.55, 0], [.8, .4, .8]);
      }
      const x = -29, waterY = -1.7 - sampleTrack(1383).position.y;
      // Worn rounded rock, curved falling sheets and a rolling crest. Water is
      // opaque geometry with soft vertex shading, keeping overdraw bounded.
      for (let row = 0; row < 4; row++) for (let column = 0; column < 3; column++) {
        part('rock', 'rock', [x + (column - 1) * 6.5, -1 + row * 5.3, 6 + row * .7],
          [5.7 - row * .4, 5.2, 5.6], [0, .35 * (row + column), .09 * (column - 1)]);
      }
      part('rock', 'green', [x - 1, 18.2, 7.2], [10.6, 1.7, 6.8]);
      for (let stream = 0; stream < 3; stream++) {
        const sx = x + (stream - 1) * 3.3;
        curtain(sx, 3.45, waterY, 18.4, 'water');
        part('ball', 'water', [sx, 18.38, 2.15], [1.8, .38, 2.8], [0, 0, 0], false);
        for (const offset of [-.7, .65]) curtain(sx + offset, .09 + .02 * stream, waterY + .1, 18.34, 'foam', .09);
      }
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        part('ball', i % 3 ? 'foam' : 'water', [x + Math.cos(a) * 7, waterY + .08, -2 + Math.sin(a) * 3.3], [1.7, .65, 1.3], [0, 0, 0], false);
      }
      part('rock', 'water', [x, waterY - .2, -4], [12, .32, 8], [0, .2, 0], false);
      // An overlook at the side of the waterfall gives the lagoon a human-scale
      // detail without adding a new construction-play mechanic.
      part('box', 'wood', [-23, -.7, -17], [12, .7, 9]);
      for (const dx of [-5, 5]) for (const dz of [-3.5, 3.5]) part('cylinder', 'darkwood', [-23 + dx, -2.6, -17 + dz], [.45, 4.5, .45]);
      for (const z of [-21, -13]) {
        part('box', 'lightwood', [-23, 2, z], [12, .35, .35]);
        for (const x of [-28, -23, -18]) part('cylinder', 'wood', [x, .75, z], [.23, 2.5, .23]);
      }
      // A wide gator-shaped bench nods to the existing friendly bay characters.
      part('ball', 'green', [-23, .35, -17], [1.8, .5, 3.4]);
      part('box', 'teal', [-23, .65, -14.3], [2.6, .7, 2.7]);
      for (const side of [-1, 1]) {
        part('ball', 'green', [-23 + side * .8, 1.2, -14.9], [.48, .5, .45]);
        part('ball', 'cream', [-23 + side * .8, 1.25, -14.51], [.25, .25, .15]);
        part('ball', 'ink', [-23 + side * .8, 1.25, -14.35], [.09, .14, .06]);
      }
      for (let i = 0; i < 14; i++) {
        const rx = -45 + (i % 4) * 3, rz = -11 + Math.floor(i / 4) * 8;
        part('box', 'green', [rx, -.2, rz], [.2, 3.8 + i % 3, .25], [0, i, -.12]);
        part('cylinder', 'darkwood', [rx + .18, 1.8 + (i % 3) * .5, rz], [.25, 1.1, .25]);
      }
      flag(part, -18, 9, -25, 'gold');
    });
  } finally { Object.values(shapes).forEach(geometry => geometry.dispose()); }
  return root;
}
