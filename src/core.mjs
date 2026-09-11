/** Pure game rules. Rendering, audio, and storage are owned by the application. */
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
    landings: 0,
    loops: 0,
    finished: false,
    rewardGranted: false,
    jumpCooldown: 0,
  };
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
  state.distance = Math.min(COURSE_LENGTH, previousDistance + RACE_SPEED * step);
  state.elapsed += step;
  state.jumpCooldown = Math.max(0, state.jumpCooldown - step);

  const steering = Number.isFinite(inputs.steer) ? Math.max(-1, Math.min(1, inputs.steer)) : 0;
  state.targetLane = Math.max(-1, Math.min(1, state.targetLane + steering * step * 2.4));
  state.lane += (state.targetLane - state.lane) * (1 - Math.exp(-10 * step));

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
