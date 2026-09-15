import { COURSES, getCourse } from './courses.mjs';

export const ROUTE_LOOP_START = 820;
export const ROUTE_LOOP_END = 1000;
export const ROUTE_END = 1900;
export const ROAD_HALF_WIDTH = 8.5;
export const SHOULDER_HALF_WIDTH = 18;
export const RECOVERY_MAX_LANE = 3;
export const RECOVERY_TRIGGER_LANE = 2.4;

export const BENDS = Object.freeze([
  { id: 'woodland-bend', start: 96, end: 190, offset: 12 },
  { id: 'skyway-bend', start: 1045, end: 1215, offset: -28 },
  { id: 'lagoon-bend', start: 1370, end: 1540, offset: 24 },
  { id: 'home-bend', start: 1700, end: 1815, offset: -15 },
].map(Object.freeze));

/** Wide, supported lay-bys. Trigger windows leave six units of longitudinal
 * body clearance before their visible rail openings end. Canyon's second gap
 * has no shoulder; every stunt and finish retains its original guidance. */
export const RECOVERY_ZONES = Object.freeze([
  { id: 'woodland-shoulder', start: 96, end: 142 },
  { id: 'windmill-shoulder', start: 454, end: 528, noCanyon: true },
  { id: 'meadow-shoulder', start: 742, end: 774 },
  { id: 'lagoon-shoulder', start: 1180, end: 1210 },
  { id: 'finish-shoulder', start: 1800, end: 1828 },
].map(zone => Object.freeze({ ...zone, enter: zone.start + 6, exit: zone.end - 6 })));

const zonesByCourse = new Map(COURSES.map(course => [course.id, Object.freeze(RECOVERY_ZONES.filter(zone =>
  (!zone.noCanyon || course.theme !== 'canyon') && zone.start >= course.start + 12 && zone.end <= course.end - 18 &&
  course.gaps.every(gap => zone.end < gap.launch - 12 || zone.start > gap.land + 12)))]));
export function recoveryZones(courseId) { return zonesByCourse.get(getCourse(courseId).id); }

function bendSample(distance) {
  let offset = 0, slope = 0, second = 0;
  for (const bend of BENDS) {
    const t = (distance - bend.start) / (bend.end - bend.start);
    if (t <= 0 || t >= 1) continue;
    const u = t < .5 ? 2 * t : 2 * (1 - t), rate = (t < .5 ? 2 : -2) / (bend.end - bend.start);
    offset += bend.offset * u ** 3 * (10 + u * (-15 + 6 * u));
    slope += bend.offset * 30 * u ** 2 * (1 - u) ** 2 * rate;
    second += bend.offset * 60 * u * (1 - u) * (1 - 2 * u) * rate ** 2;
  }
  return { offset, slope, second };
}

export function turnOffset(distance) { return Number.isFinite(distance) ? bendSample(distance).offset : 0; }

/** Terrain is laid out in world Z. Keep its lowered road corridor aligned
 * with the same bends while preserving the established loop-area convention. */
export function terrainCenterX(z) {
  const station = z <= ROUTE_LOOP_START ? z : z + ROUTE_LOOP_END - ROUTE_LOOP_START;
  return 13 * Math.sin(z / 135) + 6 * Math.sin(z / 57) + (z > ROUTE_LOOP_START ? 13 : 0) + turnOffset(station);
}

/** Logical steering follows laneOffset: negative input turns toward world +X.
 * Distance remains the shared route station for every actor and flight arc. */
export function turnAt(distance, courseId) {
  const valid = Number.isFinite(distance), d = valid ? distance : 0;
  const inLoop = d >= ROUTE_LOOP_START && d <= ROUTE_LOOP_END;
  const z = d > ROUTE_LOOP_END ? d - ROUTE_LOOP_END + ROUTE_LOOP_START : d;
  const bend = bendSample(d);
  const slope = 13 / 135 * Math.cos(z / 135) + 6 / 57 * Math.cos(z / 57) + bend.slope;
  const second = -13 / 135 ** 2 * Math.sin(z / 135) - 6 / 57 ** 2 * Math.sin(z / 57) + bend.second;
  const curvature = valid && !inLoop ? second / (1 + slope * slope) ** 1.5 : 0;
  const zone = valid ? recoveryZones(courseId).find(item => d >= item.start && d <= item.end) : null;
  return { steer: Math.max(-1, Math.min(1, -curvature * 45)), curvature,
    heading: valid && !inLoop ? Math.atan(slope) : 0,
    recoverable: Boolean(zone && d >= zone.enter && d <= zone.exit), shoulder: Boolean(zone), zoneId: zone?.id ?? null,
    maxLane: RECOVERY_MAX_LANE, roadLaneLimit: 1, recoveryLane: RECOVERY_TRIGGER_LANE,
    shoulderHalfWidth: SHOULDER_HALF_WIDTH };
}

export function isRecoveryClearing(distance) {
  return RECOVERY_ZONES.some(zone => distance >= zone.start - 24 && distance <= zone.end + 24);
}
