import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeTruck, disposeTruck } from '../src/models.mjs';
import { DRIVE_HALF_WIDTH, createWorld } from '../src/world.mjs';
import { TRUCKS, LOOP_START, LOOP_END } from '../src/core.mjs';
import { sampleTrack } from '../src/track.mjs';

test('every fully transformed truck clears both rails at the outer driving lanes', () => {
  for (const spec of TRUCKS) {
    const truck = makeTruck(spec);
    truck.body.position.y = 1.8;
    truck.head.visible = true;
    truck.arms.forEach((arm, i) => { arm.visible = true; arm.rotation.z = (i === 0 ? -1 : 1) * .85; });
    truck.struts.forEach(leg => { leg.visible = true; leg.scale.y = 3.1; leg.position.y = 2.5; });
    truck.wheels.forEach((wheel, i) => { wheel.position.x = (i % 2 === 0 ? -1 : 1) * 2.35; });
    for (const lane of [-1, 1]) {
      truck.group.position.x = lane * 3.4;
      const bounds = new THREE.Box3().setFromObject(truck.group, true);
      assert.ok(bounds.min.x > -DRIVE_HALF_WIDTH && bounds.max.x < DRIVE_HALF_WIDTH, `${spec.name} should clear both rails in lane ${lane}`);
    }
    disposeTruck(truck);
  }
});

test('the complete world builds finite geometry within its static scene budget', () => {
  const world = createWorld();
  let meshes = 0, vertices = 0;
  world.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    vertices += object.geometry.attributes.position.count;
    assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
    assert.ok(object.geometry.attributes.normal.array.every(Number.isFinite));
  });
  assert.ok(world.getObjectByName('molded-orange-skyway'));
  assert.ok(world.getObjectByName('rolling-landscape'));
  assert.ok(world.getObjectByName('gator-lagoon'));
  assert.ok(meshes < 650, `Static mesh budget exceeded: ${meshes}`);
  assert.ok(vertices < 1_200_000, `Static vertex budget exceeded: ${vertices}`);
});

test('rounded forest crowns have continuous shading and leave the real road clear', () => {
  const world = createWorld(), centers = [];
  for (let distance = -70; distance <= 2080; distance += .5) centers.push(sampleTrack(distance).position);
  let crowns = 0, checked = 0;
  world.traverse(mesh => {
    if (!mesh.isMesh || !(mesh.userData.canopy || mesh.userData.frond)) return;
    crowns++;
    if (mesh.userData.canopy) assert.ok(mesh.material.vertexColors, 'Canopies retain softer underside shading after batching');
    const { position, normal, color } = mesh.geometry.attributes;
    if (color) assert.equal(position.count, color.count);
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    const nearby = centers.filter(point => point.z > bounds.min.z - 15 && point.z < bounds.max.z + 15);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      const nearest = Math.min(...nearby.map(point => Math.hypot(x - point.x, z - point.z)));
      assert.ok(nearest >= 12, `Organic crown enters the driving corridor at ${x}, ${z}: ${nearest}`);
      assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < .0001, 'Welded crown normals remain unit length');
      if (color) assert.ok(color.getX(i) >= .81 && color.getX(i) <= 1.01);
      checked++;
    }
  });
  assert.ok(crowns > 10 && checked > 15000, 'Near and distant forest crowns are checked after batching');
});

test('clouds and horizon details remain spatially cullable instead of course-wide batches', () => {
  const world = createWorld();
  const clouds = world.children.filter(child => child.name.startsWith('soft-clouds-'));
  const hills = world.children.filter(child => child.name.startsWith('distant-hills-'));
  assert.equal(clouds.length, 7); assert.equal(hills.length, 7);
  for (const group of [...clouds, ...hills]) {
    const bounds = new THREE.Box3().setFromObject(group);
    assert.ok(bounds.max.z - bounds.min.z < 310, `${group.name} can be culled independently of the full course`);
    group.traverse(mesh => { if (mesh.isMesh) assert.ok(mesh.frustumCulled); });
  }
  assert.ok(world.getObjectByName('starting-friends'), 'Large starting mascots no longer force submission from every venue');
});

// Inspect the actual batched vertices, so misplaced trim, braces or labels cannot
// pass by leaving a clearance constant unchanged.
function geometryBounds(object, transform = new THREE.Matrix4()) {
  const bounds = new THREE.Box3();
  object.updateMatrixWorld(true);
  object.traverse(mesh => {
    if (!mesh.isMesh) return;
    const matrix = transform.clone().multiply(mesh.matrixWorld);
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix));
  });
  return bounds;
}
function framePoint(frame, x, y, z) {
  return frame.position.clone().addScaledVector(frame.right, x).addScaledVector(frame.up, y).addScaledVector(frame.forward, z);
}

test('complete loop towers and overhead clear the sampled road and guardian corridor', () => {
  const world = createWorld();
  const entry = geometryBounds(world.getObjectByName('loop-support-rear-entry'));
  const exit = geometryBounds(world.getObjectByName('loop-support-rear-exit'));
  const beam = geometryBounds(world.getObjectByName('loop-support-overhead'));
  assert.ok(entry.max.x < -11 && exit.max.x < -11, 'every tower brace, cap and foundation stays behind the approach/exit');
  const baseZ = sampleTrack(LOOP_START).position.z;
  assert.ok(entry.max.z < baseZ - 34 && exit.min.z > baseZ + 34, 'rear towers flank the ring beyond its projected edges');
  assert.ok(beam.min.y >= 60.5, 'the complete beam clears the loop crown');
  const swept = new THREE.Box3();
  for (let d = LOOP_START - 40; d <= LOOP_END + 40; d += .1) {
    const f = sampleTrack(d);
    for (const [width, low, high, length] of [[8.5, -.65, .64, 0], [7.9, -.2, 10.2, 7.2]]) {
      for (const x of [-width, width]) for (const y of [low, high]) for (const z of [-length, length]) swept.expandByPoint(framePoint(f, x, y, z));
    }
  }
  assert.ok(swept.min.x - entry.max.x > 1.3 && swept.min.x - exit.max.x > 1.3);
  assert.ok(beam.min.y - swept.max.y > 1.3, 'beam clears the longitudinal guardian envelope, not just track centers');
  assert.ok(entry.max.y >= beam.min.y && exit.max.y >= beam.min.y, 'both rear towers reach the overhead beam');
  const spine = geometryBounds(world.getObjectByName('loop-support-spine'));
  const arms = geometryBounds(world.getObjectByName('loop-support-arms'));
  assert.ok(spine.intersectsBox(entry) && spine.intersectsBox(exit), 'longitudinal spine connects both towers');
  assert.ok(arms.intersectsBox(spine), 'cantilever arms connect to the rear spine');
  const crown = sampleTrack((LOOP_START + LOOP_END) / 2);
  const links = geometryBounds(world.getObjectByName('loop-support-connections'));
  assert.ok(links.min.y >= crown.position.y + .64 && links.max.y >= beam.min.y, 'short connectors join the exterior underside to the beam');
  assert.ok(links.max.y - links.min.y < 3, 'attachments stay at the inverted crown');
  assert.ok(arms.min.x < links.min.x && arms.max.x >= links.max.x && arms.min.z <= links.min.z && arms.max.z >= links.max.z, 'cantilever arms reach both gold attachment tops');
  assert.ok(links.min.x > crown.position.x - 8.5 && links.max.x < crown.position.x + 8.5);
});

test('both gate faces and all overhead trim clear a pitched guardian at maximum jump height', () => {
  // A minimal canvas surface exercises the browser-only label geometry in Node.
  const oldDocument = globalThis.document;
  const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  let world;
  try { world = createWorld(); } finally {
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  }
  for (const label of ['start', 'sky-loop', 'gator-bay', 'finish']) {
    const gate = world.getObjectByName(`${label}-gate`), d = gate.userData.distance;
    const f = sampleTrack(d);
    const inverse = new THREE.Matrix4().compose(f.position, f.quaternion, new THREE.Vector3(1, 1, 1)).invert();
    const overhead = world.getObjectByName(`${label}-gate-overhead`);
    const bounds = geometryBounds(overhead, inverse);
    assert.ok(bounds.min.y >= 16.5, `${label}: every overhead vertex clears the required opening`);
    let overlappingPoses = 0;
    for (let offset = -16; offset <= 16; offset += .2) for (const pitch of [-.35, .35]) {
      const pose = sampleTrack(d + offset), vehicle = new THREE.Box3();
      for (const x of [-7.9, 7.9]) for (const y of [0, 9.34]) for (const z of [-4, 4]) {
        const local = new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch);
        local.y += 16 ** 2 / (2 * 24);
        vehicle.expandByPoint(framePoint(pose, local.x, local.y, local.z).applyMatrix4(inverse));
      }
      if (vehicle.max.z >= bounds.min.z && vehicle.min.z <= bounds.max.z) {
        overlappingPoses++;
        assert.ok(vehicle.max.y + .5 < bounds.min.y, `${label}: pitched guardian clears all trim with its front/rear under the gate at offset ${offset}`);
      }
    }
    assert.ok(overlappingPoses > 20, 'sampled full forward extent approaching and leaving the gate');
    const signs = overhead.children.filter(mesh => mesh.material.map?.isCanvasTexture);
    assert.equal(signs.length, 1, 'both titles reuse one texture and material batch');
    assert.equal(signs[0].geometry.attributes.position.count, 12, 'two full title planes survive batching');
    const titleBounds = geometryBounds(signs[0], inverse);
    assert.ok(titleBounds.min.z < -.68 && titleBounds.max.z > .68, 'titles occupy both faces');
  }
});


test('rear loop gantry does not obscure truck landmarks from either overview camera', () => {
  const world = createWorld(), support = world.getObjectByName('loop-support');
  support.updateMatrixWorld(true);
  const base = sampleTrack(LOOP_START).position;
  const ray = new THREE.Raycaster();
  let checked = 0;
  for (const spec of TRUCKS) {
    const truck = makeTruck(spec);
    truck.body.position.y = 1.8;
    truck.head.visible = true;
    truck.arms.forEach((arm, i) => { arm.visible = true; arm.rotation.z = (i === 0 ? -1 : 1) * .85; });
    truck.wheels.forEach((wheel, i) => { wheel.position.x = (i % 2 === 0 ? -1 : 1) * 2.35; });
    truck.group.updateMatrixWorld(true);
    const points = [truck.body, truck.head, ...truck.wheels].map(part => new THREE.Box3().setFromObject(part, true).getCenter(new THREE.Vector3()));
    for (const zoom of [1, 1.8]) {
      const camera = base.clone().add(new THREE.Vector3(100, 36, -5).multiplyScalar(zoom));
      for (let d = LOOP_START - 17; d < LOOP_END + 15; d += .5) for (const lane of [-1, 0, 1]) {
        const frame = sampleTrack(d);
        for (const point of points) {
          const target = framePoint(frame, point.x + lane * 3.4, point.y, point.z);
          const direction = target.clone().sub(camera);
          ray.set(camera, direction.clone().normalize()); ray.far = direction.length() - .05;
          assert.equal(ray.intersectObject(support, true).length, 0, `${spec.id}: support obscures landmark at ${d}, lane ${lane}, camera zoom ${zoom}`);
          checked++;
        }
      }
    }
    disposeTruck(truck);
  }
  assert.equal(checked, 91584, 'all six trucks, three lanes, both cameras and six landmarks are covered');
});
