import Router from '@koa/router';
import { Context } from 'koa';
import { GatherEventStream } from './GatherEventStream';
import { stream } from '@bf2-matchmaking/redis/stream';
import { isString, MatchStatus } from '@bf2-matchmaking/types';
import { waitForEvent } from './event-stream';
import { error, info } from '@bf2-matchmaking/logging';
import { gather } from '@bf2-matchmaking/redis/gather';
import { del, matchKeys } from '@bf2-matchmaking/redis/generic';
import {
  DEFAULT_SUMMON_TIMEOUT_MS,
  MAX_SUMMON_TIMEOUT_MS,
  MIN_SUMMON_TIMEOUT_MS,
  SUMMON_TIMEOUT_STEP_MS,
} from '@bf2-matchmaking/utils';
import { protect, protectMutation } from '../auth';
import { GatherDraftMode } from '@bf2-matchmaking/types/gather';
import {
  pickDraftPlayer,
  undoLastDraftPick,
} from '@bf2-matchmaking/services/gather-draft-service';
import { client, verifyResult } from '@bf2-matchmaking/supabase';
import { environmentFlag, isDevelopment } from '@bf2-matchmaking/utils';
import {
  list as listTeamspeakTestClients,
  queuedSize as queuedTeamspeakTestClientCount,
  setQueueChangedListener,
  setSize as setTeamspeakTestClientCount,
} from '@bf2-matchmaking/teamspeak-test/pool';
import {
  listBf2Clients,
  setBf2ClientCount,
} from '@bf2-matchmaking/teamspeak-test/bf2-pool';
import { fakePlayerStore } from '@bf2-matchmaking/services/rcon/fake-players';
import { getServerLiveInfo } from '@bf2-matchmaking/redis/servers';
import { topic } from '@bf2-matchmaking/redis/topic';
import { ServerApi } from '@bf2-matchmaking/services/server/Server';
import { matchApi } from '../lib/match';

export const gathersRouter = new Router({
  prefix: '/gathers',
});

gathersRouter.get('/:config', async (ctx: Context): Promise<void> => {
  const state = await gather.getState(ctx.params.config).getAll();
  const queue = await gather.getQueue(ctx.params.config).range();
  const players = await gather.getPlayersByIdentifier(queue);
  const events = await stream(`gather:${ctx.params.config}:events`).readEvents(true);
  const settings = await gather.getSettings(ctx.params.config).getAll();
  const storedTimeout = Number(settings?.summonTimeout);
  const summonTimeout =
    Number.isFinite(storedTimeout) && storedTimeout > 0
      ? storedTimeout
      : DEFAULT_SUMMON_TIMEOUT_MS;
  const draftMode =
    settings?.draftMode === GatherDraftMode.Captains
      ? GatherDraftMode.Captains
      : GatherDraftMode.Elo;
  const draft = await gather.getDraft(ctx.params.config).get();
  const draftPlayerIds = draft?.players.map((player) => player.playerId) ?? [];
  const draftPlayers = draftPlayerIds.length
    ? await client().getPlayersByIdList(draftPlayerIds).then(verifyResult)
    : [];
  const connectionPlayers = new Map(
    [...players, ...draftPlayers].map((player) => [player.id, player])
  );
  const liveInfo = state.address
    ? await getServerLiveInfo(state.address).catch(() => null)
    : null;
  const teamspeakIds = new Set(queue);
  // Headless BF2 clients appear in bf2cc pl with isValid=1 but isConnected=0.
  // Presence/keyhash is what summon verification also uses, so do not filter
  // them out by that unreliable flag. Include this API process's pool directly
  // as the live-info cache can lag while BF2's summary count catches up.
  const bf2Keyhashes = new Set([
    ...(liveInfo?.players.map((player) => player.keyhash) ?? []),
    ...listBf2Clients()
      .filter((player) => player.connected && player.address === state.address)
      .map((player) => player.keyhash),
  ]);
  const bf2TeamsByKeyhash = new Map(
    liveInfo?.players.map((player) => [player.keyhash, player.getTeam]) ?? []
  );
  const connections = Object.fromEntries(
    [...connectionPlayers.values()].map((player) => [
      player.id,
      {
        teamspeak: Boolean(
          player.teamspeak_id && teamspeakIds.has(player.teamspeak_id)
        ),
        bf2: Boolean(player.keyhash && bf2Keyhashes.has(player.keyhash)),
        bf2Team: player.keyhash
          ? bf2TeamsByKeyhash.get(player.keyhash)
          : undefined,
      },
    ])
  );
  ctx.body = {
    state,
    players,
    events,
    summonTimeout,
    draftMode,
    draft,
    testClients: {
      // Redis is continuously reconciled from the physical TS queue by the
      // engine. Count test identities there so API reloads do not make seven
      // still-connected recovered clients appear absent from the slider.
      teamspeak: isDevelopment()
        ? players.filter((player) => /^Test(?:[0-9]|1[0-5])$/.test(player.nick)).length
        : queuedTeamspeakTestClientCount(),
      bf2: listBf2Clients().length,
    },
    connections,
  };
});

const MAX_TEST_CLIENTS = 16;

function testClientCount(ctx: Context) {
  if (!isDevelopment() && !environmentFlag('ENABLE_GATHER_TEST_CLIENTS')) {
    ctx.throw(403, 'Gather test clients are disabled');
  }
  const count = Number(ctx.request.body.count);
  if (!Number.isInteger(count) || count < 0 || count > MAX_TEST_CLIENTS) {
    ctx.throw(400, `count must be an integer between 0 and ${MAX_TEST_CLIENTS}`);
  }
  return count;
}

async function testRoster() {
  const players = await client().getPlayers().then(verifyResult);
  return players
    .filter((player) => /^Test(?:[0-9]|1[0-5])$/.test(player.nick))
    .sort((a, b) => Number(a.nick.slice(4)) - Number(b.nick.slice(4)))
    .map((player) => ({
      playerId: player.id,
      nick: player.nick,
      teamspeakId: player.teamspeak_id,
      keyhash: player.keyhash,
    }));
}

gathersRouter.post(
  '/:config/test-clients/teamspeak',
  protect('match_admin'),
  async (ctx: Context) => {
    const count = testClientCount(ctx);
    const roster = await testRoster();
    const missing = roster.slice(0, count).find((player) => !player.teamspeakId);
    if (missing) ctx.throw(400, `${missing.nick} has no teamspeak_id`);
    const specs = roster.map(({ playerId, nick }) => ({ playerId, nick }));
    setQueueChangedListener(async (clients) => {
      await topic(`gather:${ctx.params.config}:test-ts-snapshot`).publish({
        managedClientUIds: roster
          .map((player) => player.teamspeakId)
          .filter((uid): uid is string => Boolean(uid)),
        queuedClientUIds: clients
          .filter((client) => client.connected && client.queued)
          .map((client) => client.uid),
      });
    });
    // Voice handshakes are intentionally staggered for TS anti-flood safety.
    // Do not hold a Next.js server action open for the whole sequence: server
    // actions from one browser are queued, which otherwise blocks the BF2
    // slider even though the two pools are independent.
    void setTeamspeakTestClientCount(count, specs)
      .then(async () => {
        // A completed draft may be waiting for clients that disappeared during
        // an API/engine restart. Once the requested voice clients are present,
        // wake the engine so it can retry the idempotent channel transition.
        const draft = await gather.getDraft(ctx.params.config).get();
        if (draft?.pool.length === 0) {
          await topic(`gather:${ctx.params.config}:draft-complete`).publish(draft);
        }
      })
      .catch((cause) => {
        error(
          `POST /gathers/${ctx.params.config}/test-clients/teamspeak`,
          cause
        );
      });
    ctx.status = 202;
    ctx.body = { count };
  }
);

gathersRouter.post(
  '/:config/test-clients/bf2',
  protect('match_admin'),
  async (ctx: Context) => {
    const count = testClientCount(ctx);
    const state = gather.getState(ctx.params.config);
    const address = await state.get('address');
    if (!address) ctx.throw(400, 'Select a BF2 gather server first');
    const roster = await testRoster();
    // Follow the live TS queue order. If a summoned client drops, an overflow
    // player replaces it; "8 BF2 clients" must then connect that replacement,
    // not remain hard-coded to Test0-Test7.
    const queuedTeamspeakIds = await gather
      .getQueue(ctx.params.config)
      .range();
    const rosterByTeamspeakId = new Map(
      roster
        .filter((player) => player.teamspeakId)
        .map((player) => [player.teamspeakId as string, player])
    );
    const queuedRoster = queuedTeamspeakIds
      .map((teamspeakId) => rosterByTeamspeakId.get(teamspeakId))
      .filter((player): player is (typeof roster)[number] => Boolean(player));
    const queuedPlayerIds = new Set(queuedRoster.map((player) => player.playerId));
    const orderedRoster = [
      ...queuedRoster,
      ...roster.filter((player) => !queuedPlayerIds.has(player.playerId)),
    ];
    const missing = orderedRoster.slice(0, count).find((player) => !player.keyhash);
    if (missing) ctx.throw(400, `${missing.nick} has no keyhash`);
    // The real headless clients replace the earlier RCON response-injection
    // seam. Keeping both would make every test player appear twice.
    await fakePlayerStore(address).del();
    const clients = await setBf2ClientCount(
      count,
      orderedRoster.map(({ playerId, nick, keyhash }) => ({
        playerId,
        nick,
        keyhash: keyhash as string,
      })),
      address
    );
    // Test clients own the local test server lifecycle. Releasing the final
    // client must also release the server's active-match reservation; otherwise
    // an empty old match blocks subsequent gather tests for up to three hours.
    const liveAfterResize = count === 0 ? await getServerLiveInfo(address).catch(() => null) : null;
    if (count === 0 && liveAfterResize?.players.length === 0) {
      const assignedServer = await ServerApi.get(address);
      if (assignedServer?.matchId) {
        await matchApi.remove(assignedServer.matchId, MatchStatus.Deleted);
      }
      await ServerApi.reset(address);
    }
    ctx.body = { count: clients.length, clients };
  }
);

/**
 * Switches between automatic ELO teams and a captain-run snake draft.
 *
 * Takes effect from the next completed summon; a draft already in progress is
 * unaffected.
 */
gathersRouter.post(
  '/:config/draft-mode',
  protect('match_admin'),
  async (ctx: Context) => {
    const { draftMode } = ctx.request.body;
    if (
      draftMode !== GatherDraftMode.Elo &&
      draftMode !== GatherDraftMode.Captains
    ) {
      ctx.throw(
        400,
        `draftMode must be "${GatherDraftMode.Elo}" or "${GatherDraftMode.Captains}"`
      );
    }
    await gather.getSettings(ctx.params.config).set({ draftMode });
    info(
      `POST /gathers/${ctx.params.config}/draft-mode`,
      `Draft mode set to ${draftMode} by ${ctx.request.user?.nick}`
    );
    ctx.body = { draftMode };
  }
);

/**
 * Records a captain's pick.
 *
 * Admin-gated so an admin can drive both sides while testing; the underlying
 * snake-draft rules still reject out-of-turn or duplicate picks.
 */
gathersRouter.post(
  '/:config/draft/pick',
  protect('match_admin'),
  async (ctx: Context) => {
    const { playerId, team } = ctx.request.body;
    if (!isString(playerId)) {
      ctx.throw(400, 'playerId is required');
    }
    if (team !== 1 && team !== 2) {
      ctx.throw(400, 'team must be 1 or 2');
    }
    try {
      const draft = await pickDraftPlayer(Number(ctx.params.config), playerId, team);
      await stream(`gather:${ctx.params.config}:events`).addEvent('draftUpdated', {
        matchId: draft.matchId,
        pickIndex: draft.pickIndex,
        complete: draft.pool.length === 0,
      });
      ctx.body = draft;
    } catch (e) {
      ctx.throw(400, e instanceof Error ? e.message : 'Failed to pick player');
    }
  }
);

gathersRouter.post(
  '/:config/draft/undo',
  protect('match_admin'),
  async (ctx: Context) => {
    const { playerId } = ctx.request.body;
    if (!isString(playerId)) ctx.throw(400, 'playerId is required');
    try {
      const draft = await undoLastDraftPick(Number(ctx.params.config), playerId);
      await stream(`gather:${ctx.params.config}:events`).addEvent('draftUpdated', {
        matchId: draft.matchId,
        pickIndex: draft.pickIndex,
        complete: false,
      });
      ctx.body = draft;
    } catch (e) {
      ctx.throw(400, e instanceof Error ? e.message : 'Failed to undo draft pick');
    }
  }
);

/**
 * Adjusts the window summoned players get to reach the BF2 server.
 *
 * Admin-gated: this changes live gather behaviour for everyone queueing, and
 * unlike the other gather routes it is not something a regular player should be
 * able to reach.
 */
gathersRouter.post(
  '/:config/summon-timeout',
  protect('match_admin'),
  async (ctx: Context) => {
    const summonTimeout = Number(ctx.request.body.summonTimeout);
    if (
      !Number.isFinite(summonTimeout) ||
      summonTimeout < MIN_SUMMON_TIMEOUT_MS ||
      summonTimeout > MAX_SUMMON_TIMEOUT_MS
    ) {
      ctx.throw(
        400,
        `summonTimeout must be between ${MIN_SUMMON_TIMEOUT_MS} and ${MAX_SUMMON_TIMEOUT_MS} ms`
      );
    }
    if (summonTimeout % SUMMON_TIMEOUT_STEP_MS !== 0) {
      ctx.throw(400, `summonTimeout must be a multiple of ${SUMMON_TIMEOUT_STEP_MS} ms`);
    }

    await gather.getSettings(ctx.params.config).set({
      summonTimeout: String(summonTimeout),
    });
    info(
      `POST /gathers/${ctx.params.config}/summon-timeout`,
      `Summon timeout set to ${summonTimeout}ms by ${ctx.request.user?.nick}`
    );
    ctx.body = { summonTimeout };
  }
);

gathersRouter.post(
  '/:config/address',
  protectMutation('match_admin'),
  async (ctx: Context) => {
  const state = gather.getState(ctx.params.config);
  if ((await state.get('status')) !== 'Queueing') {
    ctx.throw(400, 'Gather is not in queueing state');
  }
  ctx.body = await state.set({
    address: ctx.request.body.address,
  });
  }
);

/**
 * Drops cached gather players so the next lookup reads the database again.
 *
 * getGatherPlayer() caches by teamspeak id and only misses fall through to the
 * database. Nothing invalidates it except the register page, so a keyhash or
 * teamspeak id corrected directly in the database leaves summon verification
 * matching the old value - and that player can never be recognised as present,
 * however many times the summon repeats.
 *
 * Pass teamspeakIds to clear only those; omit it to clear the lot.
 */
gathersRouter.post(
  '/:config/players/cache/clear',
  protect('match_admin'),
  async (ctx: Context) => {
    const { teamspeakIds } = ctx.request.body ?? {};
    const keys = Array.isArray(teamspeakIds)
      ? teamspeakIds.filter(isString).map((id: string) => `gather:players:${id}`)
      : await matchKeys('gather:players:*');

    const cleared = keys.length ? await del(keys) : 0;
    info(
      `POST /gathers/${ctx.params.config}/players/cache/clear`,
      `Cleared ${cleared} cached gather player(s) by ${ctx.request.user?.nick}`
    );
    ctx.body = { cleared, keys };
  }
);

gathersRouter.get('/:config/events', async (ctx: Context) => {
  ctx.body = await stream(`gather:${ctx.params.config}:events`).readEvents(true);
});

gathersRouter.get('/:config/events/stream', (ctx) => {
  ctx.request.socket.setTimeout(0);
  ctx.req.socket.setNoDelay(true);
  ctx.req.socket.setKeepAlive(true);

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const sseStream = new GatherEventStream();

  const closeStream = waitForEvent(
    ctx.params.config,
    isString(ctx.query.start) ? ctx.query.start : '$',
    (event) => {
      sseStream.writeEvent(event);
    },
    (err) => {
      info(`GET /${ctx.params.config}/events/stream`, 'Event error');
      sseStream.destroy(err);
    }
  );

  const interval = setInterval(() => {
    sseStream.writeHeartbeat();
  }, 10000);

  sseStream.on('close', async () => {
    info(`GET /${ctx.params.config}/events/stream`, 'Stream close');
    clearInterval(interval);
    closeStream();
  });
  sseStream.on('error', (err) => {
    error(`GET /${ctx.params.config}/events/stream`, err);
  });
  sseStream.on('finish', () => {
    info(`GET /${ctx.params.config}/events/stream`, 'Stream finish');
  });

  ctx.status = 200;
  ctx.body = sseStream;
  sseStream.writeHeartbeat();
});
