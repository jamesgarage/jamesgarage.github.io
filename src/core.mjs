/** Pure game rules. Rendering, audio, and storage are owned by the application. */
import { getCrushCars, getSmashTargets, TURBO_PADS } from './encounters.mjs';
import { getCourse } from './courses.mjs';
import { sampleFlight } from './flight.mjs';
import { createBuddyMind, normalizeRaceVariant, stepBuddyMind } from './buddy-brain.mjs';
import { raceCrew } from './crew.mjs';
import { normalizeRaceMode, normalizeRivalRank, rivalGridDistance, createRivalProfile, stepRivalMovement, recordFinishCrossings,
  stepChallengeSteering, beginRecovery, stepRecovery, finishRecovery } from './race-rules.mjs';
import { ROUTE_LOOP_START, ROUTE_LOOP_END } from './turns.mjs';

export const COURSE_LENGTH = getCourse('skyway').end;
export const RACE_SPEED = 26;
export const LOOP_START = ROUTE_LOOP_START;
export const LOOP_END = ROUTE_LOOP_END;
export const RAMPS = Object.freeze([170, 400, 680, 1080, 1510, 1740]);
export const RAMP_DISTANCES = RAMPS;
export const MAX_BONUS_STARS = 50;

export const TRUCKS = Object.freeze([
  Object.freeze({ id: 'rumbler', name: 'Rumbler', color: 0xff7547, accent: 0xffd25a, scale: 1, threshold: 0, tagline: 'Little truck. Huge adventures.' }),
  Object.freeze({ id: 'bear-crusher', name: 'Bear Crusher', color: 0x9257e5, accent: 0xffc45c, scale: 1.12, threshold: 12, tagline: 'Big paws. Bigger wheels.' }),
  Object.freeze({ id: 'night-stomper', name: 'Night Stomper', color: 0x172735, accent: 0x8bff4e, scale: 1.2, threshold: 24, tagline: 'Neon green. Monster-sized dreams.' }),
  Object.freeze({ id: 'gator-claw', name: 'Gator Claw', color: 0x64cd69, accent: 0xeaff78, scale: 1.23, threshold: 32, tagline: 'Ready to roar over every ramp.' }),
  Object.freeze({ id: 'rescue-roarer', name: 'Rescue Roarer', color: 0xe63832, accent: 0xffe5a2, scale: 1.25, threshold: 40, tagline: 'Big red rescue. Ready to roll.' }),
  Object.freeze({ id: 'shark-surge', name: 'Shark Surge', color: 0x269fc7, accent: 0xe9f7f3, scale: 1.3, threshold: 48, tagline: 'Fins up. Wheels down. Chomp!' }),
  Object.freeze({ id: 'chrome-guardian', name: 'Chrome Guardian', color: 0xb9c7cc, accent: 0x71ecdf, scale: 1.35, threshold: 60, tagline: 'A shining hero of the skyway.' }),
  Object.freeze({ id: 'mega-titan', name: 'Mega Titan', color: 0xf4c346, accent: 0xff655d, scale: 1.5, threshold: 100, tagline: 'The biggest wheels in the sky.' }),
]);

const GRAVITY = 24;
const JUMP_SPEED = 10.8;
const RAMP_JUMP_SPEED = 16;
const TRANSFORM_DURATION = 9;
const AUTO_TRANSFORM_GATE = 730;
const MAX_SAVE_NUMBER = 1_000_000_000;
const TURBO_DURATION = 2.4;
const TURBO_MULTIPLIER = 1.55;
const CRUSH_BOOST_DURATION = 1;
const CRUSH_BOOST_MULTIPLIER = 1.18;
const PASSING_GAP = 8.5;
const BUDDY_FOLLOWING_GAP = 4;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function nonnegativeInteger(value, maximum = MAX_SAVE_NUMBER) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(0, Math.floor(value)))
    : 0;
}

/** Normalize untrusted parsed save data and reject unknown save versions. */
export function createProgress(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) && raw.version === 1
    ? raw
    : {};
  const stars = nonnegativeInteger(source.stars);
  const selected = TRUCKS.find(truck => truck.id === source.selected && truck.threshold <= stars);
  return {
    version: 1,
    stars,
    selected: selected?.id ?? 'rumbler',
    courseId: getCourse(source.courseId).id,
    raceMode: normalizeRaceMode(source.raceMode),
    rivalRank: normalizeRivalRank(source.rivalRank),
    cameraView: source.cameraView === 'wide' ? 'wide' : 'close',
    challengeWins: nonnegativeInteger(source.challengeWins),
    muted: source.muted === true,
    reducedMotion: source.reducedMotion === true,
    races: nonnegativeInteger(source.races),
  };
}

export function unlockedTrucks(progress) {
  const { stars } = createProgress(progress);
  return TRUCKS.filter(truck => truck.threshold <= stars);
}

/** An unavailable truck leaves the caller's existing state untouched. */
export function selectTruck(progress, id) {
  const normalized = createProgress(progress);
  if (!TRUCKS.some(truck => truck.id === id && truck.threshold <= normalized.stars)) return progress;
  return { ...normalized, selected: id };
}

export function awardRace(progress, bonusStars = 0, result = null) {
  const normalized = createProgress(progress);
  return {
    ...normalized,
    stars: Math.min(MAX_SAVE_NUMBER, normalized.stars + 12 + nonnegativeInteger(bonusStars, MAX_BONUS_STARS)),
    races: Math.min(MAX_SAVE_NUMBER, normalized.races + 1),
    challengeWins: Math.min(MAX_SAVE_NUMBER, normalized.challengeWins +
      (normalized.raceMode === 'race' && result?.place === 1 && result?.winnerId === 'player' ? 1 : 0)),
  };
}

export function createRace(seed = 0, courseId = 'skyway', raceMode = 'cruise', options = {}) {
  const variant = normalizeRaceVariant(seed);
  const course = getCourse(courseId);
  const mode = normalizeRaceMode(raceMode);
  const rank = normalizeRivalRank(options?.rivalRank);
  return {
    variant,
    courseId: course.id,
    courseStart: course.start,
    courseEnd: course.end,
    raceMode: mode,
    rivalRank: rank,
    finishOrder: [],
    winnerId: null,
    result: null,
    recovery: null,
    offCourseCount: 0,
    jumpReleaseRequired: false,
    phase: 'ready',
    distance: course.start,
    elapsed: 0,
    lane: 0,
    targetLane: 0,
    height: 0,
    velocityY: 0,
    stars: 0,
    energy: 0,
    transformTime: 0,
    robotMode: false,
    robotManual: false,
    transformHeld: false,
    jumpHeld: false,
    flight: null,
    flying: false,
    canyonCrossings: 0,
    crossedGaps: [],
    guardianClearTime: 0,
    landings: 0,
    loops: 0,
    finished: false,
    rewardGranted: false,
    jumpCooldown: 0,
    speed: RACE_SPEED,
    truckScale: 1,
    turboEnergy: 100,
    turboTime: 0,
    turboHeld: false,
    usedTurboPads: [],
    crushBoostTime: 0,
    crushes: 0,
    crushedCars: [],
    smashes: 0,
    smashedTargets: [],
    buddySignalCooldown: 0,
    buddies: raceCrew(variant).map((buddy, slot) => ({ ...buddy, homeLane: buddy.lane,
      distance: mode === 'race' ? rivalGridDistance(course.start, slot) : course.start - buddy.gap,
      ...(mode === 'race' ? { rival: createRivalProfile(variant, buddy.id, rank) } : {}),
      height: 0, velocityY: 0, flight: null, flying: false, ...createBuddyMind(variant, buddy, slot) })),
  };
}

function activateTurbo(state, events, source) {
  if (state.turboTime > 0) return;
  state.turboTime = TURBO_DURATION;
  state.turboEnergy = 0;
  events.push({ type: 'turbo', source });
}

function travelSpeed(state) {
  return RACE_SPEED * (state.turboTime > 0 ? TURBO_MULTIPLIER : state.crushBoostTime > 0 ? CRUSH_BOOST_MULTIPLIER : 1);
}

function beginFlight(state, flight, events) {
  state.flight = { ...flight, startHeight: state.height };
  state.flying = true;
  if (state.transformTime === 0) events.push({ type: 'transform' });
  state.transformTime = TRANSFORM_DURATION;
  events.push({ type: 'flight', kind: flight.kind, id: flight.id });
}

function stepFlight(state, events) {
  const flight = state.flight;
  Object.assign(state, sampleFlight(flight, state.distance, state.speed));
  if (state.distance < flight.end) {
    state.transformTime = TRANSFORM_DURATION;
    return;
  }
  state.flight = null;
  state.flying = false;
  state.jumpCooldown = Math.max(state.jumpCooldown, .18);
  state.landings += 1;
  events.push({ type: 'land', strength: .65 });
  if (flight.kind === 'canyon' && !state.crossedGaps.includes(flight.id)) {
    state.crossedGaps.push(flight.id);
    state.canyonCrossings += 1;
    events.push({ type: 'canyon', id: flight.id });
  }
  // A Truck choice made above a chasm waits until this safe landing.
  if (state.robotManual && !state.robotMode) state.transformTime = 0;
}

function approachStrength(distance, start, end) {
  const t = clamp(Math.min((distance - start) / 45, (end - distance) / 35), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Intersect the swept truck center with an expanded toy-object box. Testing the
 * same time interval on all axes prevents a fast diagonal pass from missing a
 * contact, or a jump in a different part of the frame from creating one. */
function touchesTarget(state, previous, target) {
  // Unfolded wheels occupy the same broad envelope reserved for friends.
  // Their eased return remains visible after transformTime reaches zero.
  const truckHalfWidth = (state.transformTime > 0 || state.guardianClearTime > 0 ? 3.2 : 2) * state.truckScale;
  const halfWidth = ((target.halfWidth ?? 1.05) + truckHalfWidth) / 3.4;
  const halfLength = (target.halfLength ?? 1.65) + 2.8 * state.truckScale;
  let enter = 0, leave = 1;
  for (const [from, to, lower, upper] of [
    [previous.distance, state.distance, target.distance - halfLength, target.distance + halfLength],
    [previous.lane, state.lane, target.lane - halfWidth, target.lane + halfWidth],
    [previous.height, state.height, -Infinity, target.height ?? 1.1],
  ]) {
    const change = to - from;
    if (Math.abs(change) < 1e-12) {
      if (from < lower || from > upper) return false;
    } else {
      const first = (lower - from) / change, last = (upper - from) / change;
      enter = Math.max(enter, Math.min(first, last));
      leave = Math.min(leave, Math.max(first, last));
      if (enter > leave) return false;
    }
  }
  return true;
}

/** Friendly opponents have their own continuous progress and jump velocity.
 * They approach during two authored stretches, ease off when ahead, and close
 * a large turbo gap gradually. Nothing assigns their finishing position. */
function passingWidth(state) {
  // Robot is available at any instant, including in the middle of a pass.
  // Reserve its full envelope before the driver chooses to unfold the arms.
  return (3.2 * state.truckScale + 1.15 + .25) / 3.4;
}

function holdClearLane(state, previousLane) {
  const width = passingWidth(state);
  for (const buddy of state.buddies) {
    if (Math.abs(state.distance - buddy.distance) >= PASSING_GAP + 1.6) continue;
    if (state.lane < previousLane && buddy.lane < previousLane) {
      state.lane = Math.min(previousLane, Math.max(state.lane, buddy.lane + width));
    } else if (state.lane > previousLane && buddy.lane > previousLane) {
      state.lane = Math.max(previousLane, Math.min(state.lane, buddy.lane - width));
    }
  }
}

function stepBuddies(state, step, steering, events) {
  const course = getCourse(state.courseId);
  const predictedLane = clamp(state.targetLane + steering * .6 * 2.4, -1, 1);
  const width = passingWidth(state);
  // Both toy types use the existing sparse positive cheer vocabulary.
  const playerEvents = events.map(event => event.type === 'smash' ? { ...event, type: 'crush' } : event);
  state.buddySignalCooldown = Math.max(0, state.buddySignalCooldown - step);
  for (const [index, buddy] of state.buddies.entries()) {
    const previousDistance = buddy.distance;
    const gap = state.distance - buddy.distance;
    const offset = buddy.brain.approachOffset;
    const finishRoom = clamp((course.end - state.distance - 140) / 120, 0, 1);
    const approach = finishRoom * Math.max(approachStrength(state.distance, 175 + offset, 335 + offset), approachStrength(state.distance, 1020 + offset, 1200 + offset));
    const safeJump = buddy.height === 0 && buddy.velocityY === 0 &&
      (buddy.distance < LOOP_START - 34 || buddy.distance > LOOP_END + 12) &&
      RAMPS.every(ramp => buddy.distance < ramp - 34 || buddy.distance > ramp + 10) &&
      course.gaps.every(gap => buddy.distance < gap.launch - 25 || buddy.distance > gap.land + 10);
    const signalCount = state.buddies.filter(friend => friend !== buddy && friend.signalTime > 0).length;
    const allowSignal = state.buddySignalCooldown === 0 && signalCount < 2;
    const beforeEvents = events.length;
    const decision = stepBuddyMind(buddy, step, { elapsed: state.elapsed, approach, safeJump, playerEvents, allowSignal }, events);
    if (events.length > beforeEvents) state.buddySignalCooldown = .24;
    // Only Sunny offers the brief lead challenge. All other friends stay
    // behind him, leaving the smallest driver room during ordinary cruising.
    const desiredGap = buddy.gap - (buddy.id === 'sunny' ? 17 : 11) * approach + decision.gapAdjustment;
    let speed = RACE_SPEED + clamp((gap - desiredGap) * .5, -3.5, 4.5);

    // Read steering intent before a pass; once alongside, hold the outer lane
    // and yield longitudinally instead of cutting across the player's model.
    let targetLane = buddy.homeLane;
    if (Math.abs(gap) < 25) {
      const preferredSide = Math.abs(predictedLane) > .12 ? -Math.sign(predictedLane) : Math.sign(targetLane);
      const side = Math.abs(gap) < PASSING_GAP && Math.abs(buddy.lane) > 1 ? Math.sign(buddy.lane) : preferredSide;
      targetLane = side * 1.65;
    }
    const nextLane = buddy.lane + (targetLane - buddy.lane) * (1 - Math.exp(-5 * step));
    const playerMin = Math.min(state.lane, predictedLane), playerMax = Math.max(state.lane, predictedLane);
    const buddyMin = Math.min(buddy.lane, nextLane), buddyMax = Math.max(buddy.lane, nextLane);
    const intendedClearance = Math.max(playerMin - buddyMax, buddyMin - playerMax, 0);
    const needsRoom = intendedClearance < width;
    if (needsRoom && Math.abs(gap) < PASSING_GAP) speed = Math.min(speed, Math.max(0, state.speed - 12));
    let nextDistance = Math.min(course.end, buddy.distance + speed * step);
    if (needsRoom && gap >= PASSING_GAP) nextDistance = Math.min(nextDistance, state.distance - PASSING_GAP);
    // Each friend queues behind the preceding truck even when it yields or
    // changes passing sides, preventing every pair from merging together.
    if (index > 0) nextDistance = Math.min(nextDistance, state.buddies[index - 1].distance - BUDDY_FOLLOWING_GAP);
    buddy.distance = Math.max(previousDistance, nextDistance);
    buddy.speed = (buddy.distance - previousDistance) / step;
    buddy.lane = nextLane;
    const gapFlight = course.gaps.find(gap => buddy.distance >= gap.launch && buddy.distance < gap.land);
    if (gapFlight && buddy.flight?.id !== gapFlight.id) {
      buddy.flight = { kind: 'canyon', id: gapFlight.id, start: gapFlight.launch, end: gapFlight.land, height: gapFlight.height, startHeight: buddy.height };
    }
    if (buddy.flight) {
      Object.assign(buddy, sampleFlight(buddy.flight, buddy.distance, buddy.speed));
      buddy.flying = buddy.distance < buddy.flight.end;
      if (!buddy.flying) buddy.flight = null;
    } else if (buddy.distance >= LOOP_START && buddy.distance < LOOP_END) {
      buddy.height = 0;
      buddy.velocityY = 0;
    } else {
      if (decision.jump) buddy.velocityY = JUMP_SPEED;
      if (RAMPS.some(ramp => previousDistance < ramp && buddy.distance >= ramp)) buddy.velocityY = RAMP_JUMP_SPEED;
      if (buddy.height > 0 || buddy.velocityY > 0) {
        buddy.velocityY -= GRAVITY * step;
        buddy.height = Math.max(0, buddy.height + buddy.velocityY * step);
        if (buddy.height === 0) buddy.velocityY = 0;
      }
    }
  }
}

function stepCompetitiveBuddies(state, step, motions, events) {
  const course = getCourse(state.courseId);
  const playerEvents = events.map(event => event.type === 'smash' ? { ...event, type: 'crush' } : event);
  state.buddySignalCooldown = Math.max(0, state.buddySignalCooldown - step);
  for (const buddy of state.buddies) {
    const previousDistance = motions.find(motion => motion.id === buddy.id).from;
    if (buddy.blockStarted) events.push({ type: 'rivalBlock', id: buddy.id, name: buddy.name });
    const safeJump = buddy.height === 0 && buddy.velocityY === 0 &&
      (buddy.distance < LOOP_START - 34 || buddy.distance > LOOP_END + 12) &&
      RAMPS.every(ramp => buddy.distance < ramp - 34 || buddy.distance > ramp + 10) &&
      course.gaps.every(gap => buddy.distance < gap.launch - 25 || buddy.distance > gap.land + 10);
    const allowSignal = state.buddySignalCooldown === 0 && state.buddies.filter(friend => friend !== buddy && friend.signalTime > 0).length < 2;
    const beforeEvents = events.length;
    const decision = stepBuddyMind(buddy, step, { elapsed: state.elapsed, approach: 1, safeJump, playerEvents, allowSignal }, events);
    if (events.length > beforeEvents) state.buddySignalCooldown = .24;
    if (!buddy.signal) buddy.intent = buddy.blocking ? 'block' : 'race';
    const gapFlight = course.gaps.find(gap => buddy.distance >= gap.launch && buddy.distance < gap.land);
    if (gapFlight && buddy.flight?.id !== gapFlight.id) buddy.flight = {
      kind: 'canyon', id: gapFlight.id, start: gapFlight.launch, end: gapFlight.land, height: gapFlight.height, startHeight: buddy.height,
    };
    if (buddy.flight) {
      Object.assign(buddy, sampleFlight(buddy.flight, buddy.distance, buddy.speed));
      buddy.flying = buddy.distance < buddy.flight.end;
      if (!buddy.flying) buddy.flight = null;
    } else if (buddy.distance >= LOOP_START && buddy.distance < LOOP_END) {
      buddy.height = 0;
      buddy.velocityY = 0;
    } else {
      if (decision.jump) buddy.velocityY = JUMP_SPEED;
      if (RAMPS.some(ramp => previousDistance < ramp && buddy.distance >= ramp)) buddy.velocityY = RAMP_JUMP_SPEED;
      if (buddy.height > 0 || buddy.velocityY > 0) {
        buddy.velocityY -= GRAVITY * step;
        buddy.height = Math.max(0, buddy.height + buddy.velocityY * step);
        if (buddy.height === 0) buddy.velocityY = 0;
      }
    }
  }
}

/**
 * Advance a running race in seconds, returning one-shot audiovisual events.
 * Lanes are normalized to [-1, 1]. Steering changes a persistent target lane;
 * releasing the control keeps that target. Track loops own height and pose in
 * the renderer, so height here always means a jump above the track surface.
 */
export function stepRace(state, dt, inputs = {}) {
  const events = [];
  if (state.phase !== 'running' || state.finished || !Number.isFinite(dt) || dt <= 0) return events;
  const step = Math.min(dt, 0.05);
  const course = getCourse(state.courseId);
  const previousDistance = state.distance;
  const previous = { distance: previousDistance, lane: state.lane, height: state.height };
  state.truckScale = Number.isFinite(state.truckScale) ? clamp(state.truckScale, 1, 1.5) : 1;
  if (state.raceMode === 'race' && state.recovery) {
    state.elapsed += step;
    stepRecovery(state, step, inputs);
    const motions = stepRivalMovement(state, step, previous);
    stepCompetitiveBuddies(state, step, motions, events);
    for (const entry of recordFinishCrossings(state, motions, state.elapsed - step, step)) {
      if (entry.id !== 'player') events.push({ type: 'rivalFinish', id: entry.id, place: entry.place });
    }
    if (finishRecovery(state)) events.push({ type: 'recovered' });
    return events;
  }
  state.turboTime = Math.max(0, state.turboTime - step);
  state.crushBoostTime = Math.max(0, state.crushBoostTime - step);
  state.turboEnergy = Math.min(100, state.turboEnergy + step * 100 / 8);
  const turboPressed = Boolean(inputs.turbo);
  if (turboPressed && !state.turboHeld && state.turboEnergy >= 100) activateTurbo(state, events, 'manual');
  state.turboHeld = turboPressed;
  state.speed = travelSpeed(state);
  state.distance = state.raceMode === 'race' ? previousDistance + state.speed * step : Math.min(course.end, previousDistance + state.speed * step);
  state.elapsed += step;
  state.jumpCooldown = Math.max(0, state.jumpCooldown - step);

  const steering = Number.isFinite(inputs.steer) ? Math.max(-1, Math.min(1, inputs.steer)) : 0;
  let recoveryZone = null;
  if (state.raceMode === 'race') {
    recoveryZone = stepChallengeSteering(state, step, steering, previous);
  } else {
    state.targetLane = Math.max(-1, Math.min(1, state.targetLane + steering * step * 2.4));
    state.lane += (state.targetLane - state.lane) * (1 - Math.exp(-10 * step));
  }
  // Keep the requested target: an occupied side only postpones the final part
  // of a merge, with no braking or penalty, until the friendly truck clears.
  if (state.raceMode !== 'race') holdClearLane(state, previous.lane);
  const competitiveMotions = state.raceMode === 'race' ? stepRivalMovement(state, step, previous) : null;
  if (recoveryZone) {
    events.push(beginRecovery(state, recoveryZone));
    state.turboHeld = Boolean(inputs.turbo);
    state.transformHeld = Boolean(inputs.transform);
    state.jumpHeld = Boolean(inputs.jump);
    state.jumpReleaseRequired = Boolean(inputs.jump);
    stepCompetitiveBuddies(state, step, competitiveMotions, events);
    for (const entry of recordFinishCrossings(state, competitiveMotions.map(motion => motion.id === 'player' ? { ...motion, eligible: false } : motion), state.elapsed - step, step)) {
      events.push({ type: 'rivalFinish', id: entry.id, place: entry.place });
    }
    return events;
  }

  for (const pad of TURBO_PADS) {
    if (pad.distance <= course.start || pad.distance >= course.end) continue;
    if (state.distance >= pad.distance - pad.length / 2 && previousDistance < pad.distance + pad.length / 2 && !state.usedTurboPads.includes(pad.id)) {
      state.usedTurboPads.push(pad.id);
      activateTurbo(state, events, 'pad');
    }
  }

  const transformPressed = Boolean(inputs.transform);
  if (transformPressed && !state.transformHeld) {
    state.robotMode = state.transformTime === 0;
    state.robotManual = true;
    state.transformTime = state.robotMode || state.flight ? TRANSFORM_DURATION : 0;
    if (state.robotMode) {
      state.energy = 0;
      events.push({ type: 'transform' });
    }
  }
  state.transformHeld = transformPressed;
  if (state.robotMode) {
    state.transformTime = TRANSFORM_DURATION;
  } else if (state.transformTime > 0) {
    state.transformTime = Math.max(0, state.transformTime - step);
  } else {
    state.energy = Math.min(100, state.energy + (state.distance - previousDistance) / 7);
  }
  if (!state.robotManual && state.energy >= 100 && state.transformTime === 0 && state.distance >= AUTO_TRANSFORM_GATE) {
    state.energy = 0;
    state.transformTime = TRANSFORM_DURATION;
    events.push({ type: 'transform' });
  }
  const onLoop = state.distance >= LOOP_START && state.distance < LOOP_END;
  const crossedRamp = RAMPS.some(ramp => previousDistance < ramp && state.distance >= ramp);
  if (!inputs.jump) state.jumpReleaseRequired = false;
  const jumpPressed = Boolean(inputs.jump) && !state.jumpReleaseRequired;
  const flyPressed = jumpPressed && !state.jumpHeld;
  state.jumpHeld = jumpPressed;
  const gap = course.gaps.find(candidate => state.distance >= candidate.launch && state.distance < candidate.land);
  if (gap && state.flight?.id !== gap.id) {
    beginFlight(state, { kind: 'canyon', id: gap.id, start: gap.launch, end: gap.land, height: gap.height }, events);
  } else if (!state.flight && !onLoop && state.transformTime > 0 && flyPressed && (state.raceMode !== 'race' || Math.abs(state.lane) <= 1)) {
    const end = Math.min(state.distance + 110, course.end - 12, state.distance < LOOP_START ? LOOP_START - 24 : Infinity);
    if (end - state.distance >= 18) beginFlight(state, {
      kind: 'rocket', id: `rocket-${state.elapsed}`, start: state.distance, end, height: Math.min(12, (end - state.distance) * .11),
    }, events);
  }
  const guidedFlight = Boolean(state.flight);
  if (guidedFlight) {
    stepFlight(state, events);
  } else if (onLoop) {
    // Bring even a last-second jump safely onto the guided loop.
    if (state.height > 0) {
      state.landings += 1;
      events.push({ type: 'land', strength: Math.min(1, Math.abs(state.velocityY) / RAMP_JUMP_SPEED) });
    }
    state.height = 0;
    state.velocityY = 0;
  } else if (crossedRamp || (jumpPressed && state.transformTime === 0 && state.height === 0 && state.jumpCooldown === 0 && (state.raceMode !== 'race' || Math.abs(state.lane) <= 1))) {
    state.velocityY = crossedRamp ? RAMP_JUMP_SPEED : JUMP_SPEED;
    state.jumpCooldown = 0.35;
    events.push({ type: 'jump', auto: crossedRamp });
  }

  if (!guidedFlight && !onLoop && (state.height > 0 || state.velocityY > 0)) {
    state.velocityY -= GRAVITY * step;
    state.height = Math.max(0, state.height + state.velocityY * step);
    if (state.height === 0) {
      const strength = Math.min(1, Math.abs(state.velocityY) / RAMP_JUMP_SPEED);
      state.velocityY = 0;
      state.jumpCooldown = Math.max(state.jumpCooldown, 0.18);
      state.landings += 1;
      events.push({ type: 'land', strength });
    }
  }

  // Keep the wide model clearance reserved through its eased return to Truck.
  state.guardianClearTime = state.transformTime > 0 ? 1 : Math.max(0, state.guardianClearTime - step);

  for (const car of getCrushCars(course.id)) {
    if (!state.crushedCars.includes(car.id) && touchesTarget(state, previous, car)) {
      const powered = state.turboTime > 0;
      state.crushedCars.push(car.id);
      state.crushes += 1;
      state.stars += 2;
      state.turboEnergy = Math.min(100, state.turboEnergy + 35);
      state.crushBoostTime = CRUSH_BOOST_DURATION;
      events.push({ type: 'crush', id: car.id, powered });
    }
  }
  for (const target of getSmashTargets(course.id)) {
    if (!state.smashedTargets.includes(target.id) && touchesTarget(state, previous, target)) {
      state.smashedTargets.push(target.id);
      state.smashes += 1;
      state.stars += 3;
      state.turboEnergy = Math.min(100, state.turboEnergy + 35);
      state.crushBoostTime = CRUSH_BOOST_DURATION;
      events.push({ type: 'smash', id: target.id, kind: target.kind, stars: 3 });
    }
  }
  if (competitiveMotions) {
    stepCompetitiveBuddies(state, step, competitiveMotions, events);
    for (const entry of recordFinishCrossings(state, competitiveMotions, state.elapsed - step, step)) {
      if (entry.id !== 'player') events.push({ type: 'rivalFinish', id: entry.id, place: entry.place });
    }
  } else {
    state.speed = travelSpeed(state);
    stepBuddies(state, step, steering, events);
  }

  if (previousDistance < LOOP_END && state.distance >= LOOP_END) {
    state.loops += 1;
    events.push({ type: 'loop' });
  }
  if (state.distance >= course.end) {
    state.phase = 'finished';
    state.finished = true;
    state.height = 0;
    state.velocityY = 0;
    state.flight = null;
    state.flying = false;
    events.push({ type: 'finish' });
  }
  return events;
}
