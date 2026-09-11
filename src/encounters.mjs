/** Authored, shared toy-car and turbo locations. No mutable race state lives here. */
import { COURSES, getCourse } from './courses.mjs';
export const CRUSH_CARS = Object.freeze([
  Object.freeze({ id: 'car-110', distance: 110, lane: 0, color: 0x54b8ec }),
  Object.freeze({ id: 'car-300', distance: 300, lane: -.75, color: 0xffca45 }),
  Object.freeze({ id: 'car-500', distance: 500, lane: 0, color: 0xe989b8 }),
  Object.freeze({ id: 'car-1185', distance: 1185, lane: 0, color: 0xff8763 }),
  Object.freeze({ id: 'car-1385', distance: 1385, lane: .75, color: 0x8ccb66 }),
  Object.freeze({ id: 'car-1640', distance: 1640, lane: 0, color: 0xa391ed }),
]);

export const TURBO_PADS = Object.freeze([355, 635, 1148, 1460, 1800].map(distance =>
  Object.freeze({ id: `pad-${distance}`, distance, length: 12 })));

/** Dimensions cover the authored barrel trio and two-row toy stacks, in road
 * units. Collision and visible objects therefore share the same footprint. */
export const SMASH_TARGETS = Object.freeze([
  [65, 0, 'crates'], [245, .65, 'barrels'], [340, -.65, 'blocks'],
  [455, 0, 'crates'], [555, .65, 'blocks'], [605, -.65, 'barrels'],
  [755, 0, 'blocks'], [1040, .65, 'crates'], [1130, -.65, 'barrels'],
  [1220, 0, 'blocks'], [1340, -.65, 'crates'], [1430, .65, 'barrels'],
  [1698, 0, 'blocks'], [1818, -.65, 'crates'], [1860, .65, 'barrels'],
].map(([distance, lane, kind]) => Object.freeze({
  id: `smash-${distance}`, kind, distance, lane, halfWidth: 1.53,
  halfLength: kind === 'barrels' ? .5 : .62, height: kind === 'barrels' ? 1.37 : 1.95,
})));

// Include a full truck length of clearance at course edges and gap corridors.
// Cache immutable views: rendering and rules call these on every frame.
const withinCourse = (target, course) => target.distance > course.start + 8 && target.distance < course.end - 8 &&
  course.gaps.every(gap => target.distance < gap.launch - 8 || target.distance > gap.land + 8);
const courseCars = new Map(COURSES.map(course => [course.id, Object.freeze(CRUSH_CARS.filter(target => withinCourse(target, course)))]));
const courseTargets = new Map(COURSES.map(course => [course.id, Object.freeze(SMASH_TARGETS.filter(target => withinCourse(target, course)))]));

export const getCrushCars = courseId => courseCars.get(getCourse(courseId).id);
export const getSmashTargets = courseId => courseTargets.get(getCourse(courseId).id);
