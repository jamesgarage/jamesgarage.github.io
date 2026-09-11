import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const ownership = new WeakMap();

/** Each truck owns its materials and final geometry, so garage swaps cannot
 * invalidate another truck. Static parts are batched within animated parents. */
export function makeTruck(spec) {
  const group = new THREE.Group(); group.name = `truck-${spec.id}`;
  group.scale.setScalar(spec.scale);
  const body = new THREE.Group(); body.name = 'sprung-body'; group.add(body);
  const character = new THREE.Group(); character.name = `character-${spec.id}`; body.add(character);
  const wheels = [], arms = [], struts = [];
  const metal = spec.id === 'chrome-guardian';
  const palette = {
    paint: new THREE.MeshPhysicalMaterial({ color: spec.color, metalness: metal ? .76 : .05, roughness: metal ? .2 : .28, clearcoat: 1, clearcoatRoughness: .12 }),
    accent: new THREE.MeshPhysicalMaterial({ color: spec.accent, metalness: metal ? .45 : .08, roughness: .34, clearcoat: .72, clearcoatRoughness: .18 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x101b23, roughness: .96 }),
    tread: new THREE.MeshStandardMaterial({ color: 0x263a46, roughness: .88 }),
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xd7e5e8, metalness: .88, roughness: .17, clearcoat: .35, clearcoatRoughness: .1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b303c, metalness: .32, roughness: .5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0d4a6a, metalness: 0, roughness: .08, clearcoat: 1, clearcoatRoughness: .04 }),
    light: new THREE.MeshPhysicalMaterial({ color: 0xfff5cf, emissive: 0xffdf7c, emissiveIntensity: .34, roughness: .2, clearcoat: .65 }),
    glow: new THREE.MeshPhysicalMaterial({ color: 0xa9fff7, emissive: 0x4de0dc, emissiveIntensity: .38, roughness: .18, clearcoat: .7 }),
  };
  for (const [name, material] of Object.entries(palette)) material.name = `${spec.id}-${name}`;

  const parts = new Map();
  function part(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    // Nonindexed geometry allows rounded, extruded, and lathed surfaces to share a batch.
    if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); geometry = expanded; }
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)));
    if (!parts.has(parent)) parts.set(parent, new Map());
    const batches = parts.get(parent);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);
  }
  function box(parent, material, position, size, radius = .08, rotation = [0, 0, 0], segments = 1) {
    part(parent, new RoundedBoxGeometry(...size, segments, Math.min(radius, ...size.map(v => v * .45))), material, position, rotation);
  }
  function ball(parent, material, position, size) {
    part(parent, new THREE.SphereGeometry(1, 16, 10), material, position, [0, 0, 0], size);
  }
  function cylinder(parent, material, position, radius, length, rotation = [0, 0, Math.PI / 2], topRadius = radius) {
    part(parent, new THREE.CylinderGeometry(topRadius, radius, length, 20), material, position, rotation);
  }
  function tube(parent, material, points, radius, segments = 24) {
    part(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false), material);
  }
  function prism(parent, material, outline, width, position = [0, 0, 0], bevel = .08) {
    const shape = new THREE.Shape();
    outline.forEach(([z, y], i) => i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, steps: 1, curveSegments: 8 });
    geometry.translate(0, 0, -width / 2); geometry.rotateY(Math.PI / 2);
    part(parent, geometry, material, position);
  }
  function anchor(name, position) {
    const marker = new THREE.Object3D(); marker.name = name; marker.position.set(...position); body.add(marker);
  }
  const p = palette;
  const titan = spec.id === 'mega-titan';
  const gator = spec.id === 'gator-claw';
  const night = spec.id === 'night-stomper';
  const width = titan ? 2.85 : 2.58;
  box(body, p.dark, [0, 1.48, 0], [2.45, .32, 4.35], .12, [0, 0, 0], 2);
  box(body, p.paint, [0, 2.0, -.05], [width, .92, 4.15], .28, [0, 0, 0], 2);
  // A separate softly crowned hood catches a broad highlight instead of reading
  // as one tall slab. It stays inside the original body envelope.
  box(body, p.paint, [0, 2.43, 1.43], [width - .1, .35, gator ? 1.78 : 1.42], .17, [0, 0, 0], 2);
  // The cab is a sloped, beveled shell rather than stacked cubes.
  const roofY = night ? 3.24 : titan ? 3.5 : 3.4;
  const cabWidth = titan ? 2.4 : 2.16, cabBevel = metal ? .06 : .13;
  prism(body, p.paint, [[-1.22, 2.34], [-1.07, roofY - .08], [-.65, roofY], [.28, roofY], [.95, 2.46]], cabWidth, [0, 0, 0], cabBevel);
  box(body, p.accent, [0, roofY + .07, -.39], [titan ? 2.65 : 2.29, .14, 1.46], .065, [0, 0, 0], 2);
  // Dark inset glass with a bright pair of friendly eyes on the windshield.
  box(body, p.dark, [0, roofY - .38, .68], [2.04, .77, .11], .09, [-.58, 0, 0], 2);
  box(body, p.glass, [0, roofY - .38, .744], [1.83, .59, .075], .075, [-.58, 0, 0], 2);
  box(body, p.dark, [0, roofY - .37, -1.3], [1.88, .57, .095], .07, [.15, 0, 0]);
  box(body, p.glass, [0, roofY - .37, -1.36], [1.66, .4, .035], .05, [.15, 0, 0]);
  box(body, p.chrome, [0, roofY - .38, -1.39], [.055, .37, .025], .01, [.15, 0, 0]);
  for (const side of [-1, 1]) {
    box(body, p.glow, [side * .44, roofY - .32, .81], [.43, .23, .055], .07, [-.58, 0, 0]);
    prism(body, p.glass, [[-.97, 2.74], [-.85, roofY - .15], [.18, roofY - .15], [.56, 2.74]], .035, [side * (cabWidth / 2 + cabBevel + .014), 0, 0], .018);
    box(body, p.chrome, [side * (cabWidth / 2 + cabBevel + .018), 2.59, -.55], [.06, .065, .29], .026);
    box(body, p.dark, [side * 1.36, 2.76, .43], [.35, .16, .24], .07);
    box(body, p.paint, [side * 1.46, 2.79, .49], [.26, .27, .4], .09);
    box(body, p.glass, [side * 1.47, 2.8, .3], [.19, .19, .04], .03);
    box(body, p.chrome, [side * (cabWidth / 2 + cabBevel + .032), 2.83, -.64], [.035, .055, .31], .018);
    part(body, new THREE.TorusGeometry(.13, .026, 8, 20), p.dark, [side * (width / 2 + .035), 2.13, -.82], [0, Math.PI / 2, 0]);
    box(body, p.accent, [side * (width / 2 + .025), 2.03, -.18], [.06, .18, 1.2], .04);
    box(body, p.dark, [side * 1.38, 1.48, -.12], [.48, .12, 1.13], .05);
    for (let j = 0; j < 4; j++) box(body, p.chrome, [side * 1.4, 1.56, -.52 + j * .27], [.35, .035, .08], .012);
    // Thick molded arches cover the tire tops without filling the wheel wells.
    for (const z of [-1.5, 1.5]) {
      const arch = new THREE.TorusGeometry(1.02, .13, 8, 24, Math.PI);
      part(body, arch, p.paint, [side * 1.32, 1.1, z], [0, Math.PI / 2, 0]);
      const lip = new THREE.TorusGeometry(1.08, .065, 6, 24, Math.PI);
      part(body, lip, p.dark, [side * 1.49, 1.1, z], [0, Math.PI / 2, 0]);
    }
    box(body, p.light, [side * .94, 2.25, 2.123], [.46, .32, .1], .1);
    box(body, p.accent, [side * .99, 2.02, -2.18], [.41, .23, .085], .05);
    tube(body, p.chrome, [[side * 1.05, 2.02, -1.75], [side * 1.05, 2.83, -1.75], [side * 1.05, 3.09, -1.93], [side * 1.05, 3.09, -2.16]], .15, 14);
    cylinder(body, p.dark, [side * 1.05, 3.09, -2.163], .115, .015, [Math.PI / 2, 0, 0]);
    anchor(`exhaust-outlet-${side}`, [side * 1.05, 3.09, -2.16]);
  }
  box(body, p.dark, [0, 1.83, 2.2], [2.92, .35, .43], .14);
  box(body, p.chrome, [0, 1.87, 2.43], [2.28, .17, .12], .07, [0, 0, 0], 2);
  for (const side of [-1, 1]) cylinder(body, p.chrome, [side * 1.35, 1.83, 2.2], .175, .18, [0, 0, 0]);
  box(body, p.dark, [0, 2.2, 2.14], [1.15, .4, .12], .08);
  for (let j = -2; j <= 2; j++) box(body, p.chrome, [j * .2, 2.2, 2.217], [.075, .27, .035], .015);
  box(body, p.dark, [0, 1.79, -2.26], [2.78, .29, .32], .1);
  box(body, p.dark, [0, 2.12, -2.153], [1.27, .32, .075], .055);
  for (let j = -2; j <= 2; j++) box(body, p.chrome, [j * .2, 2.12, -2.205], [.08, .2, .035], .015);
  box(body, p.accent, [0, 1.8, -2.435], [.69, .17, .045], .025);
  for (const side of [-1, 1]) {
    part(body, new THREE.TorusGeometry(.125, .035, 6, 12), p.accent, [side * .78, 1.74, 2.46]);
    box(body, p.accent, [side * .46, 2.619, 1.46], [.15, .04, .9], .018);
  }

  // Real tire cross section: recessed bead, rounded sidewall, broad crown.
  const profile = [[.46, -.36], [.54, -.415], [.67, -.447], [.82, -.445], [.94, -.385], [1.025, -.275], [1.067, -.13], [1.075, 0], [1.067, .13], [1.025, .275], [.94, .385], [.82, .445], [.67, .447], [.54, .415], [.46, .36], [.46, -.36]];
  for (const z of [-1.5, 1.5]) {
    cylinder(group, p.chrome, [0, 1.05, z], .1, 3.35);
    ball(group, p.dark, [0, 1.05, z], [.4, .27, .29]);
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group(); wheel.name = `wheel-${z < 0 ? 'rear' : 'front'}-${side}`;
      wheel.position.set(side * 1.65, 1.05, z); group.add(wheel); wheels.push(wheel);
      part(wheel, new THREE.LatheGeometry(profile.map(v => new THREE.Vector2(...v)), 36), p.rubber, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (let j = 0; j < 16; j++) for (const row of [-1, 1]) {
        const angle = j / 16 * TAU + (row > 0 ? .07 : 0);
        box(wheel, p.tread, [row * .215, Math.cos(angle) * 1.055, Math.sin(angle) * 1.055], [.43, .16, .29], .045, [angle, row * .42, 0]);
      }
      cylinder(wheel, p.dark, [side * .403, 0, 0], .625, .07);
      part(wheel, new THREE.TorusGeometry(.79, .025, 6, 28), p.tread, [side * .446, 0, 0], [0, Math.PI / 2, 0]);
      part(wheel, new THREE.TorusGeometry(.55, .065, 8, 24), p.chrome, [side * .46, 0, 0], [0, Math.PI / 2, 0]);
      cylinder(wheel, p.accent, [side * .467, 0, 0], .45, .065);
      for (let j = 0; j < 6; j++) {
        const a = j / 6 * TAU;
        box(wheel, p.dark, [side * .505, Math.cos(a) * .315, Math.sin(a) * .315], [.025, .18, .1], .027, [a, 0, 0]);
        cylinder(wheel, p.chrome, [side * .533, Math.cos(a) * .205, Math.sin(a) * .205], .038, .04);
      }
      cylinder(wheel, p.chrome, [side * .526, 0, 0], .165, .13);
      for (let j = 0; j < 12; j++) {
        const a = j / 12 * TAU;
        box(wheel, p.tread, [side * .433, Math.cos(a) * .785, Math.sin(a) * .785], [.033, .17, .047], .015, [a, 0, 0]);
      }
      tube(group, p.dark, [[side * .42, 1.35, z - .32], [side * .92, .84, z], [side * 1.43, 1.05, z]], .085, 6);
      cylinder(group, p.chrome, [side * 1.03, 1.51, z], .065, .85, [0, 0, side * -.3]);
      const coil = [];
      for (let j = 0; j <= 64; j++) { const t = j / 64; coil.push([side * 1.03 + Math.cos(t * TAU * 5) * .14, 1.2 + t * .63, z + Math.sin(t * TAU * 5) * .14]); }
      tube(group, p.accent, coil, .037, 64);
    }
  }

  // Guardian parts retain their independent articulation pivots.
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = `guardian-arm-${side}`; arm.position.set(side * 1.5, 2.45, 0); arm.visible = false; body.add(arm); arms.push(arm);
    ball(arm, p.chrome, [side * .06, -.11, 0], [.3, .3, .3]);
    box(arm, p.paint, [side * .17, -.46, 0], [.62, .86, .77], .18);
    cylinder(arm, p.dark, [side * .2, -.83, 0], .23, .58);
    box(arm, p.accent, [side * .18, -1.12, .06], [.71, .51, .88], .15);
    for (let j = 0; j < 3; j++) box(arm, p.chrome, [side * .19 + (j - 1) * .18, -1.13, .51], [.12, .26, .09], .035);
    const strut = new THREE.Group(); strut.name = `guardian-leg-${side}`; strut.position.set(side * .85, 1.9, 0); strut.visible = false; group.add(strut); struts.push(strut);
    box(strut, p.dark, [0, 0, 0], [.44, 1.2, .54], .08);
    cylinder(strut, p.chrome, [0, 0, .29], .09, 1.05, [0, 0, 0]);
    box(strut, p.accent, [0, -.24, .4], [.49, .31, .16], .05);
  }
  const head = new THREE.Group(); head.name = 'guardian-head'; head.position.set(0, 3.4, -.3); head.visible = false; body.add(head);
  box(head, p.paint, [0, .48, 0], [1.16, 1.01, .95], .22, [0, 0, 0], 2);
  box(head, p.dark, [0, .55, .47], [.91, .35, .1], .07);
  box(head, p.glow, [0, .57, .532], [.75, .15, .055], .045);
  box(head, p.chrome, [0, .15, .48], [.61, .26, .12], .075);
  box(head, p.dark, [0, .47, -.475], [.73, .55, .06], .065);
  for (const x of [-.21, 0, .21]) box(head, p.accent, [x, .47, -.52], [.075, .35, .04], .025);
  for (const side of [-1, 1]) cylinder(head, p.accent, [side * .61, .48, 0], .2, .16);

  if (spec.id === 'rumbler') {
    character.userData.description = 'Orange rally pickup with roof lamps, roll cage and hood scoop';
    box(character, p.dark, [0, 2.7, 1.47], [.76, .25, .73], .07);
    box(character, p.chrome, [0, 2.73, 1.85], [.59, .12, .06], .035);
    tube(character, p.dark, [[-1.04, 2.45, -1.3], [-1.04, 3.52, -.95], [1.04, 3.52, -.95], [1.04, 2.45, -1.3]], .085, 16);
    for (const x of [-.74, -.25, .25, .74]) {
      cylinder(character, p.dark, [x, 3.57, -.73], .18, .19, [Math.PI / 2, 0, 0]);
      cylinder(character, p.light, [x, 3.57, -.62], .135, .03, [Math.PI / 2, 0, 0]);
    }
  } else if (spec.id === 'bear-crusher') {
    character.userData.description = 'Rounded bear ears, honey muzzle, paw-print doors';
    for (const side of [-1, 1]) {
      ball(character, p.paint, [side * .9, 3.66, -.38], [.44, .48, .26]);
      ball(character, p.accent, [side * .9, 3.67, -.16], [.26, .3, .07]);
      ball(character, p.accent, [side * .31, 2.37, 2.22], [.42, .26, .17]);
      ball(character, p.accent, [side * 1.34, 2.08, -.2], [.06, .18, .19]);
      for (let j = 0; j < 3; j++) ball(character, p.accent, [side * 1.345, 2.31, -.4 + j * .19], [.055, .085, .075]);
    }
    ball(character, p.dark, [0, 2.5, 2.36], [.22, .15, .11]);
  } else if (night) {
    character.userData.description = 'Low street-monster roof, original curling neon flames and wing';
    const flame = new THREE.Shape(); flame.moveTo(-.9, -.16); flame.bezierCurveTo(-.2, -.4, .56, -.2, 1.06, .3); flame.bezierCurveTo(.6, .08, .5, .1, .34, .46); flame.bezierCurveTo(.2, .15, -.03, .05, -.14, .16); flame.bezierCurveTo(-.23, .2, -.16, .5, -.33, .62); flame.bezierCurveTo(-.25, .13, -.76, .3, -.9, -.16);
    for (const side of [-1, 1]) {
      const geo = new THREE.ExtrudeGeometry(flame, { depth: .025, bevelEnabled: false, curveSegments: 10 });
      part(character, geo, p.accent, [side * 1.325, 2.03, -.35], [0, side * Math.PI / 2, 0]);
      box(character, p.dark, [side * .84, 2.81, -1.58], [.13, .7, .22], .04);
    }
    box(character, p.accent, [0, 3.12, -1.75], [2.9, .15, .59], .06);
    box(character, p.accent, [0, 1.68, 2.4], [2.31, .065, .11], .025);
  } else if (gator) {
    character.userData.description = 'Long rounded snout, raised nostrils, dorsal scales and friendly tooth bumper';
    box(character, p.paint, [0, 2.27, 2.18], [2.43, .49, .72], .18);
    for (const side of [-1, 1]) ball(character, p.dark, [side * .77, 2.5, 2.36], [.12, .055, .13]);
    for (let j = 0; j < 5; j++) prism(character, p.accent, [[-.21, 0], [0, .42], [.21, 0]], .27, [0, 3.48, -1.07 + j * .33], .035);
    for (let j = -2; j <= 2; j++) {
      part(character, new THREE.ConeGeometry(.13, .31, 10), p.light, [j * .45, 1.99, 2.52], [Math.PI, 0, 0]);
    }
    for (const side of [-1, 1]) for (let j = 0; j < 3; j++) ball(character, p.accent, [side * 1.31, 2.28, -.91 + j * .34], [.08, .12, .18]);
  } else if (metal) {
    character.userData.description = 'Faceted silver rescue armor, swept fins and turquoise shield';
    for (const side of [-1, 1]) {
      prism(character, p.paint, [[-1.45, 2.3], [-1.06, 3.22], [.37, 2.64], [.7, 2.3]], .34, [side * 1.32, 0, 0], .045);
      box(character, p.accent, [side * 1.53, 2.68, -.47], [.055, .16, 1.21], .03, [.22, 0, 0]);
    }
    prism(character, p.accent, [[-.37, 0], [0, .44], [.37, 0], [0, -.18]], .54, [0, 2.72, 1.4], .025);
    box(character, p.accent, [0, roofY + .12, -.38], [.16, .12, 1.23], .04);
  } else if (titan) {
    character.userData.description = 'Broad armored cab, crowned roof, reinforced shoulders and rear aerofoil';
    for (const side of [-1, 1]) {
      box(character, p.accent, [side * 1.34, 2.7, -.48], [.58, .52, 1.99], .15);
      for (let j = 0; j < 3; j++) box(character, p.chrome, [side * 1.65, 2.72, -.99 + j * .45], [.07, .27, .16], .035, [.15, 0, 0]);
      box(character, p.dark, [side * .91, 2.56, -1.74], [.17, .5, .25], .05);
    }
    box(character, p.accent, [0, 2.84, -2.05], [3.24, .24, .68], .09);
    for (const x of [-.7, 0, .7]) prism(character, p.accent, [[-.24, 0], [-.1, .43], [.25, .11], [.25, 0]], .29, [x, 3.62, -.3], .045);
    box(character, p.chrome, [0, 2.62, 1.64], [1.35, .12, .56], .05);
    box(character, p.accent, [0, 1.79, 2.49], [1.58, .27, .17], .05);
  }

  const ownedGeometry = new Set();
  for (const [parent, batches] of parts) for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false);
    for (const partGeometry of geometries) partGeometry.dispose();
    if (!geometry) throw new Error(`Could not batch ${spec.id} ${parent.name}`);
    geometry.computeBoundingSphere(); ownedGeometry.add(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `${parent.name}-${material.name}`;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  }
  const truck = { group, body, wheels, arms, head, struts, spec };
  ownership.set(truck, { geometries: ownedGeometry, materials: new Set(Object.values(palette)) });
  return truck;
}

/** Idempotent; only releases resources created by makeTruck for this instance. */
export function disposeTruck(truck) {
  const owned = ownership.get(truck);
  if (!owned) return;
  for (const geometry of owned.geometries) geometry.dispose();
  for (const material of owned.materials) material.dispose();
  ownership.delete(truck);
}
