/** Shared character identities. A race owns copies of these immutable specs. */
export const CREW_SIZE = 4;
export const CREW = Object.freeze([
  Object.freeze({ id: 'sunny', name: 'Sunny', color: 0xffd458, accent: 0xff8c54, scale: .50, style: 'sunny', preference: 'race' }),
  Object.freeze({ id: 'splash', name: 'Splash', color: 0x4edbcc, accent: 0xffeea3, scale: .46, style: 'splash', preference: 'puddle' }),
  Object.freeze({ id: 'ember', name: 'Ember', color: 0xf36552, accent: 0xffd36a, scale: .48, style: 'ember', preference: 'jump' }),
  Object.freeze({ id: 'pebble', name: 'Pebble', color: 0xa580dc, accent: 0xc5e5ac, scale: .49, style: 'pebble', preference: 'crush' }),
  Object.freeze({ id: 'bolt', name: 'Bolt', color: 0xb9c7d9, accent: 0x63e9ff, scale: .46, style: 'bolt', preference: 'turbo' }),
  Object.freeze({ id: 'digger', name: 'Digger', color: 0xf3bc41, accent: 0x546679, scale: .50, style: 'digger', preference: 'build' }),
]);

export function normalizeRaceVariant(seed) {
  return typeof seed === 'number' && Number.isFinite(seed)
    ? Math.min(1_000_000_000, Math.max(0, Math.floor(seed))) : 0;
}

const GUEST_PAIRS = Object.freeze([[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]].map(Object.freeze));

/** Six pairings let each guest spend a race with every other guest. */
export function raceCrew(seed = 0) {
  const variant = normalizeRaceVariant(seed), guests = CREW.slice(2);
  const pair = GUEST_PAIRS[variant % GUEST_PAIRS.length];
  return [CREW[0], CREW[1], ...pair.map(index => guests[index])]
    .map((friend, slot) => ({ ...friend, gap: 10 + slot * 4, lane: slot % 2 ? .65 : -.65 }));
}
