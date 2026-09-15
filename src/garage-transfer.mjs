import { createProgress } from './core.mjs';

export const LEGACY_GAME_ORIGIN = 'https://yanivalfasykeelusa.github.io';
export const LEGACY_GAME_PATH = '/james-monster-skyway';
export const GARAGE_DESTINATION = 'https://jamesgarage.github.io/';
export const TRANSFER_FRAGMENT_PREFIX = '#garage-v1=';

// The current payload is under 400 characters. This ceiling leaves room for
// schema growth while preventing a fragment from becoming an unbounded input.
export const MAX_TRANSFER_FRAGMENT_LENGTH = 2048;

const PROGRESS_KEYS = Object.freeze([
  'version', 'stars', 'selected', 'courseId', 'raceMode', 'rivalRank',
  'cameraView', 'challengeWins', 'muted', 'reducedMotion', 'races',
]);

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid transfer encoding');
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function canonicalProgress(raw) {
  if (!isPlainRecord(raw)) return null;
  const normalized = createProgress(raw);
  if (PROGRESS_KEYS.some(key => raw[key] !== normalized[key])) return null;
  return normalized;
}

export function isLegacyGameLocation(locationLike) {
  const path = locationLike?.pathname?.replace(/\/$/, '') || '';
  return locationLike?.origin === LEGACY_GAME_ORIGIN &&
    (path === LEGACY_GAME_PATH || path.startsWith(`${LEGACY_GAME_PATH}/`));
}

export function isGarageDestination(locationLike) {
  return locationLike?.origin === new URL(GARAGE_DESTINATION).origin;
}

export function createGarageTransferURL(rawProgress) {
  const progress = createProgress(rawProgress);
  const json = JSON.stringify({ version: 1, progress });
  const payload = bytesToBase64Url(new TextEncoder().encode(json));
  const fragment = `${TRANSFER_FRAGMENT_PREFIX}${payload}`;
  if (fragment.length > MAX_TRANSFER_FRAGMENT_LENGTH) throw new Error('Garage transfer is too large');
  return `${GARAGE_DESTINATION}${fragment}`;
}

export function parseGarageTransferHash(hash) {
  if (!hash?.startsWith(TRANSFER_FRAGMENT_PREFIX)) return { status: 'none' };
  if (hash.length > MAX_TRANSFER_FRAGMENT_LENGTH) return { status: 'invalid', reason: 'too-large' };

  try {
    const encoded = hash.slice(TRANSFER_FRAGMENT_PREFIX.length);
    const json = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(encoded));
    const envelope = JSON.parse(json);
    if (!isPlainRecord(envelope) || envelope.version !== 1) throw new Error('Unsupported transfer version');
    const progress = canonicalProgress(envelope.progress);
    if (!progress) throw new Error('Invalid garage progress');
    return { status: 'ready', progress };
  } catch {
    return { status: 'invalid', reason: 'malformed' };
  }
}

export function mergeGarageProgress(currentProgress, sourceProgress) {
  const current = createProgress(currentProgress);
  const source = canonicalProgress(sourceProgress);
  if (!source) return current;
  return createProgress({
    ...source,
    stars: Math.max(current.stars, source.stars),
    races: Math.max(current.races, source.races),
    challengeWins: Math.max(current.challengeWins, source.challengeWins),
  });
}

export function clearGarageTransferHash(historyLike, locationLike) {
  historyLike.replaceState(historyLike.state ?? null, '', `${locationLike.pathname}${locationLike.search}`);
}
