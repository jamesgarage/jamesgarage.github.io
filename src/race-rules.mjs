/** Pure competitive-race decisions. No renderer, wall clock, or random state. */
import { turnAt } from './turns.mjs';

export const RACE_TURN_DRIFT = 1.15;
// Nearby actors face different directions on the stronger road bends. Reserve
// another .8 world units beyond straight-road spacing for those rotated tires.
const COMPETITIVE_SIDE_CLEARANCE = 1.05;
export const RIVAL_RANKS = Object.freeze([
  Object.freeze({ id: 0, name: 'Learning', speed: 26 }),
  Object.freeze({ id: 1, name: 'Racing', speed: 28 }),
  Object.freeze({ id: 2, name: 'Fast', speed: 30 }),
]);

export function normalizeRaceMode(mode) {
  return mode === 'race' ? 'race' : 'cruise';
}

export function normalizeRivalRank(rank) {
  return Number.isFinite(rank) ? Math.max(0, Math.min(2, Math.floor(rank))) : 1;
}

export function rivalGridDistance(start, slot) {
  return start + [20, 10, -10, -20][slot];
}

/** Every pace choice is fixed at the start, independent of the player's gap. */
export function createRivalProfile(seed, id, rank = 1) {
  let hash = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  for (const letter of String(id)) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619) >>> 0;
  const variation = hash / 4294967296;
  return {
    style: id === 'ember' || id === 'bolt' ? 'cheeky' : 'fair',
    speed: RIVAL_RANKS[normalizeRivalRank(rank)].speed + (variation - .5) * 1.2,
    boostEvery: 11 + (hash % 5),
    boostDelay: 3 + (hash % 7),
    boostDuration: 1.4,
    boostMultiplier: 1.14,
  };
}

export function rivalPace(profile, elapsed) {
  const sinceFirstBoost = elapsed - profile.boostDelay;
  const boosting = sinceFirstBoost >= 0 && sinceFirstBoost % profile.boostEvery < profile.boostDuration;
  return { speed: profile.speed * (boosting ? profile.boostMultiplier : 1), boosting };
}

/** Keep the route's stunt guidance, but require correcting real road bends in
 * Rival Race. Only authored supported shoulders permit leaving the road. */
export function stepChallengeSteering(race, dt, steering, previous) {
  const turn = turnAt(race.distance, race.courseId), beforeTurn = turnAt(previous.distance, race.courseId);
  const grounded = race.height === 0 && !race.flight;
  const laneLimit = grounded && turn.recoverable ? turn.maxLane : turn.roadLaneLimit;
  const drift = grounded ? turn.steer * RACE_TURN_DRIFT : 0;
  race.targetLane = Math.max(-laneLimit, Math.min(laneLimit, race.targetLane + (steering * 2.4 - drift) * dt));
  race.lane += (race.targetLane - race.lane) * (1 - Math.exp(-10 * dt));
  // Stop before the supported opening closes even if the driver has not yet
  // reached the outer trigger. This leaves room for the complete robot body.
  const leavingShoulder = grounded && beforeTurn.recoverable && !turn.recoverable && Math.abs(race.lane) > turn.roadLaneLimit;
  if (leavingShoulder) race.distance = previous.distance;
  return leavingShoulder ? beforeTurn.zoneId
    : grounded && turn.recoverable && Math.abs(race.lane) >= turn.recoveryLane ? turn.zoneId : null;
}

export function beginRecovery(race, zoneId) {
  race.offCourseCount += 1;
  race.recovery = { phase: 'hook', distance: race.distance, fromLane: race.lane, toLane: 0, elapsed: 0, duration: 3 };
  race.targetLane = 0;
  race.speed = 0;
  race.turboTime = 0;
  race.crushBoostTime = 0;
  race.height = 0;
  race.velocityY = 0;
  race.flight = null;
  race.flying = false;
  return { type: 'offCourse', zoneId };
}

export function stepRecovery(race, dt, inputs) {
  const recovery = race.recovery;
  recovery.elapsed = Math.min(recovery.duration, recovery.elapsed + dt);
  recovery.phase = recovery.elapsed < .4 ? 'hook' : recovery.elapsed < 2.6 ? 'pull' : 'release';
  const t = Math.max(0, Math.min(1, (recovery.elapsed - .4) / 2.2));
  const desiredLane = recovery.fromLane * (1 - t * t * (3 - 2 * t));
  race.lane += Math.max(-dt * 2.4, Math.min(dt * 2.4, desiredLane - race.lane));
  race.distance = recovery.distance;
  race.targetLane = 0;
  race.speed = 0;
  race.turboHeld = Boolean(inputs.turbo);
  race.transformHeld = Boolean(inputs.transform);
  race.jumpHeld = Boolean(inputs.jump);
  race.jumpReleaseRequired = Boolean(inputs.jump);
}

export function finishRecovery(race) {
  // A safe merge can briefly extend the release while a rival passes. Never
  // skip the collision resolver by snapping to the lane when the clock ends.
  if (race.recovery.elapsed < race.recovery.duration || Math.abs(race.lane) > 1e-9) return false;
  race.lane = 0;
  race.recovery = null;
  return true;
}

/** Advance all competitive road positions together. A pass changes actual
 * order only when the complete swept lateral corridor is clear. Stable render
 * slots never act as a finishing-order constraint. */
export function stepRivalMovement(race, dt, playerPrevious) {
  const now = race.elapsed;
  const player = { id: 'player', actor: race, from: playerPrevious.distance, laneFrom: playerPrevious.lane,
    to: race.distance, laneTo: race.lane, halfWidth: 3.2 * race.truckScale };
  const actors = [player, ...race.buddies.map(buddy => {
    const pace = rivalPace(buddy.rival, now);
    const finished = race.finishOrder.some(entry => entry.id === buddy.id);
    const ahead = buddy.distance - playerPrevious.distance;
    const blockWindow = buddy.rival.style === 'cheeky' && !finished && ahead > 12 && ahead < 35 &&
      (now + buddy.rival.boostDelay) % 9 < 1.6;
    let targetLane = buddy.homeLane;
    if (blockWindow) targetLane = Math.max(-.9, Math.min(.9, race.targetLane));
    else if (Math.abs(ahead) < 32) {
      const side = Math.abs(ahead) < 10.1 && Math.abs(buddy.lane) > 1 ? Math.sign(buddy.lane)
        : Math.abs(race.targetLane) > .12 ? -Math.sign(race.targetLane) : Math.sign(buddy.homeLane);
      targetLane = side * 1.65;
    }
    buddy.boosting = !finished && pace.boosting;
    buddy.blockStarted = blockWindow && !buddy.blocking;
    buddy.blocking = blockWindow;
    return { id: buddy.id, actor: buddy, from: buddy.distance, laneFrom: buddy.lane,
      to: Math.min(race.courseEnd + 80, buddy.distance + (finished ? 26 : pace.speed) * dt),
      laneTo: buddy.lane + (targetLane - buddy.lane) * (1 - Math.exp(-5 * dt)), halfWidth: 1.15 };
  })];
  const ordered = actors.slice().sort((a, b) => b.from - a.from || (a.id < b.id ? -1 : 1));
  // An established side-by-side pass owns its current lane until both full
  // bodies have cleared. Cancel only this frame's unsafe lateral proposals.
  for (let i = 0; i < ordered.length; i++) for (let j = i + 1; j < ordered.length; j++) {
    const front = ordered[i], rear = ordered[j];
    const gap = front.id === 'player' || rear.id === 'player' ? 8.5 : 4;
    const width = (front.halfWidth + rear.halfWidth + COMPETITIVE_SIDE_CLEARANCE) / 3.4;
    const beforeSide = front.laneFrom - rear.laneFrom, afterSide = front.laneTo - rear.laneTo;
    if (Math.min(front.from - rear.from, front.to - rear.to) < gap + 1.6 && Math.abs(beforeSide) >= width &&
        (beforeSide * afterSide < 0 || Math.abs(afterSide) < width)) {
      front.laneTo = front.laneFrom;
      rear.laneTo = rear.laneFrom;
    }
  }
  // Front-to-back resolution propagates any slowdown through the real queue.
  for (let i = 1; i < ordered.length; i++) {
    const rear = ordered[i];
    for (let j = 0; j < i; j++) {
      const front = ordered[j];
      const gap = front.id === 'player' || rear.id === 'player' ? 8.5 : 4;
      const width = (front.halfWidth + rear.halfWidth + COMPETITIVE_SIDE_CLEARANCE) / 3.4;
      const minFront = Math.min(front.laneFrom, front.laneTo), maxFront = Math.max(front.laneFrom, front.laneTo);
      const minRear = Math.min(rear.laneFrom, rear.laneTo), maxRear = Math.max(rear.laneFrom, rear.laneTo);
      const clearance = Math.max(minFront - maxRear, minRear - maxFront, 0);
      if (clearance < width) rear.to = Math.max(rear.from, Math.min(rear.to, front.to - gap));
    }
  }
  for (const motion of actors) {
    motion.actor.distance = motion.id === 'player' ? Math.min(race.courseEnd, motion.to) : motion.to;
    motion.actor.lane = motion.laneTo;
    motion.actor.speed = Math.max(0, (motion.to - motion.from) / dt);
  }
  return actors.map(({ id, from, to }) => ({ id, from, to }));
}

/** Record actual crossings before distance clamping. If the player crosses in
 * this step, later substep crossings are outside the completed race. Exact ties
 * use actor ID order, independent of array traversal or render-slot order. */
export function recordFinishCrossings(race, motions, elapsedBefore, dt) {
  if (race.result || !Number.isFinite(dt) || dt <= 0 || !Number.isFinite(elapsedBefore)) return [];
  const eligibleIds = new Set(['player', ...race.buddies.map(buddy => buddy.id)]);
  const finishedIds = new Set(race.finishOrder.map(entry => entry.id));
  const candidates = motions.filter(motion => eligibleIds.has(motion.id) && !finishedIds.has(motion.id) && motion.eligible !== false &&
    Number.isFinite(motion.from) && Number.isFinite(motion.to) && motion.from < race.courseEnd && motion.to >= race.courseEnd && motion.to > motion.from)
    .map(motion => ({ id: motion.id, time: elapsedBefore + dt * (race.courseEnd - motion.from) / (motion.to - motion.from) }))
    .sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const recorded = [];
  for (const candidate of candidates) {
    if (finishedIds.has(candidate.id)) continue;
    const entry = { ...candidate, place: race.finishOrder.length + 1 };
    finishedIds.add(entry.id);
    race.finishOrder.push(entry);
    recorded.push(entry);
    if (race.winnerId === null) race.winnerId = entry.id;
    if (entry.id === 'player') {
      race.result = {
        place: entry.place,
        winnerId: race.winnerId,
        won: race.winnerId === 'player',
        finishOrder: race.finishOrder.map(finish => ({ ...finish })),
      };
      break;
    }
  }
  return recorded;
}

/** Finished actors retain their recorded places even when poses share the line. */
export function raceStandings(race) {
  const finishOrder = Array.isArray(race.finishOrder) ? race.finishOrder : [];
  const finishedIds = new Set(finishOrder.map(entry => entry.id));
  const remaining = [{ id: 'player', distance: race.distance }, ...race.buddies]
    .filter(actor => !finishedIds.has(actor.id))
    .sort((a, b) => b.distance - a.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [
    ...finishOrder.map(entry => ({ ...entry, finished: true })),
    ...remaining.map((actor, index) => ({ id: actor.id, place: finishOrder.length + index + 1, time: null, finished: false })),
  ];
}
