import { info, logErrorMessage, verbose, warn } from '@bf2-matchmaking/logging';
import { isGatherPlayer, MatchesJoined, MatchStatus } from '@bf2-matchmaking/types';
import { GatherDraftMode, GatherStatus } from '@bf2-matchmaking/types/gather';
import {
  clearDraft,
  getDraftMode,
  startCaptainDraft,
} from '@bf2-matchmaking/services/gather-draft-service';
import { DateTime } from 'luxon';
import { ServerApi } from '@bf2-matchmaking/services/server/Server';
import {
  getServerOrInit,
  updateLiveServer,
} from '@bf2-matchmaking/services/server';
import { createRconsCache } from '@bf2-matchmaking/services/cache';
import {
  getAuthoritativeServers,
  reserveAuthoritativeServer,
} from '@bf2-matchmaking/services/server/state-api';
import {
  assertObj,
  assertString,
  SUMMON_POLL_INTERVAL_SECONDS,
} from '@bf2-matchmaking/utils';
import { wait } from '@bf2-matchmaking/utils/async';
import { gather } from '@bf2-matchmaking/redis/gather';
import {
  GatherStartedListener,
  PlayerLeftListener,
  PlayersSummonedListener,
  TeamSpeakGather,
} from '@bf2-matchmaking/teamspeak/gather';
import { syncConfig } from '@bf2-matchmaking/services/config';
import {
  getPlayerList,
  switchPlayers,
  verifyRconResult,
} from '@bf2-matchmaking/services/rcon';
import { players } from '../lib/supabase';
import { parseError } from '@bf2-matchmaking/services/error';
import { matchApi, matchService } from '../lib/match';
import { getMatchTeam } from './gather-utils';
import { startQueueMessage } from './queue-message';
import { stream } from '@bf2-matchmaking/redis/stream';
import { topic } from '@bf2-matchmaking/redis/topic';
import { GatherDraftState } from '@bf2-matchmaking/types/gather';
import { MANAGED_CHANNEL_ROOT } from '@bf2-matchmaking/teamspeak';
import { resultsChannelName } from '@bf2-matchmaking/teamspeak/admin';
import {
  client as createSupabaseApi,
  createServiceClient,
  verifyResult,
} from '@bf2-matchmaking/supabase';
import { ServerStatus } from '@bf2-matchmaking/types/server';

const serviceClient = createSupabaseApi();
const database = createServiceClient();

export async function initGather(configId: number) {
  try {
    const config = await syncConfig(configId);
    // A standalone gather deployment has its own Redis and does not run the
    // production reset-server job. Seed its RCON credentials before resolving
    // the configured gather servers, then keep their live data fresh for the
    // staging UI.
    await createRconsCache();
    const address = await findGatherServer();
    assertString(address, 'No idle server found');

    const tsGather = await TeamSpeakGather.init(config);
    addEventLogging(tsGather);
    await addEventStream(tsGather);
    await initDraftCompleteListener(configId, tsGather);
    await initMatchTeardownListener(configId, tsGather);
    await initTestQueueSyncListener(configId, tsGather);
    const configuredGather = tsGather
      .on('playerJoining', handlePlayerJoining)
      .on('playerLeft', handlePlayerLeftDuringDraft)
      .on('playersSummoned', handlePlayersSummoned)
      .on('summonComplete', handleSummonComplete)
      .on('gatherStarted', handleGatherStarted)
      .on('error', (e) => {
        logErrorMessage(`Gather ${configId}: Error`, e);
      });
    startGatherServerPolling();
    startQueueMessage(configId, config.size);

    // initQueue resets the state to Queueing. Preserve an in-progress (or
    // completed-but-not-yet-applied) captain draft across engine restarts so
    // the UI and retry path do not silently abandon the selected teams.
    if (await gather.getDraft(configId).get()) {
      await tsGather.state.set({ status: GatherStatus.Drafting, address });
      return;
    }
    await configuredGather.initQueue(address);
    const queueSync = setInterval(() => {
      void configuredGather.syncPhysicalQueue().catch((cause) =>
        warn(
          'syncPhysicalQueue',
          `Gather ${configId}: failed to reconcile TS queue: ${parseError(cause)}`
        )
      );
    }, 5_000);
    queueSync.unref();
  } catch (e) {
    logErrorMessage(`Gather ${configId}: Failed to initialize`, e);
  }
}

async function initTestQueueSyncListener(
  configId: number,
  tsGather: TeamSpeakGather
) {
  await topic(`gather:${configId}:test-ts-snapshot`).subscribe<{
    managedClientUIds: Array<string>;
    queuedClientUIds: Array<string>;
  }>(async ({ managedClientUIds, queuedClientUIds }) => {
    const managed = new Set(managedClientUIds);
    const queued = new Set(queuedClientUIds);
    const redisQueue = await tsGather.queue.range();

    for (const clientUId of redisQueue) {
      if (managed.has(clientUId) && !queued.has(clientUId)) {
        await tsGather.syncPlayerLeft(clientUId);
      }
    }
    for (const clientUId of queuedClientUIds) {
      if (!(await tsGather.queue.has(clientUId))) {
        await handlePlayerJoining(clientUId, tsGather);
      }
    }
  });
}

/**
 * Channel to gather a finished match's players into, named with its result.
 *
 * Returns null when the match has no results - a deleted or abandoned match
 * never produced any - and those players simply go back to the lobby as before.
 * Also null if the channel could not be created, so teardown degrades to the
 * old behaviour rather than stranding players in their team channels.
 */
async function resultsChannel(match: MatchesJoined, tsGather: TeamSpeakGather) {
  try {
    const { data: results } = await serviceClient.getMatchResultsByMatchId(match.id);
    const team1 = results?.find((result) => result.team.id === match.home_team.id);
    const team2 = results?.find((result) => result.team.id === match.away_team.id);
    if (!team1 || !team2) return null;

    return await tsGather.createResultsChannel(
      resultsChannelName(match.id, team1.tickets, team2.tickets)
    );
  } catch (e) {
    warn(
      'resultsChannel',
      `Match ${match.id}: could not create results channel: ${parseError(e)}`
    );
    return null;
  }
}

async function initMatchTeardownListener(configId: number, tsGather: TeamSpeakGather) {
  await topic('gather:match-teardown').subscribe<{ matchId: number }>(
    async ({ matchId }) => {
      try {
        const match = await matchApi.get(matchId);
        if (!match || match.config.id !== configId) return;

        // A draft outlives its match when applying it fails part way through,
        // and the gather page renders whichever draft is stored regardless of
        // status - so a dead match leaves the drafting interface up over a
        // gather that has already moved on to the next queue.
        const draft = await gather.getDraft(configId).get();
        if (draft?.matchId === matchId) {
          await clearDraft(configId);
          info('initMatchTeardownListener', `Match ${matchId}: cleared its draft`);
        }

        const destination =
          (await resultsChannel(match, tsGather)) ?? MANAGED_CHANNEL_ROOT;

        let moved = 0;
        for (const player of match.players) {
          if (!player.teamspeak_id) continue;
          try {
            await tsGather.movePlayer(destination, player.teamspeak_id);
            moved += 1;
          } catch (e) {
            // Disconnected players require no teardown; they will enter the
            // queue normally when they return to TeamSpeak.
            verbose(
              'initMatchTeardownListener',
              `Match ${matchId}: could not return ${player.nick}: ${parseError(e)}`
            );
          }
        }
        if (destination !== MANAGED_CHANNEL_ROOT) {
          // Only now, with the players inside: a temporary channel nobody has
          // joined is deleted immediately. When no one could be moved that
          // deletion is what we want anyway, so this runs either way.
          try {
            await tsGather.makeChannelTemporary(destination);
          } catch (e) {
            verbose(
              'initMatchTeardownListener',
              `Match ${matchId}: could not set results channel temporary: ${parseError(e)}`
            );
          }
        }

        info(
          'initMatchTeardownListener',
          `Match ${matchId}: moved ${moved} player(s) to ${
            destination === MANAGED_CHANNEL_ROOT ? 'BF2 Beta' : 'the results channel'
          }`
        );
      } catch (e) {
        logErrorMessage(`Match ${matchId}: TeamSpeak teardown failed`, e);
      }
    }
  );
}

const cancellingDrafts = new Set<number>();

/**
 * A captain draft is valid only while every summoned player remains in the
 * TeamSpeak queue. Cancel the abandoned match and preserve the other queued
 * clients so they can immediately wait for a replacement player.
 */
const handlePlayerLeftDuringDraft: PlayerLeftListener = async (
  clientUId,
  tsGather
) => {
  const configId = tsGather.config.id;
  if (cancellingDrafts.has(configId)) return;
  if ((await tsGather.state.getSafe('status')) !== GatherStatus.Drafting) return;

  const draft = await gather.getDraft(configId).get();
  if (!draft || !draft.players.some((player) => player.teamspeakId === clientUId)) {
    return;
  }

  cancellingDrafts.add(configId);
  try {
    // Clear first so a late captain pick cannot publish draft-complete while
    // the departure is being handled.
    await clearDraft(configId);
    await matchApi.remove(draft.matchId, MatchStatus.Deleted);
    const address = await findGatherServer();
    assertString(address, 'No gather server configured');
    await tsGather.nextQueue(address);
    info(
      'handlePlayerLeftDuringDraft',
      `Gather ${configId}: cancelled draft ${draft.matchId} after ${clientUId} left`
    );
  } catch (e) {
    logErrorMessage(`Gather ${configId}: Failed to cancel abandoned draft`, e);
  } finally {
    cancellingDrafts.delete(configId);
  }
};

async function initDraftCompleteListener(configId: number, tsGather: TeamSpeakGather) {
  const handle = async (draft: GatherDraftState) => {
    if (draft.pool.length !== 0) return;
    try {
      const address = await tsGather.state.getSafe('address');
      const teamspeakId = (playerId: string) => {
        const player = draft.players.find((candidate) => candidate.playerId === playerId);
        assertObj(player, `Draft player ${playerId} has no TeamSpeak identity`);
        return player.teamspeakId;
      };
      // Moving players out of the queue normally looks like a departure. Mark
      // this legitimate transition so draft-abandonment handling ignores it.
      await tsGather.state.set({ status: GatherStatus.Starting });
      await tsGather.initiateMatchChannels(
        draft.matchId,
        draft.team1.map(teamspeakId),
        draft.team2.map(teamspeakId)
      );
      await startGatherMatch(draft.matchId, address);
      await clearDraft(configId);
      info('initDraftCompleteListener', `Gather ${configId}: completed draft ${draft.matchId}`);
    } catch (e) {
      await tsGather.state.set({ status: GatherStatus.Drafting });
      logErrorMessage(`Gather ${configId}: Failed to apply completed draft`, e);
    }
  };

  await topic(`gather:${configId}:draft-complete`).subscribe(handle);

  // Redis pub/sub is intentionally ephemeral. Recover a completed draft after
  // an engine restart or one that predates this listener implementation.
  const existing = await gather.getDraft(configId).get();
  if (existing?.pool.length === 0) await handle(existing);
}

const handlePlayerJoining = async (clientUId: string, gather: TeamSpeakGather) => {
  const { data: player, error } = await players.getByTeamspeakId(clientUId);
  if (error) {
    warn(
      'handlePlayerJoining',
      `Failed to fetch player ${clientUId} from database: ${error.message}`
    );
  }
  if (!player) {
    await gather.rejectPlayer(clientUId, 'tsid');
  } else if (!isGatherPlayer(player)) {
    await gather.rejectPlayer(clientUId, 'keyhash');
  } else {
    await gather.acceptPlayer(clientUId);
  }
};
/**
 * Which of the summoned players are currently on the BF2 server.
 *
 * Returns an empty list rather than throwing when RCON fails: an unreachable
 * server means nobody can be confirmed present, and swallowing the error here
 * keeps the poll below alive so the summon can still time out normally instead
 * of hanging forever.
 */
async function getConnectedClientUIds(
  server: string,
  clientUIds: Array<string>
): Promise<Array<string>> {
  try {
    const serverPlayers = await getPlayerList(server).then(verifyRconResult);
    const gatherPlayers = await Promise.all(clientUIds.map(getGatherPlayer));

    return gatherPlayers
      .filter((gp) => serverPlayers.some((sp) => sp.keyhash === gp.keyhash))
      .map((p) => p.teamspeak_id);
  } catch (e) {
    warn(
      'getConnectedClientUIds',
      `${server}: could not read player list, treating as nobody present: ${parseError(e)}`
    );
    return [];
  }
}

/**
 * Poll until every summoned player has joined the server, or the summon expires.
 *
 * Players are told to join *when this fires*, so a single check would always run
 * before anyone could possibly have connected - it only ever succeeded when the
 * players happened to already be on the server. verifySummon also owns the
 * timeout branch, so without re-invoking it the gather could never fail either,
 * and would sit in Summoning indefinitely.
 */
const handlePlayersSummoned: PlayersSummonedListener = async (
  server,
  clientUIds,
  gather
) => {
  try {
    while (true) {
      // Stop if something else moved the gather on (reset, abort, next queue).
      const status = await gather.state.getSafe('status');
      if (status !== GatherStatus.Summoning) {
        verbose(
          'handlePlayersSummoned',
          `Gather ${gather.config.id}: no longer summoning (${status}), stopping verification`
        );
        return;
      }

      const connectedClientUIdList = await getConnectedClientUIds(server, clientUIds);
      const result = await gather.verifySummon(connectedClientUIdList);
      if (result) {
        verbose(
          'handlePlayersSummoned',
          `Gather ${gather.config.id}: summon resolved as ${result}`
        );
        return;
      }

      await wait(SUMMON_POLL_INTERVAL_SECONDS);
    }
  } catch (e) {
    logErrorMessage(`Gather ${gather.config.id}: Failed to summon players`, e);
  }
};
const handleSummonComplete = async (
  clientUIds: Array<string>,
  gather: TeamSpeakGather
) => {
  try {
    const players = await Promise.all(clientUIds.map(getGatherPlayer));
    const match = await matchService.createMatch(players, gather.config);

    if ((await getDraftMode(gather.config.id)) === GatherDraftMode.Captains) {
      // Hand over to the captains. Channels and match start are deferred until
      // the draft completes, since teams are not settled yet.
      await startCaptainDraft(gather.config.id, match.id, players);
      // summonComplete is emitted before this asynchronous work finishes. A
      // persisted transition event gives every open /gather page a reliable
      // point at which router.refresh() can actually read the draft.
      await stream(`gather:${gather.config.id}:events`).addEvent('draftStarted', {
        matchId: match.id,
      });
      return;
    }

    const team1 = getMatchTeam(match, 1);
    const team2 = getMatchTeam(match, 2);
    // initiateMatchChannels emits gatherStarted, whose listener immediately
    // advances the state to the next queue. Preserve this match's server first.
    const address = await gather.state.getSafe('address');
    await gather.initiateMatchChannels(match.id, team1, team2);

    // Everyone summoned is confirmed on the server and teams are already
    // decided, so the match is live. Drafting is skipped deliberately: it means
    // captains are picking, which the ELO path does not do.
    await startGatherMatch(match.id, address);
  } catch (e) {
    logErrorMessage(`Gather ${gather.config.id}: Failed to complete summon`, e);
  }
};

/**
 * Move a gather match from Summoning to Ongoing and bind it to its server.
 *
 * Previously nothing advanced a gather match past Summoning: it sat there with
 * a null started_at and no server attached until the closeOldMatches job swept
 * it up. The pubobot flow and POST /matches/:id/start both do this; the gather
 * had no equivalent.
 */
async function startGatherMatch(matchId: number, address: string | null) {
  if (address) {
    // Keep the original deployment's server registry authoritative while the
    // staging queue and test-client state remain on their isolated Redis.
    await reserveAuthoritativeServer(matchId, address);
  }
  await matchApi.update(matchId).commit({
    status: MatchStatus.Ongoing,
    started_at: DateTime.now().toISO(),
  });

  if (address) {
    // Match pages resolve their server from Supabase's match_servers relation;
    // Redis alone is only enough for the live scheduler.
    await serviceClient.deleteAllMatchServers(matchId).then(verifyResult);
    await serviceClient
      .createMatchServers(matchId, { server: address })
      .then(verifyResult);
    await ServerApi.setMatch(address, matchId);
    await assignBf2Teams(matchId, address).catch((e) =>
      logErrorMessage(`Match ${matchId}: Failed to assign BF2 teams`, e)
    );
  } else {
    warn('startGatherMatch', `Match ${matchId}: no gather address to bind server to`);
  }

  matchApi.log(matchId, `Started from gather${address ? ` on ${address}` : ''}`);
  info('startGatherMatch', `Match ${matchId} set to Ongoing on ${address}`);
}

/**
 * Mirror the finalized matchmaking sides onto BF2's team 1/team 2.
 *
 * bf2cc switchplayer toggles a player, so only players whose keyhash is on the
 * wrong side are sent. The command applies after a short delay; re-reading the
 * player list prevents us from toggling somebody twice based on stale state.
 */
export async function assignBf2Teams(matchId: number, address: string) {
  const match = await matchApi.get(matchId);
  assertObj(match, `Match ${matchId} not found for BF2 team assignment`);
  const desiredTeamByKeyhash = new Map(
    match.teams.flatMap((matchPlayer) => {
      const player = match.players.find(
        (candidate) => candidate.id === matchPlayer.player_id
      );
      return player?.keyhash
        ? ([
            // Match-page home/team 1 starts on BF2's team 2; away/team 2
            // starts on BF2's team 1. The factions swap on the second round.
            [player.keyhash, matchPlayer.team === 1 ? '2' : '1'],
          ] as Array<[string, string]>)
        : [];
    })
  );

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const serverPlayers = await getPlayerList(address).then(verifyRconResult);
    const wrongTeam = serverPlayers.filter((player) => {
      const desired = desiredTeamByKeyhash.get(player.keyhash);
      return desired !== undefined && player.getTeam !== desired;
    });
    if (wrongTeam.length === 0) {
      info('assignBf2Teams', `Match ${matchId}: all BF2 players are on their assigned teams`);
      return;
    }

    const results = await switchPlayers(
      address,
      wrongTeam.map((player) => player.index)
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      throw new Error(`bf2cc switchplayer failed: ${failed.error.message}`);
    }
    info(
      'assignBf2Teams',
      `Match ${matchId}: switching ${wrongTeam.length} BF2 player(s), attempt ${attempt}`
    );
    await wait(4);
  }

  const remaining = await getPlayerList(address)
    .then(verifyRconResult)
    .then((serverPlayers) =>
      serverPlayers.filter((player) => {
        const desired = desiredTeamByKeyhash.get(player.keyhash);
        return desired !== undefined && player.getTeam !== desired;
      })
    );
  if (remaining.length > 0) {
    throw new Error(
      `${remaining.length} BF2 player(s) remained on the wrong team after retries`
    );
  }
}

const handleGatherStarted: GatherStartedListener = async (
  matchId,
  team1,
  team2,
  gather
) => {
  try {
    const previousAddress = await gather.state.getSafe('address');
    const address = await findGatherServer(previousAddress ?? undefined);
    assertString(address, 'No idle server found');
    await gather.nextQueue(address);
  } catch (e) {
    logErrorMessage(`Gather ${gather.config.id}: Failed to start next queue`, e);
  }
};

/**
 * Select an idle gather server, optionally restricted to an explicit E2E
 * allowlist. The previous match's address is excluded even before its
 * asynchronous gatherStarted listener finishes marking that server active.
 */
async function findGatherServer(exclude?: string) {
  const configured = (
    process.env.GATHER_SERVER_ADDRESSES || process.env.GATHER_SERVER_ADDRESS || ''
  )
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
    .filter((address) => address !== exclude);

  if (configured.length > 0) {
    // Redis is deliberately isolated between production and staging, while
    // match_servers is shared. Excluding servers attached to an ongoing match
    // prevents the staging gather from selecting a production match server.
    const ongoingMatches = await serviceClient
      .getMatchesWithStatus(MatchStatus.Ongoing)
      .then(verifyResult);
    const occupiedServers = new Set(
      ongoingMatches.length === 0
        ? []
        : await database
            .from('match_servers')
            .select('server')
            .in(
              'id',
              ongoingMatches.map((match) => match.id)
            )
            .then(verifyResult)
            .then((rows) => rows.map((row) => row.server))
    );
    const authoritativeServers = await getAuthoritativeServers();
    const authoritativeByAddress = new Map(
      authoritativeServers?.map((server) => [server.address, server]) || []
    );
    const candidates = await Promise.all(
      configured.map(async (address) => ({
        address,
        server:
          occupiedServers.has(address) ||
          (authoritativeServers !== null &&
            authoritativeByAddress.get(address)?.status !== ServerStatus.IDLE)
            ? null
            : await getServerOrInit(address),
      }))
    );
    return candidates.find(({ server }) => server?.status === ServerStatus.IDLE)?.address;
  }

  return ServerApi.findIdle(exclude ? [exclude] : []);
}

let gatherServerPoll: NodeJS.Timeout | null = null;

function startGatherServerPolling() {
  if (gatherServerPoll) return;
  const addresses = (
    process.env.GATHER_SERVER_ADDRESSES || process.env.GATHER_SERVER_ADDRESS || ''
  )
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  if (addresses.length === 0) return;

  const configuredSeconds = Number(process.env.GATHER_SERVER_POLL_SECONDS || 10);
  const seconds = Number.isFinite(configuredSeconds)
    ? Math.max(5, configuredSeconds)
    : 10;
  gatherServerPoll = setInterval(() => {
    void Promise.all(
      addresses.map((address) =>
        updateLiveServer(address).catch((cause) => {
          warn(
            'startGatherServerPolling',
            `${address}: failed to refresh gather server: ${parseError(cause)}`
          );
          return null;
        })
      )
    );
  }, seconds * 1_000);
  gatherServerPoll.unref();
}

async function getGatherPlayer(clientUId: string) {
  const cachedPlayer = await gather.getPlayer(clientUId);
  if (cachedPlayer) {
    return cachedPlayer;
  }
  info('getGatherPlayerCached', `Cache miss for player ${clientUId}`);

  const { data: player } = await players.getByTeamspeakId(clientUId);
  assertObj(player, `Player ${clientUId} not found in database`);

  if (isGatherPlayer(player)) {
    await gather.setPlayer(player);
    return player;
  }
  throw new Error(`Player ${clientUId} is not a valid GatherPlayer`);
}

async function getGatherPlayerSafe(clientUId: string) {
  try {
    return await getGatherPlayer(clientUId);
  } catch (e) {
    warn('getGatherPlayerSafe', parseError(e));
    return null;
  }
}

async function addEventStream(ts: TeamSpeakGather) {
  const events = await stream(`gather:${ts.config.id}:events`);
  ts.on('initiated', async (clientUIds, address) => {
    await events.addEvent('initiated', { clientUIds, address });
  });
  ts.on('playerJoining', async (clientUId) => {
    const player = await getGatherPlayerSafe(clientUId);
    await events.addEvent('playerJoining', {
      clientUId,
      nick: player?.nick || clientUId,
    });
  });
  ts.on('playerJoined', async (clientUId) => {
    const player = await getGatherPlayerSafe(clientUId);
    await events.addEvent('playerJoined', { clientUId, nick: player?.nick || clientUId });
  });
  ts.on('playerRejected', async (clientUId, reason) => {
    const player = await getGatherPlayerSafe(clientUId);
    await events.addEvent('playerRejected', {
      clientUId,
      reason,
      nick: player?.nick || clientUId,
    });
  });
  ts.on('playerLeft', async (clientUId) => {
    const player = await getGatherPlayerSafe(clientUId);
    await events.addEvent('playerLeft', { clientUId, nick: player?.nick || clientUId });
  });
  ts.on('playersSummoned', async (address, clientUIds) => {
    await events.addEvent('playersSummoned', { address, clientUIds });
  });
  ts.on('playerRemoved', async (clientUId, reason) => {
    const player = await getGatherPlayerSafe(clientUId);
    await events.addEvent('playerRemoved', {
      clientUId,
      reason,
      nick: player?.nick || clientUId,
    });
  });
  ts.on('summonComplete', async (clientUIds) => {
    await events.addEvent('summonComplete', { clientUIds });
  });
  ts.on('playerMoved', async (clientUId, toChannel) => {
    const player = await getGatherPlayerSafe(clientUId);
    await events.addEvent('playerMoved', {
      clientUId,
      toChannel,
      nick: player?.nick || clientUId,
    });
  });
  ts.on('gatherStarted', async (matchId) => {
    await events.addEvent('gatherStarted', { matchId });
  });
  ts.on('nextQueue', async (clientUIds, address, gather) => {
    await events.addEvent('nextQueue', { clientUIds, address });
  });
  ts.on('summonFail', async (missingClientUIds) => {
    await events.addEvent('summonFail', { missingClientUIds });
  });
}

function addEventLogging(ts: TeamSpeakGather) {
  ts.on('initiated', (clientUIds, address) => {
    verbose(
      'Gather',
      `Gather initiated on ${address} with players: ${clientUIds.join(', ')}`
    );
  });
  ts.on('playerJoining', (clientUId) => {
    verbose('Gather', `Player joining gather: ${clientUId}`);
  });
  ts.on('playerJoined', (clientUId) => {
    verbose('Gather', `Player joined gather: ${clientUId}`);
  });
  ts.on('playerRejected', (clientUId, reason) => {
    verbose('Gather', `Player ${clientUId} rejected from gather: ${reason}`);
  });
  ts.on('playerLeft', (clientUId) => {
    verbose('Gather', `Player left gather: ${clientUId}`);
  });
  ts.on('playersSummoned', (server, clientUIds) => {
    verbose('Gather', `Players summoned to server ${server}: ${clientUIds.join(', ')}`);
  });
  ts.on('summonComplete', (clientUIds) => {
    verbose('Gather', `Summon complete with players: ${clientUIds.join(', ')}`);
  });
  ts.on('playerMoved', (clientUId, toChannel) => {
    verbose('Gather', `Player ${clientUId} moved to ${toChannel}`);
  });
  ts.on('gatherStarted', (matchId) => {
    verbose('Gather', `Gather started for match ${matchId}`);
  });
  ts.on('nextQueue', (clientUIds, address, gather) => {
    verbose(
      'Gather',
      `Next queue initiated on ${address} with players: ${clientUIds.join(', ')}`
    );
  });
  ts.on('summonFail', (missingClientUIds) => {
    verbose('Gather', `Summon failed, missing players: ${missingClientUIds.join(', ')}`);
  });
}
