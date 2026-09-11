import * as THREE from 'three';

function tileNoise(u, v, columns, rows = columns) {
  const x = u * columns, y = v * rows, ix = Math.floor(x), iy = Math.floor(y);
  const smooth = value => value * value * (3 - 2 * value);
  const tx = smooth(x - ix), ty = smooth(y - iy);
  const corner = (dx, dy) => {
    let n = Math.imul((ix + dx) % columns + 17, 0x45d9f3b) ^ Math.imul((iy + dy) % rows + 31, 0x27d4eb2d);
    n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  };
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(corner(0, 0), corner(1, 0), tx),
    THREE.MathUtils.lerp(corner(0, 1), corner(1, 1), tx), ty);
}

// Small original, seamless material tiles. No canvas, downloads or shader hooks:
// the same data is testable in Node and filtered by Three's normal mipmap path.
export function createSurfaceTexture(kind) {
  const size = 128, pixels = new Uint8Array(size * size * 4), tau = Math.PI * 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * tau, v = y / size * tau;
    const broad = tileNoise(x / size, y / size, 4) * 2 - 1;
    const fleck = tileNoise(x / size, y / size, 32) * 2 - 1;
    let shade;
    if (kind === 'wood') {
      const warp = tileNoise(x / size, y / size, 3, 5) * 6;
      const grain = Math.sin(u * 7 + warp + Math.sin(v) * .8);
      shade = 235 + grain * 9 + broad * 7 + fleck * 2;
    } else if (kind === 'water') {
      const crest = Math.max(0, Math.cos(v * 4 + Math.sin(u) * 1.6 + Math.sin(u * 3) * .25)) ** 14;
      shade = 215 + crest * 35 + broad * 4;
    } else {
      shade = (kind === 'ground' ? 239 : 230) + broad * 17 + fleck * 7;
    }
    const i = (y * size + x) * 4, value = Math.round(THREE.MathUtils.clamp(shade, 0, 255));
    pixels[i] = pixels[i + 1] = pixels[i + 2] = value; pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = `original-${kind}-surface`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  return texture;
}

// Physical-scale UVs survive transformed static batching, without stretching
// a single knot over a whole mill building or a whole forest trunk.
export function surfaceUVs(geometry, kind) {
  if (['wood', 'stone'].includes(kind) && geometry.index) {
    const expanded = geometry.toNonIndexed(); geometry.copy(expanded); expanded.dispose();
  }
  const positions = geometry.attributes.position;
  const uv = new Float32Array(positions.count * 2);
  let waterPlane = 'xz';
  if (kind === 'water') {
    // One authored sheet/pool receives one projection before static batching.
    // Switching planes per vertex would interpolate unrelated world axes over
    // curved crests, creating visible seams and excessive texture frequency.
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    if (size.y > Math.min(size.x, size.z)) waterPlane = size.x < size.z ? 'yz' : 'yx';
  }
  let solidPlane = 'xz';
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    if (['wood', 'stone'].includes(kind) && i % 3 === 0) {
      const ax = positions.getX(i + 1) - x, ay = positions.getY(i + 1) - y, az = positions.getZ(i + 1) - z;
      const bx = positions.getX(i + 2) - x, by = positions.getY(i + 2) - y, bz = positions.getZ(i + 2) - z;
      const nx = Math.abs(ay * bz - az * by), ny = Math.abs(az * bx - ax * bz), nz = Math.abs(ax * by - ay * bx);
      solidPlane = ny >= nx && ny >= nz ? 'xz' : nx > nz ? 'zy' : 'xy';
    }
    if (kind === 'water' && waterPlane !== 'xz') {
      // Turn the ripples into falling streaks on vertical sheets, maintaining
      // physical scale through the height of the waterfall.
      uv[i * 2] = y / 11; uv[i * 2 + 1] = (waterPlane === 'yz' ? z : x) / 11;
    } else if (kind === 'ground' || kind === 'water') {
      uv[i * 2] = x / (kind === 'water' ? 11 : 15); uv[i * 2 + 1] = z / (kind === 'water' ? 11 : 15);
    } else {
      // Separate triangle vertices let neighboring box/stone faces use their
      // natural planes without blending unrelated UV axes inside a triangle.
      const a = solidPlane === 'xz' || solidPlane === 'zy' ? z : x, b = solidPlane === 'xz' ? x : y;
      uv[i * 2] = a * (kind === 'wood' ? .55 : .32);
      uv[i * 2 + 1] = b * (kind === 'wood' ? .13 : .32);
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}
