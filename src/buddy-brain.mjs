/** Small deterministic local decisions. The race owns movement and clearance;
 * these serializable timers only request a jump, following gap or signal. */
export function normalizeRaceVariant(seed) {
  return typeof seed === 'number' && Number.isFinite(seed)
    ? Math.min(1_000_000_000, Math.max(0, Math.floor(seed))) : 0;
}

function variation(variant, index, channel) {
  let value = (variant + Math.imul(index + 1, 0x9e3779b9) + Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

export function createBuddyMind(variant, index) {
  const sunny = index === 0;
  return {
    intent: 'follow', signal: '', signalTime: 0, speed: 26,
    brain: {
      helloAt: .18 + index * .3 + variation(variant, index, 0) * .12,
      greeted: false,
      echoDelay: (sunny ? .3 : .55) + variation(variant, index, 1) * .16,
      echoTime: 0, echoPending: false, echoCooldown: 0,
      cheerDelay: (sunny ? .34 : .18) + variation(variant, index, 2) * .12,
      cheerTime: 0, cheerPending: '', cheerExpiry: 0, cheerCooldown: 0,
      approachOffset: variation(variant, index, 3) * 8,
      puddleOffset: variation(variant, index, 4) * 7,
      puddlesVisited: 0,
    },
  };
}

function signal(buddy, action, events) {
  buddy.signal = action;
  buddy.signalTime = action === 'hello' ? 1.2 : action === 'splash' ? 1.65 : 1.35;
  events.push({ type: 'buddy', id: buddy.id, action });
}

/** Called once per running simulation step. Never reads control objects or
 * global random state: only successful player events can invite a reaction. */
export function stepBuddyMind(buddy, step, { elapsed, approach, safeJump, playerEvents }, events) {
  const brain = buddy.brain, sunny = buddy.id === 'sunny';
  buddy.signalTime = Math.max(0, buddy.signalTime - step);
  if (buddy.signalTime === 0) buddy.signal = '';
  for (const timer of ['echoTime', 'echoCooldown', 'cheerTime', 'cheerExpiry', 'cheerCooldown']) {
    brain[timer] = Math.max(0, brain[timer] - step);
  }
  if (brain.cheerExpiry === 0) brain.cheerPending = '';

  // The two existing muddy areas are broad, clear driving stretches. Splash
  // explores at a slightly larger following gap without changing lanes.
  const wetStretch = buddy.distance >= 222 && buddy.distance <= 278 ? 1
    : buddy.distance >= 1232 && buddy.distance <= 1312 ? 2 : 0;
  const exploring = !sunny && wetStretch > 0;
  buddy.intent = exploring ? 'puddle' : sunny && approach > .25 ? 'race' : 'follow';

  if (playerEvents.some(event => event.type === 'jump' && !event.auto) && brain.echoCooldown === 0 && !brain.echoPending) {
    brain.echoTime = brain.echoDelay;
    brain.echoPending = true;
    brain.echoCooldown = sunny ? 3.6 : 5;
  }
  const crushed = playerEvents.some(event => event.type === 'crush');
  const turbo = playerEvents.some(event => event.type === 'turbo');
  if ((crushed || turbo) && brain.cheerCooldown === 0 && !brain.cheerPending) {
    brain.cheerPending = sunny && turbo ? 'turbo' : crushed ? 'star' : 'turbo';
    brain.cheerTime = brain.cheerDelay;
    brain.cheerExpiry = 2;
    brain.cheerCooldown = sunny ? 3 : 2.4;
  }

  // A due imitation is discarded if airborne or near a stunt. It must never
  // wait through a ramp or emerge as an unrelated surprise after the loop.
  if (brain.echoPending && brain.echoTime === 0) {
    brain.echoPending = false;
    if (safeJump) {
      buddy.intent = 'echo';
      signal(buddy, 'jump', events);
      return { jump: true, gapAdjustment: exploring ? 2 : 0 };
    }
  }
  if (!brain.greeted && elapsed >= brain.helloAt) {
    brain.greeted = true;
    if (elapsed < 2 && buddy.signal === '') signal(buddy, 'hello', events);
  } else if (brain.cheerPending && brain.cheerTime === 0 && (buddy.signal === '' || buddy.signal === 'hello')) {
    signal(buddy, brain.cheerPending, events);
    brain.cheerPending = '';
  } else if (exploring && brain.puddlesVisited < wetStretch && buddy.height === 0 && buddy.signal === '' &&
      buddy.distance >= (wetStretch === 1 ? 228 : 1238) + brain.puddleOffset) {
    brain.puddlesVisited = wetStretch;
    signal(buddy, 'splash', events);
  }
  if (buddy.signal === 'hello') buddy.intent = 'greet';
  if (buddy.signal === 'jump') buddy.intent = 'echo';
  if (buddy.signal === 'star' || buddy.signal === 'turbo') buddy.intent = 'cheer';
  return { jump: false, gapAdjustment: exploring ? 2 : 0 };
}
