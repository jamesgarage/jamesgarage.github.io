import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getCourse } from './courses.mjs';
import { LOOP_START, LOOP_END } from './core.mjs';
import { sampleTrack, trackCenter } from './track.mjs';
import { makeRoad, makeLoopSupport } from './world.mjs';
import { createSurfaceTexture, surfaceUVs } from './surfaces.mjs';

const owners = new WeakMap();
const TAU = Math.PI * 2;
const noise = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const color = new THREE.Color();

function mesaGeometry() {
  const positions = [], colors = [], indices = [], segments = 32;
  const levels = [0, .10, .18, .31, .38, .51, .61, .72, .86, .96, 1];
  const radii = [1, 1.03, .98, .95, .94, .88, .86, .80, .75, .64, .61];
  const strata = [0xb76543, 0xbe774c, 0xcb8855, 0xc47d4c, 0xdbac73, 0xd1a06c, 0xb97850, 0xca8d5e, 0xd8a771, 0xdfb580, 0xe6be87];
  for (let ring = 0; ring < levels.length; ring++) for (let i = 0; i <= segments; i++) {
    const angle = i / segments * TAU;
    const radius = radii[ring] * (1 + .12 * Math.sin(angle * 3 + .6) + .06 * Math.cos(angle * 5));
    const y = levels[ring] + (ring === 0 ? 0 : .012 * Math.sin(angle * 3 + ring * .35));
    positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    color.setHex(strata[ring]);
    if (ring > 8) color.lerp(new THREE.Color(0xe6bc87), .45);
    colors.push(color.r, color.g, color.b);
    if (ring < levels.length - 1 && i < segments) {
      const a = ring * (segments + 1) + i, b = a + segments + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const center = positions.length / 3; positions.push(0, 1, 0); color.setHex(0xe6bc87); colors.push(color.r, color.g, color.b);
  for (let i = 0; i < segments; i++) indices.push(center, (levels.length - 1) * (segments + 1) + i + 1, (levels.length - 1) * (segments + 1) + i);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const welded = mergeVertices(geometry); geometry.dispose(); welded.computeVertexNormals();
  return welded;
}

function groundHeight(x, z) {
  const d = z < LOOP_START ? z : z + LOOP_END - LOOP_START;
  const shoulder = THREE.MathUtils.smoothstep(Math.abs(x - trackCenter(d).x), 22, 85);
  return -2.6 + shoulder * (2.5 + 1.7 * Math.sin(x / 39 + z / 71) + 1.1 * Math.cos(z / 37 - x / 53));
}

function terrainGeometry(start, end, deep = false) {
  const geometry = new THREE.PlaneGeometry(480, end - start, 32, Math.max(2, Math.ceil((end - start) / 7)));
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, (start + end) / 2);
  const positions = geometry.attributes.position, colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    positions.setY(i, deep ? -54 + Math.sin(x / 28) * Math.cos(z / 19) * 2 : groundHeight(x, z));
    color.setHex(deep ? 0x78544b : 0xe6b879);
    color.lerp(new THREE.Color(deep ? 0xa37352 : 0xc9915d), .18 + .16 * Math.sin(x / 28 + z / 34));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); surfaceUVs(geometry, 'ground'); return geometry;
}

function cliffFace(z, intoGap) {
  const positions = [], colors = [], indices = [], columns = 48, rows = 12;
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    const x = -240 + column / columns * 480, t = row / rows;
    const top = groundHeight(x, z), depth = THREE.MathUtils.lerp(top, -55, t);
    // The shelf edge is exact; lower ledges retreat into the solid bank.
    const retreat = t * (2.4 + Math.sin(x / 11 + row * .7) * .8);
    positions.push(x, depth, z - intoGap * retreat);
    color.setHex([0xc58a5c, 0xb77b52, 0xc18a60, 0xb37652][row % 4]);
    color.multiplyScalar(1 - t * .20); colors.push(color.r, color.g, color.b);
    if (row < rows && column < columns) {
      const a = row * (columns + 1) + column, b = a + columns + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function padGeometry(start, end) {
  const positions = [], indices = [], steps = Math.ceil((end - start) / 2);
  for (let i = 0; i <= steps; i++) {
    const frame = sampleTrack(THREE.MathUtils.lerp(start, end, i / steps));
    for (const x of [-7.4, 7.4]) {
      const p = frame.position.clone().addScaledVector(frame.right, x).addScaledVector(frame.up, .048);
      positions.push(...p.toArray());
    }
    if (i < steps) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** One cached world owns every final geometry/material/map it creates. */
export function createCanyonWorld() {
  const course = getCourse('canyon'), world = new THREE.Group(); world.name = 'canyon-world';
  world.userData.courseId = course.id;
  const stone = createSurfaceTexture('stone'), sand = createSurfaceTexture('ground');
  const paints = {
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .97, map: stone, bumpMap: stone, bumpScale: .025, side: THREE.DoubleSide }),
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: sand, bumpMap: sand, bumpScale: .045 }),
    cactus: new THREE.MeshStandardMaterial({ color: 0x4c8860, roughness: .85 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xffedbb, roughness: .7 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x69493a, roughness: .8 }),
    launch: new THREE.MeshStandardMaterial({ color: 0xf4cb5a, roughness: .78, side: THREE.DoubleSide }),
    landing: new THREE.MeshStandardMaterial({ color: 0x379c95, roughness: .78, side: THREE.DoubleSide }),
  };
  for (const [key, paint] of Object.entries(paints)) paint.name = `canyon-${key}`;
  const primitives = {
    mesa: mesaGeometry(), box: new RoundedBoxGeometry(1, 1, 1, 2, .12),
    ball: new THREE.SphereGeometry(1, 16, 10), cactus: new THREE.CapsuleGeometry(1, 2, 5, 12),
  };
  const buckets = new Map();
  function add(geometry, paint, matrix = new THREE.Matrix4(), kind = 'detail', chunk = 0) {
    const key = `${chunk}:${kind}:${paint.uuid}`;
    if (!buckets.has(key)) buckets.set(key, { paint, kind, chunk, parts: [] });
    let copy = geometry.clone().applyMatrix4(matrix);
    if (paint === paints.rock) surfaceUVs(copy, 'stone');
    if (copy.index) { const expanded = copy.toNonIndexed(); copy.dispose(); copy = expanded; }
    buckets.get(key).parts.push(copy);
  }
  function piece(shape, paint, position, scale, kind, chunk, quaternion = new THREE.Quaternion()) {
    add(primitives[shape], paint, new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(...scale)), kind, chunk);
  }
  function ownMesh(geometry, paint, name, kind) {
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, paint); mesh.name = name; mesh.userData.canyonKind = kind;
    mesh.receiveShadow = true; mesh.castShadow = kind !== 'ground' && kind !== 'floor'; world.add(mesh); return mesh;
  }

  // Road topology is shared; every deck, underside, rail and stripe stops at the gap.
  const road = makeRoad({ gaps: course.gaps });
  for (const mesh of road.children) {
    const chunk = mesh.userData.roadSection;
    add(mesh.geometry, mesh.material, new THREE.Matrix4(), 'road', chunk);
    mesh.geometry.dispose();
  }

  const gaps = course.gaps.map(gap => ({ ...gap, zStart: trackCenter(gap.start).z, zEnd: trackCenter(gap.end).z }));
  const groundSpans = []; let cursor = -80;
  for (const gap of gaps) { groundSpans.push([cursor, gap.zStart]); cursor = gap.zEnd; }
  groundSpans.push([cursor, trackCenter(course.end + 110).z]);
  for (const [start, end] of groundSpans) for (let z = start; z < end; z += 100) {
    ownMesh(terrainGeometry(z, Math.min(z + 100, end)), paints.ground, `canyon-shelf-${z}`, 'ground');
  }
  for (const gap of gaps) {
    ownMesh(terrainGeometry(gap.zStart - 5, gap.zEnd + 5, true), paints.ground, `${gap.id}-floor`, 'floor');
    for (const [z, sign, edge] of [[gap.zStart, 1, 'launch'], [gap.zEnd, -1, 'landing']]) {
      const face = cliffFace(z, sign); surfaceUVs(face, 'stone');
      ownMesh(face, paints.rock, `${gap.id}-${edge}-cliff`, 'cliff');
    }
    for (const [start, end, kind, paint] of [[gap.launch, gap.start, 'launch', paints.launch], [gap.end, gap.land, 'landing', paints.landing]]) {
      const pad = ownMesh(padGeometry(start, end), paint, `${gap.id}-${kind}-pad`, 'pad');
      pad.userData.roadInterval = Object.freeze([start, end]);
      const frame = sampleTrack((start + end) / 2), chunk = Math.floor(frame.position.z / 100) * 100;
      for (const side of [-1, 1]) {
        const p = frame.position.clone().addScaledVector(frame.right, side * 14.5); p.y = groundHeight(p.x, p.z);
        piece('box', paints.dark, p.clone().add(new THREE.Vector3(0, 2.5, 0)), [.35, 5, .35], 'marker', chunk);
        piece('box', paint, p.clone().add(new THREE.Vector3(0, 4.35, 0)), [1.9, 1.25, .30], 'marker', chunk, frame.quaternion);
        piece('ball', paints.cream, p.clone().add(new THREE.Vector3(0, 5.03, 0)), [.22, .22, .22], 'marker', chunk);
      }
      for (let d = start + 3; d < end - 2; d += 5) {
        const f = sampleTrack(d);
        for (const side of [-1, 1]) {
          const p = f.position.clone().addScaledVector(f.right, side * .72).addScaledVector(f.up, .082);
          const turn = f.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * -.65));
          piece('box', paints.cream, p, [.22, .035, 2.2], 'pad-marking', chunk, turn);
        }
      }
    }
  }

  // Substantial rounded, layered silhouettes; no formation enters the flight corridor.
  for (let d = -35; d < course.end + 100; d += 68) {
    if (d > LOOP_START - 100 && d < LOOP_END + 90) continue;
    if (course.gaps.some(gap => d > gap.launch - 30 && d < gap.land + 30)) continue;
    const frame = sampleTrack(d), chunk = Math.floor(frame.position.z / 100) * 100;
    for (const side of [-1, 1]) {
      const radius = 14 + noise(d + side) * 7;
      const p = frame.position.clone().addScaledVector(frame.right, side * (58 + noise(d * 3 + side) * 8));
      p.y = groundHeight(p.x, p.z) - .6;
      piece('mesa', paints.rock, p, [radius, 17 + noise(d + 7) * 24, 19 + noise(d + 5) * 13], 'mesa', chunk,
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), noise(d + side * 7) * TAU));
      const root = frame.position.clone().addScaledVector(frame.right, side * (24 + noise(d + 17) * 6)); root.y = groundHeight(root.x, root.z);
      const height = 4.2 + noise(d + side * 13) * 2.5;
      piece('cactus', paints.cactus, root.clone().add(new THREE.Vector3(0, height / 2, 0)), [.40, height / 4, .40], 'cactus', chunk);
      for (const branchSide of [-1, 1]) {
        const y = height * (branchSide < 0 ? .43 : .65), reach = branchSide * 1.1;
        const points = [new THREE.Vector3(0, y, 0), new THREE.Vector3(reach, y + .12, 0), new THREE.Vector3(reach * 1.2, y + .85, 0), new THREE.Vector3(reach * 1.2, y + 1.5, 0)];
        const branch = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, .25, 8, false);
        add(branch, paints.cactus, new THREE.Matrix4().makeTranslation(...root.toArray()), 'cactus', chunk); branch.dispose();
        piece('ball', paints.cactus, root.clone().add(points.at(-1)), [.25, .25, .25], 'cactus', chunk);
      }
    }
  }
  for (let z = -70, i = 0; z < trackCenter(course.end + 110).z; z += 130, i++) for (const side of [-1, 1]) {
    const x = side * (145 + noise(i + side * 3) * 30), chunk = Math.floor(z / 100) * 100;
    piece('mesa', paints.rock, new THREE.Vector3(x, groundHeight(x, z) - 1, z), [29 + noise(i) * 15, 30 + noise(i + 4) * 27, 42], 'horizon', chunk);
  }

  for (const { paint, kind, chunk, parts } of buckets.values()) {
    const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
    if (!geometry) throw new Error(`Canyon batch attributes differ: ${kind}`);
    ownMesh(geometry, paint, `canyon-${kind}-${chunk}`, kind);
  }
  for (const geometry of Object.values(primitives)) geometry.dispose();

  // Existing proven loop structure; cloned materials keep the canyon independent.
  const support = makeLoopSupport(), supportPaints = new Map();
  support.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (!supportPaints.has(mesh.material)) supportPaints.set(mesh.material, mesh.material.clone());
    mesh.material = supportPaints.get(mesh.material); mesh.userData.canyonKind = 'loop-support';
  });
  world.add(support);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  world.traverse(mesh => {
    if (!mesh.isMesh) return; geometries.add(mesh.geometry); materials.add(mesh.material);
    for (const value of Object.values(mesh.material)) if (value?.isTexture) textures.add(value);
    mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
  });
  owners.set(world, { geometries, materials, textures });
  world.userData.gaps = Object.freeze(course.gaps.map(gap => Object.freeze({ id: gap.id, start: gap.start, end: gap.end })));
  return world;
}

/** Idempotent; other cached worlds and future canyon instances stay valid. */
export function disposeCanyonWorld(world) {
  const owned = owners.get(world); if (!owned) return;
  for (const geometry of owned.geometries) geometry.dispose();
  for (const material of owned.materials) material.dispose();
  for (const texture of owned.textures) texture.dispose();
  owners.delete(world);
}
