/** Pure game rules. Rendering, audio, and storage are owned by the application. */
import { CRUSH_CARS, TURBO_PADS } from './encounters.mjs';

export const COURSE_LENGTH = 1900;
export const RACE_SPEED = 26;
export const LOOP_START = 820;
export const LOOP_END = 1000;
export const RAMPS = Object.freeze([170, 400, 680, 1080, 1510, 1740]);
export const RAMP_DISTANCES = RAMPS;
export const MAX_BONUS_STARS = 50;

export const TRUCKS = Object.freeze([
  Object.freeze({ id: 'rumbler', name: 'Rumbler', color: 0xff7547, accent: 0xffd25a, scale: 1, threshold: 0, tagline: 'Little truck. Huge adventures.' }),
  Object.freeze({ id: 'bear-crusher', name: 'Bear Crusher', color: 0x9257e5, accent: 0xffc45c, scale: 1.12, threshold: 12, tagline: 'Big paws. Bigger wheels.' }),
  Object.freeze({ id: 'night-stomper', name: 'Night Stomper', color: 0x172735, accent: 0x8bff4e, scale: 1.2, threshold: 24, tagline: 'Neon green. Monster-sized dreams.' }),
  Object.freeze({ id: 'gator-claw', name: 'Gator Claw', color: 0x64cd69, accent: 0xeaff78, scale: 1.23, threshold: 32, tagline: 'Ready to roar over every ramp.' }),
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
const CRUSH_SLOW_DURATION = .65;
const PASSING_GAP = 8.5;
const BUDDY_FOLLOWING_GAP = 4;
const BUDDY_GRID = Object.freeze([
  Object.freeze({ id: 'sunny', name: 'Sunny', distance: -10, lane: -.65 }),
  Object.freeze({ id: 'splash', name: 'Splash', distance: -14, lane: .65 }),
]);

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

export function awardRace(progress, bonusStars = 0) {
  const normalized = createProgress(progress);
  return {
    ...normalized,
    stars: Math.min(MAX_SAVE_NUMBER, normalized.stars + 12 + nonnegativeInteger(bonusStars, MAX_BONUS_STARS)),
    races: Math.min(MAX_SAVE_NUMBER, normalized.races + 1),
  };
}

export function createRace() {
  return {
    phase: 'ready',
    distance: 0,
    elapsed: 0,
    lane: 0,
    targetLane: 0,
    height: 0,
    velocityY: 0,
    stars: 0,
    energy: 0,
    transformTime: 0,
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
    bumpTime: 0,
    crushes: 0,
    crushedCars: [],
    buddies: BUDDY_GRID.map(buddy => ({ ...buddy, height: 0, velocityY: 0 })),
  };
}

function activateTurbo(state, events, source) {
  if (state.turboTime > 0) return;
  state.turboTime = TURBO_DURATION;
  state.turboEnergy = 0;
  state.bumpTime = 0;
  events.push({ type: 'turbo', source });
}

function travelSpeed(state) {
  return RACE_SPEED * (state.turboTime > 0 ? TURBO_MULTIPLIER : state.bumpTime > 0 ? .15 : 1);
}

/** Intersect the swept truck center with an expanded toy-car box. Testing the
 * same time interval on all axes prevents a fast diagonal pass from missing a
 * contact, or a jump in a different part of the frame from creating one. */
function touchesCar(state, previous, car) {
  const halfWidth = (1.05 + 2 * state.truckScale) / 3.4;
  const halfLength = 1.65 + 2.8 * state.truckScale;
  let enter = 0, leave = 1;
  for (const [from, to, lower, upper] of [
    [previous.distance, state.distance, car.distance - halfLength, car.distance + halfLength],
    [previous.lane, state.lane, car.lane - halfWidth, car.lane + halfWidth],
    [previous.height, state.height, -Infinity, 1.1],
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
 * They catch a slowing player, ease off when ahead, and close a large turbo gap
 * gradually. Nothing teleports them or assigns their finishing position. */
function passingWidth(state) {
  // Full wheel envelopes, plus room for lean and the different road frames of
  // nearby actors. This clears even the transformed Titan's broad silhouette.
  const halfWidth = state.transformTime > 0 || state.guardianClearTime > 0 ? 3.2 : 2.5;
  return (halfWidth * state.truckScale + 1.15 + .25) / 3.4;
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

function stepBuddies(state, step, steering) {
  const predictedLane = clamp(state.targetLane + steering * .6 * 2.4, -1, 1);
  const width = passingWidth(state);
  for (const [index, buddy] of state.buddies.entries()) {
    const previousDistance = buddy.distance;
    const gap = state.distance - buddy.distance;
    const desiredGap = -BUDDY_GRID[index].distance;
    let speed = RACE_SPEED + clamp((gap - desiredGap) * .5, -3.5, 4.5);

    // Read steering intent before a pass; once alongside, hold the outer lane
    // and yield longitudinally instead of cutting across the player's model.
    let targetLane = BUDDY_GRID[index].lane;
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
    let nextDistance = Math.min(COURSE_LENGTH, buddy.distance + speed * step);
    if (needsRoom && gap >= PASSING_GAP) nextDistance = Math.min(nextDistance, state.distance - PASSING_GAP);
    // Splash queues behind Sunny even when Sunny yields or changes passing
    // sides, so the two small trucks cannot merge into each other either.
    if (index > 0) nextDistance = Math.min(nextDistance, state.buddies[index - 1].distance - BUDDY_FOLLOWING_GAP);
    buddy.distance = Math.max(previousDistance, nextDistance);
    buddy.lane = nextLane;
    if (buddy.distance >= LOOP_START && buddy.distance < LOOP_END) {
      buddy.height = 0;
      buddy.velocityY = 0;
    } else {
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
  const previousDistance = state.distance;
  const previous = { distance: previousDistance, lane: state.lane, height: state.height };
  state.truckScale = Number.isFinite(state.truckScale) ? clamp(state.truckScale, 1, 1.5) : 1;
  state.turboTime = Math.max(0, state.turboTime - step);
  state.bumpTime = Math.max(0, state.bumpTime - step);
  state.turboEnergy = Math.min(100, state.turboEnergy + step * 100 / 8);
  const turboPressed = Boolean(inputs.turbo);
  if (turboPressed && !state.turboHeld && state.turboEnergy >= 100) activateTurbo(state, events, 'manual');
  state.turboHeld = turboPressed;
  state.speed = travelSpeed(state);
  state.distance = Math.min(COURSE_LENGTH, previousDistance + state.speed * step);
  state.elapsed += step;
  state.jumpCooldown = Math.max(0, state.jumpCooldown - step);

  const steering = Number.isFinite(inputs.steer) ? Math.max(-1, Math.min(1, inputs.steer)) : 0;
  state.targetLane = Math.max(-1, Math.min(1, state.targetLane + steering * step * 2.4));
  state.lane += (state.targetLane - state.lane) * (1 - Math.exp(-10 * step));
  // Keep the requested target: an occupied side only postpones the final part
  // of a merge, with no braking or penalty, until the friendly truck clears.
  holdClearLane(state, previous.lane);

  for (const pad of TURBO_PADS) {
    if (state.distance >= pad.distance - pad.length / 2 && previousDistance < pad.distance + pad.length / 2 && !state.usedTurboPads.includes(pad.id)) {
      state.usedTurboPads.push(pad.id);
      activateTurbo(state, events, 'pad');
    }
  }

  if (state.transformTime > 0) {
    state.transformTime = Math.max(0, state.transformTime - step);
  } else {
    state.energy = Math.min(100, state.energy + (state.distance - previousDistance) / 7);
  }
  if (state.energy >= 100 && state.transformTime === 0 && (inputs.transform || state.distance >= AUTO_TRANSFORM_GATE)) {
    state.energy = 0;
    state.transformTime = TRANSFORM_DURATION;
    events.push({ type: 'transform' });
  }
  // Rendering eases the guardian wheels back inward after the timer ends.
  // Reserve the wide envelope until that visible shrink has settled.
  state.guardianClearTime = state.transformTime > 0 ? 1 : Math.max(0, state.guardianClearTime - step);

  const onLoop = state.distance >= LOOP_START && state.distance < LOOP_END;
  const crossedRamp = RAMPS.some(ramp => previousDistance < ramp && state.distance >= ramp);
  if (onLoop) {
    // Bring even a last-second jump safely onto the guided loop.
    if (state.height > 0) {
      state.landings += 1;
      events.push({ type: 'land', strength: Math.min(1, Math.abs(state.velocityY) / RAMP_JUMP_SPEED) });
    }
    state.height = 0;
    state.velocityY = 0;
  } else if (crossedRamp || (inputs.jump && state.height === 0 && state.jumpCooldown === 0)) {
    state.velocityY = crossedRamp ? RAMP_JUMP_SPEED : JUMP_SPEED;
    state.jumpCooldown = 0.35;
    events.push({ type: 'jump', auto: crossedRamp });
  }

  if (!onLoop && (state.height > 0 || state.velocityY > 0)) {
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

  for (const car of CRUSH_CARS) {
    if (!state.crushedCars.includes(car.id) && touchesCar(state, previous, car)) {
      const powered = state.turboTime > 0;
      state.crushedCars.push(car.id);
      state.crushes += 1;
      state.stars += 2;
      state.turboEnergy = Math.min(100, state.turboEnergy + 35);
      if (!powered) state.bumpTime = CRUSH_SLOW_DURATION;
      events.push({ type: 'crush', id: car.id, powered });
    }
  }
  state.speed = travelSpeed(state);
  stepBuddies(state, step, steering);

  if (previousDistance < LOOP_END && state.distance >= LOOP_END) {
    state.loops += 1;
    events.push({ type: 'loop' });
  }
  if (state.distance >= COURSE_LENGTH) {
    state.phase = 'finished';
    state.finished = true;
    state.height = 0;
    state.velocityY = 0;
    events.push({ type: 'finish' });
  }
  return events;
}
