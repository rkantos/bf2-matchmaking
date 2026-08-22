import {
  QueryProtocol,
  TeamSpeak,
  ClientMovedEvent,
  ClientDisconnectEvent,
  TeamSpeakClient,
} from 'ts3-nodejs-library';
import { EventEmitter } from 'node:events';
import {
  BOT_CHANNEL,
  MANAGED_CHANNEL_ROOT,
  QUEUE_CHANNEL,
  TEAMSPEAK_HOST,
  TEAMSPEAK_QUERY_PORT,
  TEAMSPEAK_QUERY_USERNAME,
  TEAMSPEAK_VOICE_PORT,
} from './constants';
import {
  adminCreateChannel,
  adminEditChannelFlags,
  adminMoveClient,
  setAdminManagedChannelIds,
} from './admin-client';
import { error, info, warn } from '@bf2-matchmaking/logging';
import {
  api,
  assertObj,
  assertString,
  DEFAULT_SUMMON_TIMEOUT_MS,
  parseError,
} from '@bf2-matchmaking/utils';
import { MatchConfigsRow } from '@bf2-matchmaking/types';
import { list } from '@bf2-matchmaking/redis/list';
import { gather } from '@bf2-matchmaking/redis/gather';
import { GatherStatus } from '@bf2-matchmaking/types/gather';

export type GatherInitiatedListener = (
  clientUIds: Array<string>,
  address: string,
  gather: TeamSpeakGather
) => void;
export type PlayerJoiningListener = (clientUId: string, gather: TeamSpeakGather) => void;
export type PlayerJoinedListener = (clientUId: string, gather: TeamSpeakGather) => void;
export type PlayerRejectedListener = (
  clientUId: string,
  reason: string,
  gather: TeamSpeakGather
) => void;
export type PlayerLeftListener = (clientUId: string, gather: TeamSpeakGather) => void;
export type PlayersSummonedListener = (
  address: string,
  clientUIds: Array<string>,
  gather: TeamSpeakGather
) => void;
export type PlayerRemovedListener = (
  clientUId: string,
  reason: string,
  gather: TeamSpeakGather
) => void;
export type SummonCompleteListener = (
  clientUIds: Array<string>,
  gather: TeamSpeakGather
) => void;
export type PlayerMovedListener = (
  clientUId: string,
  channel: string,
  gather: TeamSpeakGather
) => void;
export type GatherStartedListener = (
  matchId: number,
  team1: Array<string>,
  team2: Array<string>,
  gather: TeamSpeakGather
) => void;
export type NextQueueListener = (
  clientUIds: Array<string>,
  address: string,
  gather: TeamSpeakGather
) => void;
export type SummonFailListener = (
  clientUIds: Array<string>,
  gather: TeamSpeakGather
) => void;
export interface TeamSpeakGather extends EventEmitter {
  on(event: 'initiated', listener: GatherInitiatedListener): this;
  on(event: 'playerJoining', listener: PlayerJoiningListener): this;
  on(event: 'playerJoined', listener: PlayerJoinedListener): this;
  on(event: 'playerRejected', listener: PlayerRejectedListener): this;
  on(event: 'playerLeft', listener: PlayerLeftListener): this;
  on(event: 'playersSummoned', listener: PlayersSummonedListener): this;
  on(event: 'playerRemoved', listener: PlayerRemovedListener): this;
  on(event: 'playerMoved', listener: PlayerMovedListener): this;
  on(event: 'summonComplete', listener: SummonCompleteListener): this;
  on(event: 'gatherStarted', listener: GatherStartedListener): this;
  on(event: 'nextQueue', listener: NextQueueListener): this;
  on(event: 'summonFail', listener: SummonFailListener): this;
  on(event: 'error', listener: (e: Error) => void): this;
}

export class TeamSpeakGather extends EventEmitter {
  ts: TeamSpeak;
  config: MatchConfigsRow;
  queue: ReturnType<typeof list>;
  state: ReturnType<typeof gather.getState>;
  settings: ReturnType<typeof gather.getSettings>;
  /**
   * clid -> uniqueIdentifier, so a disconnecting client can still be identified.
   *
   * The clientdisconnect payload only guarantees a clid; its `client` is
   * optional because the client may already be gone from the server's view by
   * the time the event is handled.
   */
  #clientUidByClid = new Map<string, string>();
  #managedChannelIds = new Set<string>([MANAGED_CHANNEL_ROOT]);
  #summonCheck: Promise<void> = Promise.resolve();
  constructor(config: MatchConfigsRow, ts: TeamSpeak) {
    super();
    this.config = config;
    this.queue = gather.getQueue(config.id);
    this.state = gather.getState(config.id);
    this.settings = gather.getSettings(config.id);
    this.ts = ts;
    this.ts.on('clientmoved', this.#handleClientMoved);
    this.ts.on('clientdisconnect', this.#handleClientDisconnect);
    this.ts.on('close', this.#handleClose);
    this.ts.on('error', this.#handleError);
  }
  /**
   * How long summoned players get to appear on the BF2 server before being
   * dropped from the queue. Adjustable at runtime so testing does not have to
   * wait out the full window on every iteration.
   */
  async getSummonTimeoutMs() {
    const configured = Number(await this.settings.getSafe('summonTimeout'));
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_SUMMON_TIMEOUT_MS;
  }
  async hasTimedOut() {
    const summonedAt = await this.state.getSafe('summonedAt');
    if (!summonedAt) {
      return false;
    }
    return Date.now() - Number(summonedAt) > (await this.getSummonTimeoutMs());
  }
  async initQueue(address: string) {
    const queueClients = await this.ts.clientList({ cid: QUEUE_CHANNEL });
    const clientUIDs = [...new Set(queueClients.map((client) => client.uniqueIdentifier))];
    for (const client of queueClients) {
      this.#clientUidByClid.set(String(client.clid), client.uniqueIdentifier);
    }
    await this.reset(address);
    this.emit('initiated', clientUIDs, address, this);
    // Recovered clients must follow the same validation and acceptance path as
    // a live channel move. Writing them directly to Redis bypasses
    // acceptPlayer(), including its full-queue transition into Summoning.
    const joiningListeners = this.listeners(
      'playerJoining'
    ) as Array<PlayerJoiningListener>;
    for (const clientUId of clientUIDs) {
      // EventEmitter does not await async listeners. Await each recovered
      // player sequentially so only the final accepted slot can fill the queue.
      await Promise.all(
        joiningListeners.map((listener) =>
          Promise.resolve(listener(clientUId, this))
        )
      );
    }
    return this;
  }
  /**
   * Reconcile Redis with the authoritative physical queue channel.
   *
   * TeamSpeak can coalesce notifications for a pipe-separated bulk move, and
   * API reloads can leave voice sessions alive after their socket owner is
   * gone. A sparse clientList on the engine's persistent ServerQuery
   * connection repairs both missed joins and missed leaves without reconnecting
   * to TeamSpeak.
   */
  async syncPhysicalQueue() {
    const queueClients = await this.ts.clientList({ cid: QUEUE_CHANNEL });
    const physicalUIds = [...new Set(
      queueClients.map((client) => client.uniqueIdentifier)
    )];
    const physical = new Set(physicalUIds);
    for (const client of queueClients) {
      this.#clientUidByClid.set(String(client.clid), client.uniqueIdentifier);
    }

    for (const clientUId of await this.queue.range()) {
      if (!physical.has(clientUId)) await this.syncPlayerLeft(clientUId);
    }

    const joiningListeners = this.listeners(
      'playerJoining'
    ) as Array<PlayerJoiningListener>;
    for (const clientUId of physicalUIds) {
      if (await this.queue.has(clientUId)) continue;
      await Promise.all(
        joiningListeners.map((listener) =>
          Promise.resolve(listener(clientUId, this))
        )
      );
    }
  }
  #handleClientMoved = async ({ channel, client }: ClientMovedEvent) => {
    this.#clientUidByClid.set(String(client.clid), client.uniqueIdentifier);

    if (channel.cid === QUEUE_CHANNEL) {
      this.emit('playerJoining', client.uniqueIdentifier, this);
    }

    const queued = await this.queue.has(client.uniqueIdentifier);
    const status = await this.state.getSafe('status');
    const drafting = status === GatherStatus.Drafting;
    if (channel.cid !== QUEUE_CHANNEL && (queued || drafting)) {
      if (status === GatherStatus.Summoning) {
        await this.state.set({ status: GatherStatus.Queueing, summonedAt: null });
      }
      if (queued) await this.queue.remove(client.uniqueIdentifier);
      this.emit('playerLeft', client.uniqueIdentifier, this);
      await this.#summonIfReady();
    }
  };
  /**
   * Drop a player from the queue when they leave the server entirely.
   *
   * Only channel moves used to be handled, so anyone who quit TeamSpeak, timed
   * out, or was kicked stayed queued forever - still counting toward
   * config.size and able to trigger a summon while absent.
   */
  #handleClientDisconnect = async ({ client, event }: ClientDisconnectEvent) => {
    const clid = String(event.clid);
    const clientUId = client?.uniqueIdentifier ?? this.#clientUidByClid.get(clid);
    this.#clientUidByClid.delete(clid);

    if (!clientUId) {
      // Never seen in the queue channel, so cannot have been queued.
      return;
    }

    const queued = await this.queue.has(clientUId);
    const status = await this.state.getSafe('status');
    const drafting = status === GatherStatus.Drafting;
    if (queued || drafting) {
      if (status === GatherStatus.Summoning) {
        await this.state.set({ status: GatherStatus.Queueing, summonedAt: null });
      }
      if (queued) await this.queue.remove(clientUId);
      this.emit('playerLeft', clientUId, this);
      await this.#summonIfReady();
    }
  };
  #handleClose = async () => {
    try {
      info('TeamSpeakGatherEvents', 'Teamspeak connection closed, reconnecting...');
      await this.ts.reconnect(3, 2000);
      info('TeamSpeakGatherEvents', 'Teamspeak reconnected');
    } catch (e) {
      error('TeamSpeakGatherEvents', e);
      await this.state.set({
        status: 'Failed',
        failReason: parseError(e),
      });
    }
  };
  #handleError = async (e: Error) => {
    // ts3-nodejs-library enriches event payloads by looking up the invoker.
    // A normal voice client can disconnect before that follow-up query runs,
    // producing this error even though ServerQuery and the gather are healthy.
    // In particular, temporary channel edits by the HoneyBBQ admin client used
    // to poison the whole gather after that client disconnected.
    if (/could not fetch client with id .+ in event "[^"]+"/i.test(e.message)) {
      warn('TeamSpeakGatherEvents', `Ignoring stale event client lookup: ${e.message}`);
      return;
    }
    error('TeamSpeakGatherEvents', e);
    await this.state.set({
      status: 'Failed',
      failReason: e.message,
    });
  };
  async nextQueue(address: string) {
    await this.state.del();
    await this.state.set({
      status: 'Queueing',
      address,
    });
    const queueClients = await this.queue.range();
    this.emit('nextQueue', queueClients, address, this);

    // Players beyond the previous match's first `size` slots stay in the
    // queue. If that overflow already forms another full gather, begin its
    // summon immediately instead of waiting for another TS move event.
    if (queueClients.length >= this.config.size) {
      await this.#summonPlayers();
    }
  }
  async reset(address: string) {
    await this.state.del();
    await this.state.set({
      status: 'Queueing',
      address,
    });
    await this.queue.del();
  }
  static async init(config: MatchConfigsRow) {
    assertString(process.env.TEAMSPEAK_PASSWORD, 'TEAMSPEAK_PASSWORD not defined');
    const ts = await TeamSpeak.connect({
      host: TEAMSPEAK_HOST,
      queryport: TEAMSPEAK_QUERY_PORT,
      protocol: QueryProtocol.SSH,
      serverport: Number(TEAMSPEAK_VOICE_PORT),
      username: TEAMSPEAK_QUERY_USERNAME,
      password: process.env.TEAMSPEAK_PASSWORD,
      nickname: process.env.TEAMSPEAK_QUERY_NICKNAME || 'bf2.gg-staging',
      autoConnect: false,
    });

    return new TeamSpeakGather(config, ts);
  }
  async acceptPlayer(clientUId: string) {
    // Client move events can be delivered more than once, and a client can
    // leave/re-enter quickly. One TeamSpeak identity must occupy one slot.
    if (await this.queue.has(clientUId)) {
      return;
    }
    const queueLength = await this.queue.rpush(clientUId);
    this.emit('playerJoined', clientUId, this);

    const status = await this.state.get('status');
    if (queueLength >= this.config.size && status === GatherStatus.Queueing) {
      await this.#summonIfReady();
    }
  }
  /** Remove a test client known to have physically left the queue channel. */
  async syncPlayerLeft(clientUId: string) {
    if (!(await this.queue.has(clientUId))) return;
    const status = await this.state.getSafe('status');
    if (status === GatherStatus.Summoning) {
      await this.state.set({ status: GatherStatus.Queueing, summonedAt: null });
    }
    await this.queue.remove(clientUId);
    this.emit('playerLeft', clientUId, this);
    await this.#summonIfReady();
  }
  async rejectPlayer(clientUId: string, reason: 'tsid' | 'keyhash') {
    const message =
      reason === 'tsid' ? getRegisterTsIdMessage(clientUId) : getRegisterKeyhashMessage();
    const poke =
      reason === 'tsid' ? getRegisterTsIdPoke(clientUId) : getRegisterKeyhashPoke();

    await this.messageClient(clientUId, message, poke);
    this.emit('playerRejected', clientUId, reason, this);
  }
  async #summonPlayers() {
    await this.state.set({
      status: GatherStatus.Summoning,
      summonedAt: Date.now().toString(),
    });

    const server = await this.state.get('address');
    const clients = await this.queue.range(0, this.config.size);
    // Start BF2 verification immediately. TeamSpeak messages/pokes are subject
    // to command throttling and previously delayed this event by minutes when
    // eight clients were notified sequentially.
    this.emit('playersSummoned', server, clients, this);
    const notifications = await Promise.allSettled(
      clients.map((clientUId) =>
        this.messageClient(clientUId, getSummonMessage(server))
      )
    );
    const failedNotifications = notifications.filter(
      (result) => result.status === 'rejected'
    ).length;
    if (failedNotifications > 0) {
      warn(
        'TeamSpeakGather',
        `Failed to notify ${failedNotifications}/${clients.length} summoned clients`
      );
    }
  }

  /**
   * Reconcile a full queue after joins and leaves. Event handlers can overlap:
   * one may reset Summoning to Queueing after another has already observed a
   * replacement player. Serialize the final state check so a queue with enough
   * players cannot be stranded, and so only one handler starts the summon.
   */
  async #summonIfReady() {
    const run = this.#summonCheck.then(async () => {
      if ((await this.state.getSafe('status')) !== GatherStatus.Queueing) return;
      if ((await this.queue.length()) < this.config.size) return;
      await this.#summonPlayers();
    });
    this.#summonCheck = run.catch(() => undefined);
    await run;
  }
  async verifySummon(clientUIds: Array<string>) {
    if ((await this.state.getSafe('status')) !== GatherStatus.Summoning) {
      return 'Cancelled';
    }
    const summonedClients = await this.queue.range(0, this.config.size);
    const missingClients = summonedClients.filter((id) => !clientUIds.includes(id));

    if (missingClients.length === 0) {
      this.emit('summonComplete', summonedClients, this);
      await this.state.set({ status: 'Starting', summonedAt: null });
      return 'OK';
    }

    if (await this.hasTimedOut()) {
      for (const clientUId of missingClients) {
        await this.removeClientFromQueue(
          clientUId,
          'You failed to join server and have been removed from the queue.'
        );
      }
      await this.state.set({ status: 'Queueing', summonedAt: null });
      this.emit('summonFail', missingClients, this);
      return 'Fail';
    }

    return null;
  }
  async movePlayer(channelId: string, clientUId: string) {
    const managed = this.#managedChannelIds.has(channelId)
      ? this.#managedChannelIds
      : await this.#refreshManagedChannels();
    assertObj(
      managed.has(channelId) ? managed : undefined,
      `Refusing to move client outside BF2 Beta: ${channelId}`
    );
    const client = await this.ts.getClientByUid(clientUId);
    assertObj(client, `Client ${clientUId} not found in teamspeak client list`);
    if (!(await adminMoveClient(Number(client.clid), channelId))) {
      await this.ts.clientMove(client, channelId);
    }
    this.emit('playerMoved', clientUId, channelId, this);
  }

  async #refreshManagedChannels() {
    const channels = await this.ts.channelList();
    const managed = new Set<string>([MANAGED_CHANNEL_ROOT]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const channel of channels) {
        if (!managed.has(channel.cid) && managed.has(channel.pid)) {
          managed.add(channel.cid);
          changed = true;
        }
      }
    }
    setAdminManagedChannelIds(managed);
    this.#managedChannelIds = managed;
    return managed;
  }
  async initiateMatchChannels(
    matchId: number,
    team1: Array<string>,
    team2: Array<string>
  ) {
    await this.#refreshManagedChannels();
    const names = [`Match ${matchId} Team 1`, `Match ${matchId} Team 2`];
    const existingChannels = await this.ts.channelList();
    await Promise.all(
      names.map((name) =>
        existingChannels.some(
          (channel) => channel.name === name && channel.pid === BOT_CHANNEL
        )
          ? Promise.resolve()
          : adminCreateChannel(name, BOT_CHANNEL, { temporary: false }).then(() => undefined)
      )
    );

    // The voice-client raw command response has proven unreliable: its `cid`
    // can refer to an unrelated channel (including Random Games). Never use it
    // for movement. Resolve IDs from ServerQuery by exact name + exact parent.
    let refreshedChannels = await this.ts.channelList();
    let channelIds = names.map(
      (name) =>
        refreshedChannels.find(
          (channel) => channel.name === name && channel.pid === BOT_CHANNEL
        )?.cid ?? null
    );
    if (channelIds.some((cid) => cid === null)) {
      // Do not delete a successfully-created channel when its sibling fails.
      // A retry can safely discover and reuse it by name. In particular, broad
      // subtree membership must never be treated as authority to delete.
      await Promise.all(
        names.map(async (name, index) => {
          if (channelIds[index]) return;
          await this.ts.channelCreate(name, {
            cpid: BOT_CHANNEL,
            channelFlagTemporary: false,
            channelFlagSemiPermanent: true,
          });
        })
      );
      refreshedChannels = await this.ts.channelList();
      channelIds = names.map(
        (name) =>
          refreshedChannels.find(
            (channel) => channel.name === name && channel.pid === BOT_CHANNEL
          )?.cid ?? null
      );
      setAdminManagedChannelIds([
        ...(await this.#refreshManagedChannels()),
        ...channelIds.filter((cid): cid is string => cid !== null),
      ]);
    }

    const [channel1Id, channel2Id] = channelIds;
    assertString(channel1Id, 'Failed to create Team 1 channel');
    assertString(channel2Id, 'Failed to create Team 2 channel');
    this.#managedChannelIds.add(channel1Id);
    this.#managedChannelIds.add(channel2Id);
    setAdminManagedChannelIds(this.#managedChannelIds);

    await this.queue.popBulk(this.config.size);
    for (const player of team1) {
      await this.movePlayer(channel1Id, player);
    }
    for (const player of team2) {
      await this.movePlayer(channel2Id, player);
    }

    for (const cid of [channel1Id, channel2Id]) {
      await this.makeChannelTemporary(cid);
    }
    this.emit('gatherStarted', matchId, team1, team2, this);
    return [channel1Id, channel2Id] as const;
  }

  /**
   * Post a message into a channel rather than to one client.
   *
   * Used to tell both teams something about the match they are now in, which a
   * private message to each player would only repeat eight times.
   */
  async messageChannel(cid: string, text: string) {
    const channel = await this.ts.getChannelById(cid);
    assertObj(channel, `Channel ${cid} not found`);
    await channel.message(text);
  }

  /**
   * Let the server delete this channel once the last client leaves.
   *
   * Only safe to call after the channel has been populated: a temporary channel
   * with nobody in it is removed immediately, which is why match channels are
   * created semi-permanent and flipped here rather than created temporary.
   *
   * The admin path needs adminListChannels() to confirm the channel is a match
   * channel, so it fails wherever the voice client lacks that permission; the
   * ServerQuery fallback is what actually applies the flags there.
   */
  async makeChannelTemporary(cid: string) {
    if (!(await adminEditChannelFlags(cid, { temporary: true, semiPermanent: false }))) {
      const channel = await this.ts.getChannelById(cid);
      assertObj(channel, `Match channel ${cid} not found`);
      await channel.edit({
        channelFlagTemporary: true,
        channelFlagSemiPermanent: false,
      });
    }
  }

  /**
   * Channel the teams are gathered into once their match is over, named with
   * the ticket result so the score survives in the channel list.
   *
   * Reuses an existing channel of the same name rather than duplicating it, and
   * resolves the id from ServerQuery by exact name and parent for the same
   * reason initiateMatchChannels() does: the voice client's create response can
   * name an unrelated channel.
   *
   * Left semi-permanent here. The caller moves players in and then calls
   * makeChannelTemporary(), so the channel outlives the move but still cleans
   * itself up once the last player leaves.
   */
  async createResultsChannel(name: string): Promise<string | null> {
    const findChannel = async () =>
      (await this.ts.channelList()).find(
        (channel) => channel.name === name && channel.pid === BOT_CHANNEL
      )?.cid ?? null;

    let cid = await findChannel();
    if (!cid) {
      await adminCreateChannel(name, BOT_CHANNEL, { temporary: false });
      cid = await findChannel();
    }
    if (!cid) {
      await this.ts.channelCreate(name, {
        cpid: BOT_CHANNEL,
        channelFlagTemporary: false,
        channelFlagSemiPermanent: true,
      });
      cid = await findChannel();
    }
    if (!cid) {
      return null;
    }

    // movePlayer() refuses any destination outside the managed subtree.
    this.#managedChannelIds.add(cid);
    setAdminManagedChannelIds(this.#managedChannelIds);
    return cid;
  }
  async removeClientFromQueue(clientUId: string, reason: string) {
    const client = await this.ts.getClientByUid(clientUId);
    assertObj(client, `Client ${clientUId} not found in teamspeak client list`);
    await this.messageClient(client, reason);
    await this.queue.remove(clientUId);
    await this.movePlayer(MANAGED_CHANNEL_ROOT, clientUId);
    this.emit('playerRemoved', clientUId, reason, this);
  }
  async messageClient(
    client: string | TeamSpeakClient | undefined,
    message: string,
    poke?: string
  ) {
    const resolvedClient =
      typeof client === 'string' ? await this.ts.getClientByUid(client) : client;
    assertObj(
      resolvedClient,
      `Client ${resolvedClient}: Failed to send message, client not found in teamspeak client list`
    );
    await resolvedClient.poke(poke ?? message);
    await resolvedClient.message(message);
  }
}

function getRegisterTsIdMessage(id: string) {
  return `You must link your Teamspeak Id to your Discord User before queueing. Register Discord Id at ${api
    .web()
    .teamspeakPage(id)} and rejoin channel.`;
}

function getRegisterTsIdPoke(id: string) {
  return `Register Teamspeak Id at ${api.web().teamspeakPage(id)}`;
}
function getRegisterKeyhashMessage() {
  return `You must link your BF2 keyhash to your Discord User before queuing. Register Discord Id at ${api
    .web()
    .teamspeakPage()} and rejoin channel.`;
}
function getRegisterKeyhashPoke() {
  return `Register keyhash at ${api.web().teamspeakPage()}`;
}
function getSummonMessage(address: string) {
  return `Join ${address} within 2 minutes or be removed from the gather.`;
}
