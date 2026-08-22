import {
  generateIdentity,
  identityFromString,
  getUidFromPublicKey,
} from '@honeybbq/teamspeak-client';
import { hash } from '@bf2-matchmaking/redis/hash';

/**
 * Stable TeamSpeak identities for emulated test clients.
 *
 * A TeamSpeak identity is an ECDSA keypair generated client-side; the unique
 * identifier is base64(sha1(publicKey)), derived from the keypair rather than
 * assigned by the server. So a UID is known before the client ever connects,
 * which lets us seed players.teamspeak_id up front and keep it stable.
 *
 * Identities are persisted in Redis rather than on disk because api/engine run
 * on Railway, where the filesystem does not survive a redeploy. Losing them
 * would orphan every seeded teamspeak_id.
 */

const IDENTITY_KEY = 'gather:test:identities';

/**
 * Minimum identity security level. The gather server reports
 * virtualserver_needed_identity_security_level=15, and a client below it is
 * refused mid-handshake with no error - it simply stalls.
 *
 * The level is proof-of-work over the keypair, recorded as an offset; raising
 * it leaves the public key (and therefore the UID) untouched, so upgrading an
 * identity never invalidates a seeded players.teamspeak_id. Measured at ~23ms
 * to clear 16, so the headroom above 15 is free.
 */
const SECURITY_LEVEL = 16;
const SEEDED_IDENTITIES = parseSeededIdentities();

export interface TestIdentity {
  /** players.id of the Test row this identity is bound to. */
  playerId: string;
  /** Derived TS unique identifier - the value written to players.teamspeak_id. */
  uid: string;
  /** Serialized identity, for identityFromString() when spawning a client. */
  serialized: string;
}

const identityStore = () => hash<Record<string, string>>(IDENTITY_KEY);

/**
 * How many identities the environment supplied. Reported when a lookup fails,
 * to separate "the variable is not set" from "it is set but lacks this player".
 */
export const SEEDED_IDENTITY_COUNT = Object.keys(SEEDED_IDENTITIES).length;

function parseSeededIdentities(): Record<string, string> {
  const value = process.env.TEAMSPEAK_TEST_IDENTITIES_JSON;
  if (!value) return {};

  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('TEAMSPEAK_TEST_IDENTITIES_JSON must be a JSON object');
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

function toTestIdentity(playerId: string, serialized: string): TestIdentity {
  const identity = identityFromString(serialized);
  return {
    playerId,
    serialized,
    uid: getUidFromPublicKey(identity.publicKeyBase64()),
  };
}

/** Generate a fresh identity. Pure local computation - no server contact. */
export function createIdentity(playerId: string): TestIdentity {
  const identity = generateIdentity(SECURITY_LEVEL);
  return {
    playerId,
    serialized: identity.toString(),
    uid: getUidFromPublicKey(identity.publicKeyBase64()),
  };
}

/**
 * Raise a stored identity to SECURITY_LEVEL if it falls short, persisting the
 * new offset. Returns the identity string to connect with.
 *
 * Identities seeded before the level requirement was discovered sit at 8/9 and
 * would stall the handshake; upgrading is cheap and UID-preserving, so this is
 * safe to call on every spawn.
 */
export async function ensureSecurityLevel(
  stored: TestIdentity
): Promise<TestIdentity> {
  const identity = identityFromString(stored.serialized);
  if (identity.securityLevel() >= SECURITY_LEVEL) {
    return stored;
  }

  await identity.upgradeToLevel(SECURITY_LEVEL);
  const serialized = identity.toString();
  await identityStore().setEntries([[stored.playerId, serialized]]);

  return { ...stored, serialized };
}

export async function getStoredIdentities(): Promise<Array<TestIdentity>> {
  const stored = await identityStore().getAll();
  return Object.entries(stored || {}).map(([playerId, serialized]) =>
    toTestIdentity(playerId, serialized)
  );
}

/**
 * Look up a single identity: redis first, falling back to the seeded env map,
 * which is persisted on first use.
 *
 * The fallback is what makes a fresh deployment usable. Its redis starts empty
 * while players.teamspeak_id still holds the UIDs of the identities seeded into
 * the shared database, and those identities cannot be regenerated without
 * orphaning the rows - so the keypairs have to be carried in rather than
 * recreated. Mirrors getOrCreateAdminIdentity().
 */
export async function getStoredIdentity(
  playerId: string
): Promise<TestIdentity | null> {
  const serialized = await identityStore().get(playerId);
  if (serialized) {
    return toTestIdentity(playerId, serialized);
  }

  const seeded = SEEDED_IDENTITIES[playerId];
  if (!seeded) {
    return null;
  }

  await identityStore().setEntries([[playerId, seeded]]);
  return toTestIdentity(playerId, seeded);
}

/**
 * Return an identity per playerId, generating and persisting any that are
 * missing. Existing entries are never regenerated - their UIDs are already
 * seeded into the database, so replacing one would silently orphan that row.
 */
export async function getOrCreateIdentities(
  playerIds: Array<string>
): Promise<Array<TestIdentity>> {
  const stored = await identityStore().getAll();
  const created: Record<string, string> = {};

  const identities = playerIds.map((playerId) => {
    const existing = stored?.[playerId] || SEEDED_IDENTITIES[playerId];
    if (existing) {
      if (!stored?.[playerId]) created[playerId] = existing;
      return toTestIdentity(playerId, existing);
    }
    const identity = createIdentity(playerId);
    created[playerId] = identity.serialized;
    return identity;
  });

  if (Object.keys(created).length) {
    await identityStore().setEntries(Object.entries(created));
  }

  return identities;
}
