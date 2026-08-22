import { createHash } from 'node:crypto';

/**
 * BF2 (Refractor 2) CD key and keyhash generation for fake players.
 *
 * The server derives a player's keyhash from their CD key as
 * MD5(uppercase(key with dashes removed)), and that 32-hex value is what
 * appears in column 42 of `bf2cc pl` and what the gather matches against
 * players.keyhash.
 *
 * Because the algorithm is fully local, we can pick CD keys, compute the exact
 * keyhash ourselves, and seed the database up front - no need to observe a real
 * connection first. Keeping the CD keys around means a real fake-BF2-client
 * could later present these same keys and produce the keyhashes already stored.
 */

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const GROUP_LENGTH = 4;
const GROUP_COUNT = 5;

/** MD5(uppercase(cdKey without dashes)), as 32 lowercase hex chars. */
export function keyhashFromCdKey(cdKey: string): string {
  const normalized = cdKey.replace(/-/g, '').toUpperCase();
  return createHash('md5').update(normalized).digest('hex');
}

/**
 * Deterministic CD key for a player id, formatted like a real one
 * (XXXX-XXXX-XXXX-XXXX-XXXX).
 *
 * Derived by hashing a fixed salt with the id so the same player always gets
 * the same key: regenerating must not orphan an already-seeded keyhash.
 */
export function cdKeyForPlayer(playerId: string): string {
  const digest = createHash('sha256')
    .update(`bf2-matchmaking-test-cdkey:${playerId}`)
    .digest();

  const chars = Array.from(
    { length: GROUP_LENGTH * GROUP_COUNT },
    (_, i: number) => KEY_ALPHABET[digest[i] % KEY_ALPHABET.length]
  );

  const groups: Array<string> = [];
  for (let i = 0; i < GROUP_COUNT; i++) {
    groups.push(chars.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH).join(''));
  }
  return groups.join('-');
}

export interface TestCdKey {
  playerId: string;
  cdKey: string;
  keyhash: string;
}

export function testCdKeyForPlayer(playerId: string): TestCdKey {
  const cdKey = cdKeyForPlayer(playerId);
  return { playerId, cdKey, keyhash: keyhashFromCdKey(cdKey) };
}
