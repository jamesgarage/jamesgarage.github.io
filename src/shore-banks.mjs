import * as THREE from 'three';

/** A shared low bank whose irregular outer rim stays inside the unit disk. */
export function createShoreBankGeometry() {
  const segments = 32, positions = [0, 1, 0], indices = [], colors = [], uv = [.5, .5];
  const dry = new THREE.Color(0xe8c88d), wet = new THREE.Color(0xc4b389), submerged = new THREE.Color(0xa39f7f);
  dry.toArray(colors, 0);
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const irregularity = Math.sin(angle * 3 + .45) * .035 + Math.sin(angle * 5 - .7) * .025 + Math.cos(angle * 7) * .02;
    // The middle ring meets the visible waterline; varying only the submerged
    // outer rim would still leave a row of regular oval disks above the water.
    const radius = ring === 0 ? .74 : ring === 1 ? .84 + irregularity * .9 : Math.min(1, .94 + irregularity);
    const height = ring === 0 ? 1 : ring === 1 ? .4 : 0;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    positions.push(x, height, z); uv.push((x + 1) / 2, (z + 1) / 2);
    const paint = (ring === 0 ? dry : ring === 1 ? wet : submerged).clone();
    paint.multiplyScalar(1 + Math.sin(angle * 2 + .3) * .025); colors.push(paint.r, paint.g, paint.b);
    if (ring === 0) indices.push(0, 1 + (i + 1) % segments, 1 + i);
    else {
      const inner = 1 + (ring - 1) * segments + i, outer = 1 + ring * segments + i;
      const nextInner = 1 + (ring - 1) * segments + (i + 1) % segments;
      const nextOuter = 1 + ring * segments + (i + 1) % segments;
      indices.push(inner, nextOuter, outer, inner, nextInner, nextOuter);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
