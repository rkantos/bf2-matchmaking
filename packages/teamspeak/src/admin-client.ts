import { Client, clientMove, identityFromString, listChannels, listClients } from '@honeybbq/teamspeak-client';
import { error, info, warn } from '@bf2-matchmaking/logging/winston';
import { ADMIN_NICKNAME, getOrCreateAdminIdentity } from './admin-identity';
import {
  MANAGED_CHANNEL_ROOT,
  QUEUE_CHANNEL,
  TEAMSPEAK_HOST,
  TEAMSPEAK_VOICE_PORT,
} from './constants';

/**
 * Admin TeamSpeak client, used in preference to ServerQuery for anything
 * frequent: listing clients, moving them, creating match channels.
 *
 * ServerQuery runs over SSH on a separate port that the server anti-floods
 * aggressively - a burst of connections gets the whole host IP-blocked, taking
 * the gather's event feed down with it. A normal client connection sits on the
 * voice port, stays open, and has proven far more tolerant of sustained use.
 *
 * Every operation is best-effort and reports failure to the caller rather than
 * throwing, so callers can fall back to ServerQuery.
 */

const CONNECT_TIMEOUT_MS = 45000;

let client: Client | null = null;
let connecting: Promise<Client | null> | null = null;
const managedChannelIds = new Set<string>([MANAGED_CHANNEL_ROOT, QUEUE_CHANNEL]);
const MATCH_CHANNEL_NAME = /^Match \d+ Team [12]$/;

function serverPassword() {
  return (
    process.env.TEAMSPEAK_SERVER_PASSWORD || process.env.TEAMSPEAK_PASSWORD || ''
  );
}

async function createClient(): Promise<Client | null> {
  try {
    const identity = await getOrCreateAdminIdentity();
    const ts = new Client(
      identityFromString(identity.serialized),
      `${TEAMSPEAK_HOST}:${TEAMSPEAK_VOICE_PORT}`,
      ADMIN_NICKNAME,
      { serverPassword: serverPassword() }
    );

    ts.on('disconnected', (e) => {
      warn('TeamSpeakAdminClient', `Disconnected: ${e?.message ?? 'clean'}`);
      client = null;
    });

    await ts.connect();
    await ts.waitConnected(AbortSignal.timeout(CONNECT_TIMEOUT_MS));

    info(
      'TeamSpeakAdminClient',
      `Connected as ${ADMIN_NICKNAME} (uid ${identity.uid}, clid ${ts.clientID()})`
    );
    return ts;
  } catch (e) {
    error('TeamSpeakAdminClient', e);
    return null;
  }
}

/** The connected admin client, or null when unavailable. */
export async function getAdminClient(): Promise<Client | null> {
  if (client) {
    return client;
  }
  // Collapse concurrent callers onto one handshake; the server refuses a second
  // connection from an identity that is already connected.
  if (!connecting) {
    connecting = createClient().finally(() => {
      connecting = null;
    });
  }
  client = await connecting;
  return client;
}

export function isAdminClientConnected() {
  return client !== null;
}

export async function disconnectAdminClient() {
  if (!client) return;
  await client.disconnect().catch(() => undefined);
  client = null;
}

export interface AdminClientChannel {
  cid: string;
  parentCid: string;
  name: string;
}

export interface AdminClientEntry {
  clid: number;
  uid: string;
  nickname: string;
  cid: string;
}

export async function adminListClients(): Promise<Array<AdminClientEntry> | null> {
  const ts = await getAdminClient();
  if (!ts) return null;
  try {
    const clients = await listClients(ts);
    return clients.map((c) => ({
      clid: c.id,
      uid: c.uid,
      nickname: c.nickname,
      cid: String(c.channelID),
    }));
  } catch (e) {
    warn('adminListClients', String(e));
    return null;
  }
}

export async function adminListChannels(): Promise<Array<AdminClientChannel> | null> {
  const ts = await getAdminClient();
  if (!ts) return null;
  try {
    const channels = await listChannels(ts);
    return channels.map((c) => ({
      cid: String(c.id),
      parentCid: String(c.parentID),
      name: c.name,
    }));
  } catch (e) {
    warn('adminListChannels', String(e));
    return null;
  }
}

/**
 * Return the managed BF2 Beta subtree. A fresh channel list is used for every
 * mutating operation so a stale id cannot accidentally escape the boundary.
 */
export async function adminManagedChannelIds(): Promise<Set<string> | null> {
  const channels = await adminListChannels();
  if (!channels) return null;

  const managed = new Set<string>([MANAGED_CHANNEL_ROOT]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const channel of channels) {
      if (!managed.has(channel.cid) && managed.has(channel.parentCid)) {
        managed.add(channel.cid);
        changed = true;
      }
    }
  }
  return managed;
}

/** Replace the allowlist with a subtree previously verified by ServerQuery. */
export function setAdminManagedChannelIds(channelIds: Iterable<string>) {
  managedChannelIds.clear();
  managedChannelIds.add(MANAGED_CHANNEL_ROOT);
  managedChannelIds.add(QUEUE_CHANNEL);
  for (const cid of channelIds) managedChannelIds.add(cid);
}

function isManagedChannel(cid: string): boolean {
  return managedChannelIds.has(cid);
}

/** Move a client into a channel. Returns false if the admin client could not do it. */
export async function adminMoveClient(clid: number, cid: string): Promise<boolean> {
  if (!isManagedChannel(cid)) {
    warn('adminMoveClient', `Refusing to move ${clid} outside BF2 Beta: ${cid}`);
    return false;
  }
  const ts = await getAdminClient();
  if (!ts) return false;
  try {
    await clientMove(ts, clid, BigInt(cid));
    return true;
  } catch (e) {
    warn('adminMoveClient', `Failed to move ${clid} to ${cid}: ${e}`);
    return false;
  }
}

/**
 * Move several clients to one managed channel in a single TS3 command.
 *
 * TeamSpeak accepts pipe-separated rows for clientmove. Keeping this on the
 * persistent HoneyBBQ admin socket avoids one command/response round trip per
 * test client while preserving the BF2 Beta destination allowlist.
 */
export async function adminMoveClients(
  clids: Iterable<number>,
  cid: string
): Promise<boolean> {
  if (!isManagedChannel(cid)) {
    warn('adminMoveClients', `Refusing bulk move outside BF2 Beta: ${cid}`);
    return false;
  }
  const uniqueClids = [...new Set(clids)].filter(
    (clid) => Number.isInteger(clid) && clid > 0
  );
  if (uniqueClids.length === 0) return true;
  const ts = await getAdminClient();
  if (!ts) return false;
  try {
    const rows = uniqueClids.map(
      (clid, index) => `${index === 0 ? 'clientmove ' : ''}clid=${clid} cid=${cid}`
    );
    await ts.execCommand(rows.join('|'));
    return true;
  } catch (e) {
    warn(
      'adminMoveClients',
      `Failed to move ${uniqueClids.length} clients to ${cid}: ${e}`
    );
    return false;
  }
}

/**
 * Create a channel and return its id.
 *
 * The library exposes no channel helper, so this goes out as a raw protocol
 * command. Properties mirror what the gather's match channels need: nested
 * under a parent, temporary so they clean themselves up once empty.
 */
export async function adminCreateChannel(
  name: string,
  parentCid: string,
  { temporary = true }: { temporary?: boolean } = {}
): Promise<string | null> {
  if (parentCid !== MANAGED_CHANNEL_ROOT || !MATCH_CHANNEL_NAME.test(name)) {
    warn('adminCreateChannel', `Refusing unsafe channel creation: ${name} under ${parentCid}`);
    return null;
  }
  const ts = await getAdminClient();
  if (!ts) return null;
  try {
    const escaped = escapeTs(name);
    const flags = temporary
      ? 'channel_flag_permanent=0 channel_flag_semi_permanent=0 channel_flag_temporary=1'
      : 'channel_flag_permanent=1';
    const reply = await ts.execCommandWithResponse(
      `channelcreate channel_name=${escaped} cpid=${parentCid} ${flags}`
    );
    const cid = reply?.[0]?.cid;
    if (!cid) {
      warn('adminCreateChannel', `No cid in response for ${name}`);
      return null;
    }
    // Do not trust this response as an authoritative channel identity. Some
    // servers return an unrelated cid; callers must resolve by name + parent.
    return cid;
  } catch (e) {
    warn('adminCreateChannel', `Failed to create ${name}: ${e}`);
    return null;
  }
}

export async function adminEditChannelFlags(
  cid: string,
  { temporary, semiPermanent }: { temporary: boolean; semiPermanent: boolean }
): Promise<boolean> {
  const channels = await adminListChannels();
  const channel = channels?.find((candidate) => candidate.cid === cid);
  if (
    !channel ||
    channel.parentCid !== MANAGED_CHANNEL_ROOT ||
    !MATCH_CHANNEL_NAME.test(channel.name)
  ) {
    warn('adminEditChannelFlags', `Refusing to edit non-match channel: ${cid}`);
    return false;
  }
  const ts = await getAdminClient();
  if (!ts) return false;
  try {
    await ts.execCommand(
      `channeledit cid=${cid} channel_flag_permanent=0 ` +
        `channel_flag_semi_permanent=${semiPermanent ? 1 : 0} ` +
        `channel_flag_temporary=${temporary ? 1 : 0}`
    );
    return true;
  } catch (e) {
    warn('adminEditChannelFlags', `Failed to edit ${cid}: ${e}`);
    return false;
  }
}

/** TS3 escaping: the protocol delimits on whitespace, so these must be encoded. */
export function escapeTs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\//g, '\\/')
    .replace(/ /g, '\\s')
    .replace(/\|/g, '\\p')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
