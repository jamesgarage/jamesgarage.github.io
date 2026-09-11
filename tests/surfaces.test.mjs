import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSurfaceTexture, surfaceUVs } from '../src/surfaces.mjs';

test('original surface tiles are deterministic, independently owned, filtered and bounded', () => {
  const tiles = ['wood', 'stone', 'ground', 'water'].map(createSurfaceTexture);
  try {
    for (const tile of tiles) {
      const copy = createSurfaceTexture(tile.name.split('-')[1]);
      assert.notEqual(tile, copy); assert.notEqual(tile.image.data, copy.image.data);
      assert.deepEqual(tile.image.data, copy.image.data); copy.dispose();
      assert.equal(tile.image.width, 128); assert.equal(tile.image.height, 128);
      assert.equal(tile.generateMipmaps, true); assert.equal(tile.wrapS, THREE.RepeatWrapping);
      const values = new Set(tile.image.data.filter((_, i) => i % 4 === 0));
      assert.ok(values.size > 20, 'medium-scale physical material contrast is present');
    }
    for (let i = 1; i < tiles.length; i++) assert.notDeepEqual(tiles[i].image.data, tiles[i - 1].image.data);
  } finally { tiles.forEach(tile => tile.dispose()); }
});

test('falling water keeps its vertical texture density instead of collapsing into the ground plane', () => {
  const geometry = new THREE.PlaneGeometry(11, 22);
  try {
    surfaceUVs(geometry, 'water');
    const u = [], v = [];
    for (let i = 0; i < geometry.attributes.uv.count; i++) {
      u.push(geometry.attributes.uv.getX(i)); v.push(geometry.attributes.uv.getY(i));
    }
    assert.equal(Math.max(...u) - Math.min(...u), 2);
    assert.equal(Math.max(...v) - Math.min(...v), 1);
  } finally { geometry.dispose(); }
});

test('rounded water crests never switch projection within a triangle far along the course', () => {
  const geometry = new THREE.SphereGeometry(1, 10, 6); geometry.scale(2, .4, 3); geometry.translate(-20, 4, 1200);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  try {
    surfaceUVs(geometry, 'water');
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < geometry.index.count; i += 3) for (let edge = 0; edge < 3; edge++) {
      const ai = geometry.index.getX(i + edge), bi = geometry.index.getX(i + (edge + 1) % 3);
      a.fromBufferAttribute(position, ai); b.fromBufferAttribute(position, bi);
      const uvLength = Math.hypot(uv.getX(ai) - uv.getX(bi), uv.getY(ai) - uv.getY(bi));
      assert.ok(uvLength <= a.distanceTo(b) / 11 + .00001, 'continuous physical-scale projection has no world-axis jumps');
    }
  } finally { geometry.dispose(); }
});

test('rounded material triangle texture density remains physical anywhere along the course', () => {
  const point = new THREE.Vector3(), edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3();
  for (const [kind, density] of [['wood', .55 * .13], ['stone', .32 * .32], ['water', 1 / 121]]) {
    const local = new THREE.SphereGeometry(1, 10, 6); local.scale(2, .4, 3);
    const remote = local.clone(); remote.translate(-20, 4, 1200);
    try {
      for (const geometry of [local, remote]) {
        surfaceUVs(geometry, kind);
        const position = geometry.attributes.position, uv = geometry.attributes.uv;
        const count = geometry.index?.count ?? position.count, index = i => geometry.index ? geometry.index.getX(i) : i;
        for (let i = 0; i < count; i += 3) {
          const a = index(i), b = index(i + 1), c = index(i + 2);
          point.fromBufferAttribute(position, a); edgeA.fromBufferAttribute(position, b).sub(point); edgeB.fromBufferAttribute(position, c).sub(point);
          const area = edgeA.cross(edgeB).length();
          const uvArea = Math.abs((uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) - (uv.getY(b) - uv.getY(a)) * (uv.getX(c) - uv.getX(a)));
          assert.ok(uvArea <= area * density + .00002, `${kind} has no triangle stretched across world axes`);
        }
      }
    } finally { local.dispose(); remote.dispose(); }
  }
});

test('surface mapping follows physical dimensions on all faces and supports merged primitives', () => {
  const geometry = new THREE.BoxGeometry(2, 14, 8);
  try {
    for (const kind of ['wood', 'stone', 'ground', 'water']) {
      surfaceUVs(geometry, kind);
      assert.equal(geometry.attributes.uv.count, geometry.attributes.position.count);
      assert.ok(geometry.attributes.uv.array.every(Number.isFinite));
      assert.ok(new Set(geometry.attributes.uv.array).size > 3);
    }
  } finally { geometry.dispose(); }
});
