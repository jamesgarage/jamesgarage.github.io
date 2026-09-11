/** Race windows share the continuous skyway guide; canyon scenery omits deck
 * only inside each gap. Rules and scenery use these same immutable spans. */
export const DEFAULT_COURSE_ID = 'skyway';
const NO_GAPS = Object.freeze([]);
const CANYON_GAPS = Object.freeze([
  [210, 280, 16], [460, 535, 18], [1250, 1335, 20], [1570, 1665, 22],
].map(([start, end, height], index) => Object.freeze({
  id: `canyon-gap-${index + 1}`, start, end, launch: start - 18, land: end + 18, height,
})));

export const COURSES = Object.freeze([
  { id: 'skyway', name: 'Skyway Adventure', start: 0, end: 1900, theme: 'skyway', gaps: NO_GAPS },
  { id: 'woods', name: 'Bear Woods', start: 0, end: 550, theme: 'skyway', gaps: NO_GAPS },
  { id: 'loop', name: 'Sky Loop', start: 565, end: 1140, theme: 'skyway', gaps: NO_GAPS },
  { id: 'bay', name: 'Gator Bay', start: 1160, end: 1900, theme: 'skyway', gaps: NO_GAPS },
  { id: 'canyon', name: 'Canyon Run', start: 0, end: 1900, theme: 'canyon', gaps: CANYON_GAPS },
].map(Object.freeze));

export function getCourse(id) {
  return COURSES.find(course => course.id === id) ?? COURSES[0];
}

/** Normalized 0..1 progress, including races beginning midway along the guide. */
export function courseProgress(race) {
  const course = getCourse(race?.courseId);
  const distance = Number.isFinite(race?.distance) ? race.distance : course.start;
  return Math.max(0, Math.min(1, (distance - course.start) / (course.end - course.start)));
}
