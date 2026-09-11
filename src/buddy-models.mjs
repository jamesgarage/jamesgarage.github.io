import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const ownership = new WeakMap();

/** Small original toy companions. Static parts share a material batch; the
 * sprung shell and four X-axis wheel pivots remain independently animated. */
export function makeBuddyTruck(spec) {
  const group = new THREE.Group(); group.name = `buddy-${spec.id}`;
  group.scale.setScalar(spec.scale ?? .48);
  const body = new THREE.Group(); body.name = 'sprung-body'; group.add(body);
  const wheels = [], batches = new Map(), geometries = new Set();
  const style = spec.style ?? spec.id;
  const paint = spec.color ?? 0xffd458, accent = spec.accent ?? 0xff8c54;
  const p = {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .3, metalness: style === 'bolt' ? .52 : .04, clearcoat: .8, clearcoatRoughness: .2 }),
    dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .65, metalness: .14 }),
    glass: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .1, metalness: 0, clearcoat: .8 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .28, metalness: .68 }),
    light: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .27, emissive: 0xffeac1, emissiveIntensity: .12 }),
    rubber: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94 }),
  };
  for (const [name, material] of Object.entries(p)) material.name = `buddy-${spec.id}-${name}`;
  const dark = 0x253c49, glass = 0x184f68, chrome = 0xd6e6e8, cream = 0xfff5d8;

  function part(parent, geometry, material, tint, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    const color = new THREE.Color(tint), colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!batches.has(parent)) batches.set(parent, new Map());
    if (!batches.get(parent).has(material)) batches.get(parent).set(material, []);
    batches.get(parent).get(material).push(geometry);
  }
  function box(parent, material, tint, position, size, radius = .07, rotation = [0, 0, 0]) {
    part(parent, new RoundedBoxGeometry(...size, 1, Math.min(radius, ...size.map(v => v * .45))), material, tint, position, rotation);
  }
  function ball(parent, material, tint, position, scale) {
    part(parent, new THREE.SphereGeometry(1, 12, 7), material, tint, position, [0, 0, 0], scale);
  }
  function cylinder(parent, material, tint, position, radius, length, rotation = [0, 0, Math.PI / 2], segments = 12) {
    part(parent, new THREE.CylinderGeometry(radius, radius, length, segments), material, tint, position, rotation);
  }
  function rail(parent, material, tint, from, to, radius = .07) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to), delta = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), 8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    part(parent, geometry, material, tint, start.add(end).multiplyScalar(.5).toArray());
  }
  // The silhouette is drawn in longitudinal/vertical coordinates then extruded across X.
  function profile(parent, material, tint, outline, width, position = [0, 0, 0], bevel = .06) {
    const shape = new THREE.Shape();
    outline.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1 });
    geometry.translate(0, 0, -width / 2); geometry.rotateY(Math.PI / 2);
    part(parent, geometry, material, tint, position);
  }
  function feature(name, position) {
    const marker = new THREE.Object3D(); marker.name = name; marker.position.set(...position); body.add(marker);
  }

  const digger = style === 'digger', bolt = style === 'bolt', pebble = style === 'pebble';
  const cabZ = digger ? .5 : -.16, roof = bolt ? 3.08 : pebble ? 3.44 : 3.3;
  body.userData.style = style;
  body.userData.description = {
    sunny: 'Sunshine rally pickup with orange stripes, round roof lamps and rear roll bar',
    splash: 'Turquoise water-loving bear truck with rounded ears, cream muzzle and wave doors',
    ember: 'Red flame fan with golden curling flames, swept roof fins and rear wing',
    pebble: 'Purple rock crawler with high roof, spare tire, climbing rails and rock badges',
    bolt: 'Silver angular electric mini pickup with cyan lightning bolts and slim lamps',
    digger: 'Golden construction truck with an open dump tray, safety beacon and front scoop',
  }[style] ?? 'Friendly rounded toy pickup';

  box(group, p.dark, dark, [0, 1.34, 0], [2.25, .24, 3.9], .09);
  box(body, p.paint, paint, [0, 1.91, -.05], [2.44, .75, 3.96], .23);
  box(body, p.paint, paint, [0, 2.32, 1.33], [2.32, .29, 1.35], .13);
  profile(body, p.paint, paint, [[-1, 2.22], [-.9, roof - .13], [-.63, roof], [.25, roof], [.89, 2.35]], bolt ? 1.92 : 2.02, [0, 0, cabZ], bolt ? .07 : .13);
  box(body, p.paint, accent, [0, roof + .06, cabZ - .27], [2.15, .13, 1.23], .06);
  // Pickups have a recessed, readable bed; the construction tray is built below.
  if (!digger) {
    box(body, p.dark, dark, [0, 2.29, -1.56], [1.85, .1, .62], .04);
    for (const side of [-1, 1]) box(body, p.paint, paint, [side * 1.04, 2.43, -1.57], [.23, .27, .79], .09);
  }
  const windY = roof - .34, windZ = cabZ + .65;
  box(body, p.glass, glass, [0, windY, windZ], [1.77, .65, .09], .065, [-.59, 0, 0]);
  box(body, p.glass, glass, [0, roof - .36, cabZ - (bolt ? 1.055 : 1.095)], [1.65, .46, .055], .055, [.12, 0, 0]);
  for (const side of [-1, 1]) {
    // Big bright eyes face +Z; a small dark pupil keeps the expression friendly.
    part(body, new THREE.SphereGeometry(1, 12, 7), p.light, cream, [side * .42, windY + .035, windZ + .07], [-.59, 0, 0], [.235, .145, .028]);
    cylinder(body, p.dark, dark, [side * .4, windY + .05, windZ + .11], .078, .027, [Math.PI / 2 - .59, 0, 0], 12);
    profile(body, p.glass, glass, [[-.77, 2.61], [-.67, roof - .15], [.17, roof - .15], [.54, 2.61]], .026, [side * (bolt ? 1.05 : 1.13), 0, cabZ], .01);
    box(body, p.paint, accent, [side * 1.232, 1.93, -.27], [.045, .19, 1.02], .025);
    box(body, p.metal, chrome, [side * 1.246, 2.22, -.37], [.045, .065, .25], .02);
    box(body, p.light, cream, [side * .88, 2.17, 1.96], [bolt ? .57 : .39, bolt ? .13 : .25, .11], .055);
    box(body, p.paint, accent, [side * .87, 2.01, -2.052], [.3, .18, .06], .035);
    for (const z of [-1.48, 1.48]) {
      part(body, new THREE.TorusGeometry(1.02, .115, 4, 12, Math.PI), p.paint, paint, [side * 1.23, 1.04, z], [0, Math.PI / 2, 0]);
      rail(group, p.metal, chrome, [side * .89, 1.28, z - .13], [side * 1.18, 1.85, z + .1], .065);
      cylinder(group, p.metal, accent, [side * 1.05, 1.58, z], .14, .3, [0, 0, side * -.42], 10);
    }
  }
  box(body, p.dark, dark, [0, 1.7, 2.12], [2.7, .26, .27], .09);
  box(body, p.metal, chrome, [0, 1.76, 2.27], [2.15, .12, .07], .03);
  box(body, p.dark, dark, [0, 1.74, -2.12], [2.6, .22, .24], .07);
  box(body, p.dark, dark, [0, 2.11, 2.012], [.93, .29, .065], .06);
  for (const x of [-.27, 0, .27]) box(body, p.metal, chrome, [x, 2.12, 2.056], [.07, .18, .035], .015);

  // A lathed crown and sidewalls give the tires a rounded section. Low-cost
  // tread pads join the same rubber batch instead of creating 56 extra draws.
  const tireProfile = [[.43, -.32], [.59, -.39], [.79, -.385], [.94, -.27], [1.005, -.1], [1.015, .1], [.94, .27], [.79, .385], [.59, .39], [.43, .32], [.43, -.32]];
  function tire(parent) {
    part(parent, new THREE.LatheGeometry(tireProfile.map(v => new THREE.Vector2(...v)), 20), p.rubber, 0x182832, [0, 0, 0], [0, 0, Math.PI / 2]);
    for (let j = 0; j < 14; j++) {
      const a = j / 14 * TAU;
      part(parent, new THREE.BoxGeometry(.59, .115, pebble ? .28 : .23), p.rubber, 0x304753, [0, Math.cos(a) * 1.007, Math.sin(a) * 1.007], [a, j % 2 ? .16 : -.16, 0]);
    }
  }
  for (const z of [-1.48, 1.48]) {
    cylinder(group, p.metal, chrome, [0, 1.03, z], .08, 3.15);
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group(); wheel.name = `wheel-${z < 0 ? 'rear' : 'front'}-${side}`;
      wheel.position.set(side * 1.58, 1.03, z); group.add(wheel); wheels.push(wheel);
      tire(wheel);
      cylinder(wheel, p.metal, accent, [side * .4, 0, 0], .49, .055, [0, 0, Math.PI / 2], 16);
      part(wheel, new THREE.TorusGeometry(.51, .05, 4, 16), p.metal, chrome, [side * .443, 0, 0], [0, Math.PI / 2, 0]);
      for (let j = 0; j < 5; j++) {
        const a = j / 5 * TAU;
        part(wheel, new THREE.BoxGeometry(.055, .28, .075), p.metal, chrome, [side * .45, Math.cos(a) * .24, Math.sin(a) * .24], [a, 0, 0]);
      }
      cylinder(wheel, p.metal, chrome, [side * .465, 0, 0], .15, .095);
    }
  }

  if (style === 'sunny') {
    feature('rally-lamps', [0, 3.51, -.3]);
    for (const side of [-1, 1]) {
      rail(body, p.dark, dark, [side * .9, 2.42, -1.65], [side * .9, 3.47, -.93], .075);
      cylinder(body, p.dark, dark, [side * .56, 3.53, -.32], .22, .17, [Math.PI / 2, 0, 0]);
      cylinder(body, p.light, cream, [side * .56, 3.53, -.225], .167, .035, [Math.PI / 2, 0, 0]);
      box(body, p.paint, accent, [side * .44, 2.478, 1.4], [.21, .033, 1.02], .014);
    }
    rail(body, p.dark, dark, [-.9, 3.47, -.93], [.9, 3.47, -.93], .075);
  } else if (style === 'splash') {
    feature('bear-ears', [0, 3.62, -.4]);
    for (const side of [-1, 1]) {
      ball(body, p.paint, paint, [side * .81, 3.57, -.4], [.37, .4, .24]);
      ball(body, p.paint, accent, [side * .81, 3.6, -.195], [.23, .245, .045]);
      ball(body, p.paint, accent, [side * .27, 2.25, 2.035], [.34, .2, .13]);
      profile(body, p.paint, accent, [[-.85, 1.84], [-.5, 2.12], [-.18, 1.93], [.16, 2.11], [.38, 1.91], [.3, 1.75], [-.85, 1.7]], .035, [side * 1.261, 0, 0], .008);
    }
    ball(body, p.dark, dark, [0, 2.36, 2.17], [.17, .115, .09]);
  } else if (style === 'ember') {
    feature('flame-wing', [0, 3.06, -1.68]);
    const flame = [[-.91, 1.7], [-.63, 2.25], [-.58, 1.98], [-.16, 2.36], [-.15, 2.04], [.52, 2.25], [.16, 1.77]];
    for (const side of [-1, 1]) {
      profile(body, p.paint, accent, flame, .045, [side * 1.265, 0, 0], .013);
      box(body, p.dark, dark, [side * .8, 2.71, -1.68], [.12, .6, .21], .03);
      profile(body, p.paint, accent, [[-.63, 0], [-.5, .39], [.35, .04]], .14, [side * .83, roof + .12, -.36], .035);
    }
    box(body, p.paint, accent, [0, 3.02, -1.7], [2.49, .14, .52], .06);
  } else if (style === 'pebble') {
    feature('crawler-spare', [0, 3.38, -1.48]);
    // The spare is a simple molded ring on the back, kept inside the track envelope.
    part(body, new THREE.TorusGeometry(.45, .17, 6, 16), p.rubber, 0x182832, [0, 3.04, -1.5], [.38, 0, 0]);
    cylinder(body, p.metal, accent, [0, 3.04, -1.64], .24, .08, [Math.PI / 2 + .38, 0, 0]);
    for (const side of [-1, 1]) {
      rail(body, p.metal, chrome, [side * .83, 1.83, 2.3], [side * .83, 2.52, 2.23], .075);
      rail(body, p.dark, dark, [side * 1.29, 1.5, -.7], [side * 1.29, 1.5, .7], .09);
      profile(body, p.paint, accent, [[-.81, 1.72], [-.55, 2.11], [-.19, 2.22], [.27, 1.9], [.22, 1.72]], .03, [side * 1.266, 0, 0], .015);
    }
    rail(body, p.metal, chrome, [-.83, 2.52, 2.23], [.83, 2.52, 2.23], .075);
  } else if (style === 'bolt') {
    feature('electric-fin', [0, 3.27, -.44]);
    const lightning = [[-.63, 2.3], [-.13, 2.3], [-.36, 2.02], [.3, 2.02], [-.39, 1.61], [-.15, 1.95], [-.7, 1.95]];
    for (const side of [-1, 1]) {
      profile(body, p.paint, accent, lightning, .028, [side * 1.255, 0, 0], .006);
      profile(body, p.paint, paint, [[-1.79, 2.4], [-1.56, 3.12], [-.99, 2.41]], .15, [side * .96, 0, 0], .035);
    }
    box(body, p.paint, accent, [0, roof + .14, -.44], [.16, .1, 1.12], .025);
    box(body, p.light, accent, [0, 2.37, 2.016], [1.8, .075, .035], .02);
  } else if (digger) {
    feature('dump-tray', [0, 2.63, -1.2]); feature('front-scoop', [0, 1.6, 2.43]);
    box(body, p.dark, dark, [0, 2.4, -1.35], [1.87, .12, 1.28], .05);
    for (const side of [-1, 1]) {
      box(body, p.paint, paint, [side * 1.06, 2.67, -1.28], [.23, .65, 1.47], .07);
      for (const z of [-1.71, -1.24, -.77]) box(body, p.paint, accent, [side * 1.19, 2.67, z], [.035, .49, .11], .015);
      rail(body, p.metal, chrome, [side * .99, 1.6, 1.32], [side * .99, 1.64, 2.4], .075);
    }
    box(body, p.paint, paint, [0, 2.64, -1.98], [2.11, .64, .17], .07);
    box(body, p.paint, paint, [0, 1.46, 2.43], [2.3, .17, .47], .065, [.12, 0, 0]);
    box(body, p.paint, paint, [0, 1.65, 2.21], [2.3, .43, .15], .065, [-.21, 0, 0]);
    for (const side of [-1, 1]) profile(body, p.paint, paint, [[2.18, 1.42], [2.18, 1.85], [2.65, 1.49]], .14, [side * 1.08, 0, 0], .04);
    cylinder(body, p.dark, dark, [0, roof + .17, cabZ - .27], .2, .13, [0, 0, 0]);
    ball(body, p.light, 0xffa63d, [0, roof + .31, cabZ - .27], [.16, .2, .16]);
  }

  for (const [parent, materials] of batches) for (const [material, pieces] of materials) {
    const geometry = mergeGeometries(pieces, false);
    for (const piece of pieces) piece.dispose();
    if (!geometry) throw new Error(`Could not batch companion ${spec.id}`);
    geometry.computeBoundingSphere(); geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `${parent.name}-${material.name}`;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  }
  const truck = { spec, group, body, wheels };
  ownership.set(truck, { geometries, materials: new Set(Object.values(p)) });
  return truck;
}

/** Only release this model's resources, once; caller-attached meshes are borrowed. */
export function disposeBuddyTruck(truck) {
  const owned = ownership.get(truck);
  if (!owned) return;
  for (const geometry of owned.geometries) geometry.dispose();
  for (const material of owned.materials) material.dispose();
  ownership.delete(truck);
}
