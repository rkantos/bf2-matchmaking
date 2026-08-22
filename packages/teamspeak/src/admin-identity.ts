import {
  generateIdentity,
  getUidFromPublicKey,
  identityFromString,
} from '@honeybbq/teamspeak-client';
import { hash } from '@bf2-matchmaking/redis/hash';

/**
 * Persistent identity for the admin TeamSpeak client.
 *
 * The identity must be stable: its unique identifier is what server group
 * permissions are granted to, so regenerating it would silently strip the
 * client of every permission it had been given.
 *
 * Stored in redis rather than on disk because api/engine run on Railway, where
 * the filesystem does not survive a redeploy.
 */

const STORE_KEY = 'teamspeak:admin:identity';
const IDENTITY_FIELD = 'identity';

/**
 * The gather server reports
 * virtualserver_needed_identity_security_level=15; below it the handshake
 * stalls with no error. 16 clears that with headroom and costs milliseconds.
 */
const SECURITY_LEVEL = 16;

export const ADMIN_NICKNAME = process.env.TEAMSPEAK_ADMIN_NICKNAME || 'bf2.gg-admin';

export interface AdminIdentity {
  uid: string;
  serialized: string;
  securityLevel: number;
}

const store = () => hash<Record<string, string>>(STORE_KEY);

function describe(serialized: string): AdminIdentity {
  const identity = identityFromString(serialized);
  return {
    serialized,
    uid: getUidFromPublicKey(identity.publicKeyBase64()),
    securityLevel: identity.securityLevel(),
  };
}

/**
 * Load the admin identity, creating it on first use.
 *
 * Also upgrades the security level in place when needed - raising it changes
 * only the proof-of-work offset, leaving the public key and therefore the UID
 * (and its granted permissions) untouched.
 */
export async function getOrCreateAdminIdentity(): Promise<AdminIdentity> {
  const existing = await store().get(IDENTITY_FIELD);

  if (existing) {
    const identity = identityFromString(existing);
    if (identity.securityLevel() >= SECURITY_LEVEL) {
      return describe(existing);
    }
    await identity.upgradeToLevel(SECURITY_LEVEL);
    const upgraded = identity.toString();
    await store().setEntries([[IDENTITY_FIELD, upgraded]]);
    return describe(upgraded);
  }

  const serialized = generateIdentity(SECURITY_LEVEL).toString();
  await store().setEntries([[IDENTITY_FIELD, serialized]]);
  return describe(serialized);
}

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const existing = await store().get(IDENTITY_FIELD);
  return existing ? describe(existing) : null;
}
