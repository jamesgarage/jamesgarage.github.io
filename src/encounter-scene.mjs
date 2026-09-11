import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CRUSH_CARS, TURBO_PADS } from './encounters.mjs';
import { sampleTrack, laneOffset } from './track.mjs';

const PAD_LIFT = .065;
const CAR_LIFT = .035;
const SQUASH_SECONDS = .32;
const WHEEL_SIDES = [-1, 1, -1, 1];
const WHEEL_STATIONS = [-1.04, -1.04, 1.04, 1.04];

function merged(parts) {
  const expanded = parts.map(part => {
    part.deleteAttribute('uv');
    if (!part.index) return part;
    const result = part.toNonIndexed(); part.dispose(); return result;
  });
  const geometry = mergeGeometries(expanded);
  expanded.forEach(part => part.dispose());
  if (!geometry) throw new Error('Could not batch the toy-car geometry');
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

function colored(geometry, hex) {
  const color = new THREE.Color(hex), values = new Float32Array(geometry.attributes.position.count * 3);
  for (let offset = 0; offset < values.length; offset += 3) color.toArray(values, offset);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

function block(size, position, color) {
  const geometry = new THREE.BoxGeometry(...size).translate(...position);
  return color === undefined ? geometry : colored(geometry, color);
}

function quad(a, b, c, d) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  geometry.computeVertexNormals(); return geometry;
}

function toyGeometry() {
  // A rounded die-cast shell, sloping coupe roof and opaque glazing make these
  // unmistakable little unoccupied toys beside the much larger monster trucks.
  const profile = new THREE.Shape();
  profile.moveTo(-.96, .60); profile.lineTo(-.60, 1.05);
  profile.lineTo(.27, 1.05); profile.lineTo(.82, .60); profile.closePath();
  const cabin = new THREE.ExtrudeGeometry(profile, {
    depth: 1.36, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 1, steps: 1,
  }).rotateY(-Math.PI / 2).translate(.68, 0, 0);
  const paint = merged([
    new RoundedBoxGeometry(1.86, .44, 3.02, 2, .12).translate(0, .47, 0),
    cabin,
  ]);
  const windows = [
    // Clear the beveled shell as well as the underlying un-beveled profile.
    quad([-.61, .70, .745], [.61, .70, .745], [.61, .99, .409], [-.61, .99, .409]),
    quad([.61, .70, -.927], [-.61, .70, -.927], [-.61, .99, -.705], [.61, .99, -.705]),
  ];
  for (const side of [-1, 1]) {
    const x = side * .719;
    windows.push(quad([x, .68, -.82], [x, .97, -.53], [x, .97, -.22], [x, .68, -.22]));
    windows.push(quad([x, .68, -.13], [x, .97, -.13], [x, .97, .22], [x, .68, .66]));
  }
  const trim = [
    block([1.77, .17, .17], [0, .36, 1.565], 0xd9e8df),
    block([1.77, .17, .17], [0, .36, -1.565], 0xd9e8df),
    block([.78, .17, .025], [0, .53, 1.516], 0x184054),
    block([.41, .105, .03], [0, .345, -1.66], 0x184054),
  ];
  for (const side of [-1, 1]) {
    trim.push(block([.28, .16, .035], [side * .66, .56, 1.514], 0xffecac));
    trim.push(block([.29, .13, .035], [side * .66, .55, -1.514], 0xf06462));
    trim.push(block([.16, .014, .52], [side * .29, .697, 1.08], 0xfff1ce));
    trim.push(block([.16, .014, .68], [side * .29, 1.092, -.14], 0xfff1ce));
    trim.push(block([.024, .07, .2], [side * .933, .56, -.20], 0xd9e8df));
  }
  const tire = new THREE.CylinderGeometry(.30, .30, .24, 14).rotateZ(Math.PI / 2);
  const wheelParts = [colored(tire, 0x223844)];
  for (const side of [-1, 1]) {
    wheelParts.push(colored(new THREE.CylinderGeometry(.185, .185, .014, 12).rotateZ(Math.PI / 2).translate(side * .125, 0, 0), 0xe0e9e1));
    wheelParts.push(colored(new THREE.CylinderGeometry(.085, .085, .018, 8).rotateZ(Math.PI / 2).translate(side * .139, 0, 0), 0x2a697c));
  }
  return { paint, windows: merged(windows), trim: merged(trim), wheel: merged(wheelParts) };
}

function padGeometry(definition) {
  const base = { positions: [], indices: [], samples: [] }, arrows = { positions: [], indices: [], samples: [] };
  const point = new THREE.Vector3();
  function vertex(target, distance, lateral, lift) {
    const frame = sampleTrack(distance);
    point.copy(frame.position).addScaledVector(frame.right, lateral).addScaledVector(frame.up, lift);
    target.positions.push(point.x, point.y, point.z);
    target.samples.push(distance, lateral, lift);
  }
  function ribbon(target, start, end, left, right, lift) {
    const steps = Math.ceil(end - start), offset = target.positions.length / 3;
    for (let step = 0; step <= steps; step++) {
      const distance = THREE.MathUtils.lerp(start, end, step / steps);
      vertex(target, distance, left, lift); vertex(target, distance, right, lift);
      if (step < steps) {
        const a = offset + step * 2;
        target.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  function wing(center, side) {
    const steps = 14, offset = arrows.positions.length / 3;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      // The arrow point faces local +Z, the direction of race travel.
      const lateral = side * t * 5.7, distance = center + 1.6 - t * 2.6;
      vertex(arrows, distance - .35, lateral, PAD_LIFT + .01);
      vertex(arrows, distance + .35, lateral, PAD_LIFT + .01);
      if (step < steps) {
        const a = offset + step * 2;
        arrows.indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  const start = definition.distance - definition.length / 2, end = definition.distance + definition.length / 2;
  ribbon(base, start, end, -7.3, 7.3, PAD_LIFT);
  ribbon(arrows, start + .2, end - .2, -7.08, -6.84, PAD_LIFT + .01);
  ribbon(arrows, start + .2, end - .2, 6.84, 7.08, PAD_LIFT + .01);
  for (const offset of [-3.7, 0, 3.7]) for (const side of [-1, 1]) wing(definition.distance + offset, side);
  function finish(data) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setIndex(data.indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    geometry.userData.trackSamples = data.samples;
    return geometry;
  }
  return { base: finish(base), arrows: finish(arrows) };
}

/** Visual toy encounters. The simulation alone decides contact, rewards and turbo. */
export class RoadEncounters {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'road-encounters';
    this.geometries = new Set(); this.materials = new Set();
    const geometry = toyGeometry();
    for (const value of Object.values(geometry)) this.geometries.add(value);
    const ownMaterial = options => {
      const material = new THREE.MeshStandardMaterial(options); this.materials.add(material); return material;
    };
    const glass = ownMaterial({ color: 0x163d50, roughness: .27, metalness: .1, side: THREE.DoubleSide });
    const detail = ownMaterial({ vertexColors: true, roughness: .5 });
    const rubber = ownMaterial({ vertexColors: true, roughness: .85 });
    this.cars = CRUSH_CARS.map(definition => {
      const group = new THREE.Group(); group.name = definition.id;
      const body = new THREE.Group(); body.name = `${definition.id}-squashable-body`;
      const paint = new THREE.Mesh(geometry.paint, ownMaterial({ color: definition.color, roughness: .38, metalness: .08 }));
      const windows = new THREE.Mesh(geometry.windows, glass), trim = new THREE.Mesh(geometry.trim, detail);
      paint.castShadow = true; paint.receiveShadow = true; windows.receiveShadow = true; trim.receiveShadow = true;
      body.add(paint, windows, trim);
      const wheels = Array.from({ length: 4 }, () => new THREE.Object3D());
      const wheelMesh = new THREE.InstancedMesh(geometry.wheel, rubber, 4);
      wheelMesh.name = `${definition.id}-splaying-wheels`;
      wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // The fixed sphere includes the squashed, outward-splayed wheel positions.
      wheelMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .3, 0), 2);
      wheelMesh.castShadow = true; wheelMesh.receiveShadow = true;
      group.add(body, wheelMesh);
      const frame = sampleTrack(definition.distance);
      group.position.copy(frame.position).addScaledVector(frame.right, laneOffset(definition.lane)).addScaledVector(frame.up, CAR_LIFT);
      group.quaternion.copy(frame.quaternion);
      this.group.add(group);
      return { id: definition.id, group, body, paint, wheels, wheelMesh, crush: 0 };
    });
    const padPaint = ownMaterial({ color: 0x20aaba, roughness: .45, side: THREE.DoubleSide,
      emissive: 0x0d5557, emissiveIntensity: .14, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const arrowPaint = ownMaterial({ color: 0xffe4a1, roughness: .55, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.pads = TURBO_PADS.map(definition => {
      const shapes = padGeometry(definition), group = new THREE.Group(); group.name = definition.id;
      this.geometries.add(shapes.base); this.geometries.add(shapes.arrows);
      const base = new THREE.Mesh(shapes.base, padPaint), arrows = new THREE.Mesh(shapes.arrows, arrowPaint);
      base.name = `${definition.id}-turbo-surface`; arrows.name = `${definition.id}-forward-chevrons`;
      base.receiveShadow = true; arrows.receiveShadow = true;
      group.add(base, arrows); this.group.add(group);
      return { id: definition.id, distance: definition.distance, group, base, arrows };
    });
    scene.add(this.group); this.disposed = false; this.reset();
  }

  pose(car) {
    const squash = 1 - (1 - car.crush) ** 3;
    car.body.scale.set(1 + squash * .10, 1 - squash * .76, 1 + squash * .035);
    for (let index = 0; index < car.wheels.length; index++) {
      const wheel = car.wheels[index], side = WHEEL_SIDES[index];
      wheel.position.set(side * (.95 + squash * .29), .30 - squash * .16, WHEEL_STATIONS[index] * (1 + squash * .04));
      wheel.rotation.set(0, 0, side * squash * Math.PI / 2);
      wheel.updateMatrix(); car.wheelMesh.setMatrixAt(index, wheel.matrix);
    }
    car.wheelMesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    if (this.disposed) return;
    this.group.visible = false;
    for (const car of this.cars) { car.crush = 0; this.pose(car); }
  }

  update(dt, { race, mode, reducedMotion }) {
    if (this.disposed) return;
    if (mode !== 'race') { if (this.group.visible) this.reset(); return; }
    // Respect pause before flags or accessibility changes can alter a transform.
    if (race.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
    this.group.visible = true;
    for (const car of this.cars) {
      if (car.crush >= 1 || !race.crushedCars?.includes(car.id)) continue;
      car.crush = reducedMotion ? 1 : Math.min(1, car.crush + Math.min(dt, .1) / SQUASH_SECONDS);
      this.pose(car);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.group.visible = false; this.group.removeFromParent();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const car of this.cars) car.wheelMesh.dispose();
    this.disposed = true;
  }
}
