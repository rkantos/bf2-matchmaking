import {
  Client,
  clientMove,
  identityFromString,
} from '@honeybbq/teamspeak-client';
import { error, info, warn } from '@bf2-matchmaking/logging/winston';
import { MANAGED_CHANNEL_ROOT, QUEUE_CHANNEL } from '@bf2-matchmaking/teamspeak';
import { adminMoveClients } from '@bf2-matchmaking/teamspeak/admin';
import {
  ensureSecurityLevel,
  getStoredIdentity,
  SEEDED_IDENTITY_COUNT,
} from './identity';
import { reconcileBf2ClientOrder } from '@bf2-matchmaking/teamspeak-test/bf2-pool';
import {
  CONNECT_TIMEOUT_MS,
  MOVE_SETTLE_MS,
  SPAWN_STAGGER_MS,
  TEAMSPEAK_ADDR,
  TEAMSPEAK_SERVER_PASSWORD,
} from './constants';

/**
 * Pool of emulated TeamSpeak clients used to drive the gather queue in testing.
 *
 * Lives as a process-wide singleton because each entry owns a real socket to
 * the TeamSpeak server; the pool must be the single owner of those sockets so
 * they can be reliably torn down.
 */

export interface TestClientSpec {
  /** players.id of the Test row this client impersonates. */
  playerId: string;
  /** Nickname shown in TeamSpeak, e.g. "Test0". */
  nick: string;
}

export interface TestClientInfo {
  playerId: string;
  nick: string;
  uid: string;
  clid: number;
  connected: boolean;
  queued: boolean;
}

interface PooledClient extends TestClientInfo {
  client: Client;
}

const pool = new Map<string, PooledClient>();
let resizeQueue: Promise<unknown> = Promise.resolve();
let desiredCount = 0;
let desiredRoster: Array<TestClientSpec> = [];
let desiredPlayerIds = new Set<string>();
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
let bf2ReconcileTimer: ReturnType<typeof setTimeout> | undefined;
let queueChangedListener:
  | ((clients: Array<TestClientInfo>) => void | Promise<void>)
  | undefined;
let keepAliveIndex = 0;

const queueChannelId = () => BigInt(QUEUE_CHANNEL);
const holdingChannelId = () => BigInt(MANAGED_CHANNEL_ROOT);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function scheduleBf2Reconcile() {
  clearTimeout(bf2ReconcileTimer);
  bf2ReconcileTimer = setTimeout(() => {
    const queueOrder = [...pool.values()]
      .filter(
        (pooled) =>
          pooled.connected && pooled.client.channelID() === queueChannelId()
      )
      .map((pooled) => pooled.playerId);
    void reconcileBf2ClientOrder(queueOrder)
      .catch((cause) =>
        warn('TestClientPool', `BF2 queue reconciliation failed: ${cause}`)
      );
  }, 500);
  bf2ReconcileTimer.unref();
}

function notifyQueueChanged() {
  if (!queueChangedListener) return;
  void Promise.resolve(queueChangedListener(list())).catch((cause) =>
    warn('TestClientPool', `Queue snapshot listener failed: ${cause}`)
  );
}

export function setQueueChangedListener(
  listener: (clients: Array<TestClientInfo>) => void | Promise<void>
) {
  queueChangedListener = listener;
}

// HoneyBBQ test sockets have occasionally been closed by TeamSpeak as idle.
// Touch one client every three seconds (each of 16 roughly every 48 seconds)
// to keep sessions alive without creating an anti-flood burst from one IP.
const keepAliveTimer = setInterval(() => {
  const live = [...pool.values()].filter(
    (pooled) => pooled.connected && pooled.client.status === 2
  );
  if (live.length === 0) return;
  const pooled = live[keepAliveIndex++ % live.length];
  void pooled.client
    .execCommand('clientupdate client_input_muted=1')
    .catch((cause) =>
      warn('TestClientPool', `${pooled.nick}: keepalive failed: ${cause}`)
    );
}, 3_000);
keepAliveTimer.unref();

async function moveMany(
  clients: Array<PooledClient>,
  channelId: bigint,
  queued: boolean
) {
  const live = clients.filter(
    (pooled) =>
      pooled.connected &&
      // @honeybbq ClientStatus.Connected is 2. Referencing its ambient const
      // enum is not allowed under this package's isolatedModules setting.
      pooled.client.status === 2 &&
      pooled.client.clientID() > 0 &&
      pooled.client.channelID() !== channelId
  );
  if (live.length === 0) return;

  if (await adminMoveClients(live.map((pooled) => pooled.client.clientID()), String(channelId))) {
    for (const pooled of live) pooled.queued = queued;
    return;
  }

  // The admin client is optional. Fall back concurrently so one stale clid
  // cannot serialize or prevent every other valid client move.
  const outcomes = await Promise.allSettled(
    live.map((pooled) =>
      clientMove(pooled.client, pooled.client.clientID(), channelId).then(() => {
        pooled.queued = queued;
      })
    )
  );
  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'rejected') {
      warn('TestClientPool', `${live[index].nick}: failed channel move: ${outcome.reason}`);
    }
  });
}

/**
 * Set once the ServerQuery connection proves unusable, so we stop retrying it
 * for the rest of the run.
 *
 * Eviction needs ServerQuery (SSH port 10022), which is a different path from
 * the clients' own voice-port connections. That port gets anti-flood blocked
 * independently, and retrying per client turns one failure into many.
 */

/**
 * Kick any lingering session for this identity before reconnecting.
 *
 * TeamSpeak keeps a client registered until its own timeout elapses, and
 * refuses a second connection from an already-connected identity - so a pool
 * process that died without disconnecting blocks respawns, and the stale client
 * still counts as queued because it is genuinely still in the channel. Kicking
 * it makes spawning idempotent.
 *
 * Best-effort: spawning must still work when ServerQuery is unreachable, since
 * the clients themselves do not need it.
 */
async function connectClient(spec: TestClientSpec): Promise<PooledClient> {
  const stored = await getStoredIdentity(spec.playerId);
  if (!stored) {
    throw new Error(
      `No stored identity for player ${spec.playerId}: absent from redis and from ` +
        `TEAMSPEAK_TEST_IDENTITIES_JSON (${SEEDED_IDENTITY_COUNT} entries). Seed this ` +
        `redis with tools/seed-test-ts-identities.ts, or carry the existing identities ` +
        `in through TEAMSPEAK_TEST_IDENTITIES_JSON.`
    );
  }
  const identity = await ensureSecurityLevel(stored);

  const client = new Client(
    identityFromString(identity.serialized),
    TEAMSPEAK_ADDR,
    spec.nick,
    { serverPassword: TEAMSPEAK_SERVER_PASSWORD }
  );

  const pooled: PooledClient = {
    playerId: spec.playerId,
    nick: spec.nick,
    uid: identity.uid,
    clid: 0,
    connected: false,
    queued: false,
    client,
  };

  client.on('disconnected', (err) => {
    pooled.connected = false;
    if (pool.get(spec.playerId) === pooled) {
      pool.delete(spec.playerId);
    }
    scheduleBf2Reconcile();
    notifyQueueChanged();
    if (err) {
      warn('TestClientPool', `${spec.nick} disconnected: ${err.message}`);
    }
    if (desiredPlayerIds.has(spec.playerId) && !reconnectTimers.has(spec.playerId)) {
      const timer = setTimeout(() => {
        reconnectTimers.delete(spec.playerId);
        if (!desiredPlayerIds.has(spec.playerId)) return;
        void setSize(desiredCount, desiredRoster).catch((cause) => {
          warn('TestClientPool', `${spec.nick}: automatic reconnect failed: ${cause}`);
        });
      }, SPAWN_STAGGER_MS);
      reconnectTimers.set(spec.playerId, timer);
    }
  });

  await client.connect();
  await client.waitConnected(AbortSignal.timeout(CONNECT_TIMEOUT_MS));

  pooled.clid = client.clientID();
  pooled.connected = true;

  // Keep new sockets out of the queue until the complete requested group can
  // be moved together. This prevents the eighth handshake from starting a
  // gather while clients 9-16 are still connecting.
  if (client.channelID() !== holdingChannelId()) {
    await clientMove(client, client.clientID(), holdingChannelId());
  }
  return pooled;
}

/**
 * Leave the queue channel before disconnecting.
 *
 * The gather removes a player from its Redis queue on 'clientmoved' out of the
 * queue channel; it does not handle client-leave. Disconnecting directly would
 * strand the player in the queue, so step out to the lobby first.
 */
async function disconnectClient(pooled: PooledClient) {
  try {
    if (pooled.connected) {
      await clientMove(pooled.client, pooled.client.clientID(), holdingChannelId());
      pooled.queued = false;
      // Stay connected briefly so the engine can resolve this client while
      // handling the move, otherwise the queue removal never happens.
      await wait(MOVE_SETTLE_MS);
    }
  } catch (e) {
    warn('TestClientPool', `${pooled.nick}: failed to leave queue channel`);
  }
  try {
    await pooled.client.disconnect();
  } catch (e) {
    warn('TestClientPool', `${pooled.nick}: unclean disconnect`);
  }
  pooled.connected = false;
}

function toInfo({ client, ...info }: PooledClient): TestClientInfo {
  return info;
}

export function list(): Array<TestClientInfo> {
  return [...pool.values()]
    .sort((a, b) => Number(a.playerId) - Number(b.playerId))
    .map(toInfo);
}

export function size() {
  return pool.size;
}

/** Number represented by the UI slider: connected test clients in the queue. */
export function queuedSize() {
  return [...pool.values()].filter((pooled) => {
    pooled.queued =
      pooled.connected && pooled.client.channelID() === queueChannelId();
    return pooled.queued;
  }).length;
}

/**
 * Put exactly `count` clients in the gather queue, drawing from `roster` in
 * order so the same slider position always yields the same players.
 *
 * Clients are retained in the BF2 Beta root when the count decreases. This
 * makes subsequent test runs channel moves rather than repeated voice
 * handshakes, and keeps every automated move inside the managed channel tree.
 *
 * Serialized against concurrent calls: a slider emits rapid successive values,
 * and overlapping spawns would race on the same identity.
 */
/** Attempts per client before a resize gives up on it. */
const CONNECT_ATTEMPTS = 3;
/** Grows per attempt, to give anti-flood points time to decay. */
const RETRY_BACKOFF_MS = 3000;

/**
 * Connect one client, retrying a dropped handshake.
 *
 * Anti-flood drops the connection rather than refusing it, so the failure looks
 * like a timeout and the next attempt usually succeeds immediately - the server
 * only needed a moment for its points to decay. Retrying here makes that
 * recovery part of the resize instead of leaving it to a disconnect handler
 * that may or may not fire, and each attempt builds a fresh client, so nothing
 * from the dropped one is reused.
 */
async function connectWithRetry(spec: TestClientSpec) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt++) {
    try {
      return await connectClient(spec);
    } catch (e) {
      lastError = e;
      if (attempt === CONNECT_ATTEMPTS) break;
      warn(
        'TestClientPool',
        `${spec.nick}: handshake attempt ${attempt}/${CONNECT_ATTEMPTS} failed, retrying: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
      await wait(RETRY_BACKOFF_MS * attempt);
    }
  }
  throw lastError;
}

export async function setSize(
  count: number,
  roster: Array<TestClientSpec>
): Promise<Array<TestClientInfo>> {
  desiredCount = Math.max(0, Math.min(count, roster.length));
  desiredRoster = roster;
  desiredPlayerIds = new Set(
    roster.slice(0, desiredCount).map((spec) => spec.playerId)
  );
  for (const [playerId, timer] of reconnectTimers) {
    if (!desiredPlayerIds.has(playerId)) {
      clearTimeout(timer);
      reconnectTimers.delete(playerId);
    }
  }
  const run = resizeQueue.catch(() => undefined).then(async () => {
    const target = desiredCount;

    const desiredIds = new Set(roster.slice(0, target).map((spec) => spec.playerId));

    const clientsToHold: Array<PooledClient> = [];
    for (const pooled of [...pool.values()].sort(
      (a, b) => Number(b.playerId) - Number(a.playerId)
    )) {
      pooled.queued =
        pooled.connected && pooled.client.channelID() === queueChannelId();
      if (pooled.queued && !desiredIds.has(pooled.playerId)) {
        clientsToHold.push(pooled);
      }
    }
    await moveMany(clientsToHold, holdingChannelId(), false);
    if (clientsToHold.length > 0) {
      info('TestClientPool', `Moved ${clientsToHold.length} clients to BF2 Beta holding channel`);
    }

    const missingSpecs = roster
      .slice(0, target)
      .filter((spec) => !pool.has(spec.playerId));
    for (const [index, spec] of missingSpecs.entries()) {
      try {
        const pooled = await connectWithRetry(spec);
        pool.set(spec.playerId, pooled);
        info('TestClientPool', `Spawned ${spec.nick} as ${pooled.uid}`);
      } catch (e) {
        error('TestClientPool', e);
        throw new Error(
          `Failed to spawn ${spec.nick}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      if (index < missingSpecs.length - 1) await wait(SPAWN_STAGGER_MS);
    }

    const clientsToQueue = roster
      .slice(0, target)
      .map((spec) => pool.get(spec.playerId))
      .filter((pooled): pooled is PooledClient => Boolean(pooled));
    await moveMany(clientsToQueue, queueChannelId(), true);
    if (clientsToQueue.length > 0) {
      info('TestClientPool', `Moved requested clients into gather queue`);
    }
    scheduleBf2Reconcile();
    notifyQueueChanged();

    return list();
  });

  // Assign the tail synchronously, before any caller can reach its first
  // await. Multiple requests released by the same predecessor therefore stay
  // ordered instead of all observing a temporarily empty inFlight slot.
  resizeQueue = run;
  return run;
}

export async function despawnAll(): Promise<void> {
  desiredCount = 0;
  desiredRoster = [];
  desiredPlayerIds.clear();
  for (const timer of reconnectTimers.values()) clearTimeout(timer);
  reconnectTimers.clear();
  clearTimeout(bf2ReconcileTimer);
  const run = resizeQueue.catch(() => undefined).then(async () => {
    for (const pooled of [...pool.values()]) {
      await disconnectClient(pooled);
      pool.delete(pooled.playerId);
    }
  });
  resizeQueue = run;
  await run;
}
