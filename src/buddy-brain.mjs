/** Small deterministic local decisions. The race owns movement and clearance;
 * these serializable timers only request a jump, following gap or signal. */
export { normalizeRaceVariant } from './crew.mjs';

const PERSONALITIES = Object.freeze({
  race: { echoDelay: .30, echoCooldown: 3.6, cheerDelay: .34, cheerCooldown: 4.5, favorite: 'turbo' },
  puddle: { echoDelay: .57, echoCooldown: 5, cheerDelay: .18, cheerCooldown: 5.5, favorite: 'star' },
  jump: { echoDelay: .82, echoCooldown: 4.2, cheerDelay: .71, cheerCooldown: 6, favorite: 'turbo' },
  crush: { echoDelay: 1.12, echoCooldown: 7, cheerDelay: .50, cheerCooldown: 4.6, favorite: 'star' },
  turbo: { echoDelay: .94, echoCooldown: 6, cheerDelay: .42, cheerCooldown: 4, favorite: 'turbo' },
  build: { echoDelay: 1.25, echoCooldown: 7.5, cheerDelay: .92, cheerCooldown: 4.8, favorite: 'star' },
});

function personality(buddy) {
  return PERSONALITIES[buddy.preference] ?? PERSONALITIES.race;
}

function variation(variant, index, channel) {
  let value = (variant + Math.imul(index + 1, 0x9e3779b9) + Math.imul(channel + 1, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

export function createBuddyMind(variant, spec, slot = 0) {
  const profile = personality(spec);
  // Identity chooses variation; the assigned slot only staggers the hello.
  const index = [...spec.id].reduce((value, letter) => Math.imul(value, 31) + letter.charCodeAt(0), 0) >>> 0;
  return {
    intent: 'follow', signal: '', signalTime: 0, speed: 26,
    brain: {
      helloAt: .18 + slot * .67 + variation(variant, index, 0) * .12,
      greeted: false,
      echoDelay: profile.echoDelay + variation(variant, index, 1) * .12,
      echoTime: 0, echoPending: false, echoExpiry: 0, echoCooldown: 0,
      cheerDelay: profile.cheerDelay + variation(variant, index, 2) * .12,
      cheerTime: 0, cheerPending: '', cheerExpiry: 0, cheerCooldown: 0,
      approachOffset: variation(variant, index, 3) * 8,
      puddleOffset: variation(variant, index, 4) * 7,
      puddlesVisited: 0,
    },
  };
}

function signal(buddy, action, events) {
  // A real interaction is already an introduction; do not add a late hello.
  buddy.brain.greeted = true;
  buddy.signal = action;
  buddy.signalTime = action === 'hello' ? 1.2 : action === 'splash' ? 1.65 : 1.35;
  events.push({ type: 'buddy', id: buddy.id, action });
}

/** Called once per running simulation step. Never reads control objects or
 * global random state: only successful player events can invite a reaction. */
export function stepBuddyMind(buddy, step, { elapsed, approach, safeJump, playerEvents, allowSignal = true }, events) {
  const brain = buddy.brain, profile = personality(buddy), sunny = buddy.id === 'sunny';
  buddy.signalTime = Math.max(0, buddy.signalTime - step);
  if (buddy.signalTime === 0) buddy.signal = '';
  for (const timer of ['echoTime', 'echoExpiry', 'echoCooldown', 'cheerTime', 'cheerExpiry', 'cheerCooldown']) {
    brain[timer] = Math.max(0, brain[timer] - step);
  }
  if (brain.cheerExpiry === 0) brain.cheerPending = '';
  if (brain.echoExpiry === 0) brain.echoPending = false;

  // The two existing muddy areas are broad, clear driving stretches. Splash
  // explores at a slightly larger following gap without changing lanes.
  const wetStretch = buddy.distance >= 222 && buddy.distance <= 278 ? 1
    : buddy.distance >= 1232 && buddy.distance <= 1312 ? 2 : 0;
  const exploring = buddy.preference === 'puddle' && wetStretch > 0;
  buddy.intent = exploring ? 'puddle' : sunny && approach > .25 ? 'race' : 'follow';

  if (safeJump && playerEvents.some(event => event.type === 'jump' && !event.auto) && brain.echoCooldown === 0 && !brain.echoPending) {
    brain.echoTime = brain.echoDelay;
    brain.echoPending = true;
    brain.echoExpiry = brain.echoDelay + 1.5;
    brain.echoCooldown = profile.echoCooldown;
  }
  const crushed = playerEvents.some(event => event.type === 'crush');
  const turbo = playerEvents.some(event => event.type === 'turbo');
  if ((crushed || turbo) && brain.cheerCooldown === 0 && !brain.cheerPending) {
    brain.cheerPending = crushed && turbo ? profile.favorite : crushed ? 'star' : 'turbo';
    brain.cheerTime = brain.cheerDelay;
    brain.cheerExpiry = 2.6;
    brain.cheerCooldown = profile.cheerCooldown;
  }

  // A due imitation is discarded if airborne or near a stunt. It must never
  // wait through a ramp or emerge as an unrelated surprise after the loop.
  if (brain.echoPending && brain.echoTime === 0) {
    if (!safeJump) brain.echoPending = false;
    else if (allowSignal) {
      brain.echoPending = false;
      brain.echoCooldown = profile.echoCooldown;
      buddy.intent = 'echo';
      signal(buddy, 'jump', events);
      return { jump: true, gapAdjustment: exploring ? 2 : 0 };
    }
  }
  if (!brain.greeted && elapsed >= 4) brain.greeted = true;
  if (allowSignal && !brain.greeted && !brain.echoPending && !brain.cheerPending && elapsed >= brain.helloAt && buddy.signal === '') {
    brain.greeted = true;
    signal(buddy, 'hello', events);
  } else if (allowSignal && brain.cheerPending && brain.cheerTime === 0 && (buddy.signal === '' || buddy.signal === 'hello')) {
    signal(buddy, brain.cheerPending, events);
    brain.cheerPending = '';
    brain.cheerCooldown = profile.cheerCooldown;
  } else if (allowSignal && exploring && brain.puddlesVisited < wetStretch && buddy.height === 0 && buddy.signal === '' &&
      buddy.distance >= (wetStretch === 1 ? 228 : 1238) + brain.puddleOffset) {
    brain.puddlesVisited = wetStretch;
    signal(buddy, 'splash', events);
  }
  if (buddy.signal === 'hello') buddy.intent = 'greet';
  if (buddy.signal === 'jump') buddy.intent = 'echo';
  if (buddy.signal === 'star' || buddy.signal === 'turbo') buddy.intent = 'cheer';
  return { jump: false, gapAdjustment: exploring ? 2 : 0 };
}
