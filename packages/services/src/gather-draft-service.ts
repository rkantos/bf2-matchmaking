import { gather } from '@bf2-matchmaking/redis/gather';
import {
  GatherDraftMode,
  GatherDraftPlayer,
  GatherDraftState,
  GatherStatus,
} from '@bf2-matchmaking/types/gather';
import { GatherPlayer, MatchStatus } from '@bf2-matchmaking/types';
import {
  applyPick,
  createDraftState,
  isDraftComplete,
  pickRandomCaptains,
  snakePickOrder,
} from './gather-draft';
import { info, logErrorMessage } from '@bf2-matchmaking/logging';
import { client, createServiceClient } from '@bf2-matchmaking/supabase';
import { createMatchApi } from './match/match-api';
import { ratingsConfigId } from './player-service';
import { topic } from '@bf2-matchmaking/redis/topic';

// Constructed here rather than injected so both the engine (which starts
// drafts) and the api (which records picks) share one implementation.
const matchApi = createMatchApi(createServiceClient());

/**
 * Captain-draft flow for the gather.
 *
 * Only used when the gather's draftMode setting is 'captains'; the default
 * 'elo' path builds balanced teams automatically and never pauses here.
 */

export async function getDraftMode(configId: number): Promise<GatherDraftMode> {
  const stored = await gather.getSettings(configId).getSafe('draftMode');
  return stored === GatherDraftMode.Captains
    ? GatherDraftMode.Captains
    : GatherDraftMode.Elo;
}

/**
 * Ratings drive nothing during a captain draft, but the UI shows them so
 * captains can pick informedly. Missing ratings fall back to 0 rather than
 * failing the draft.
 */
async function toDraftPlayers(
  players: Array<GatherPlayer>,
  configId: number
): Promise<Array<GatherDraftPlayer>> {
  const { data: ratings } = await client().getPlayerRatingsByIdList(
    players.map((p) => p.id),
    ratingsConfigId(configId)
  );

  return players.map((p) => ({
    playerId: p.id,
    teamspeakId: p.teamspeak_id,
    nick: p.nick,
    rating: ratings?.find((r) => r.player_id === p.id)?.rating ?? 0,
  }));
}

/**
 * Put a created match into captain drafting.
 *
 * The match already carries ELO teams from createMatch; they stand as a
 * fallback if the draft is never finished, and are overwritten wholesale when
 * it completes.
 */
export async function startCaptainDraft(
  configId: number,
  matchId: number,
  players: Array<GatherPlayer>
): Promise<GatherDraftState> {
  const draftPlayers = await toDraftPlayers(players, configId);
  const captains = pickRandomCaptains(draftPlayers);
  const state = createDraftState(matchId, draftPlayers, captains);

  await gather.getDraft(configId).set(state);
  await matchApi.update(matchId).commit({ status: MatchStatus.Drafting });
  await gather.getState(configId).set({ status: GatherStatus.Drafting });

  const names = captains.map(
    (id) => draftPlayers.find((p) => p.playerId === id)?.nick ?? id
  );
  info(
    'startCaptainDraft',
    `Match ${matchId}: draft started, captains ${names.join(' and ')}`
  );
  return state;
}

export async function getDraft(configId: number) {
  return gather.getDraft(configId).get();
}

/**
 * Record a pick and, once the pool empties, commit the drafted teams and start
 * the match.
 */
export async function pickDraftPlayer(
  configId: number,
  playerId: string,
  team: 1 | 2
): Promise<GatherDraftState> {
  const state = await gather.getDraft(configId).get();
  if (!state) {
    throw new Error('No draft in progress');
  }

  const next = applyPick(state, playerId, team);
  await gather.getDraft(configId).set(next);

  if (isDraftComplete(next)) {
    await completeDraft(configId, next);
  }
  return next;
}

/** Undo the most recent manual draft assignment without violating snake order. */
export async function undoLastDraftPick(
  configId: number,
  playerId: string
): Promise<GatherDraftState> {
  const state = await gather.getDraft(configId).get();
  if (!state) throw new Error('No draft in progress');
  if (isDraftComplete(state)) throw new Error('A completed draft cannot be changed');
  if (state.pickIndex === 0) throw new Error('No draft pick to undo');

  const order = snakePickOrder(state.players.length - state.captains.length);
  const team = order[state.pickIndex - 1];
  const selectedTeam = team === 1 ? state.team1 : state.team2;
  const lastPlayer = selectedTeam.at(-1);
  if (lastPlayer !== playerId || state.captains.includes(playerId)) {
    throw new Error('Only the most recent draft pick can be removed');
  }

  const next: GatherDraftState = {
    ...state,
    pool: [playerId, ...state.pool],
    team1: team === 1 ? state.team1.slice(0, -1) : state.team1,
    team2: team === 2 ? state.team2.slice(0, -1) : state.team2,
    pickIndex: state.pickIndex - 1,
    turn: team,
  };
  await gather.getDraft(configId).set(next);
  return next;
}

async function completeDraft(configId: number, state: GatherDraftState) {
  try {
    const matchPlayers = [
      ...state.team1.map((playerId, i) => ({
        match_id: state.matchId,
        player_id: playerId,
        team: 1,
        captain: playerId === state.captains[0],
        rating: state.players.find((p) => p.playerId === playerId)?.rating ?? 0,
      })),
      ...state.team2.map((playerId, i) => ({
        match_id: state.matchId,
        player_id: playerId,
        team: 2,
        captain: playerId === state.captains[1],
        rating: state.players.find((p) => p.playerId === playerId)?.rating ?? 0,
      })),
    ];

    // The API owns picks, but only the engine owns the live TeamSpeakGather
    // connection needed to create channels and move players. Publish the final
    // draft after persisting teams; the engine advances match/gather state.
    await matchApi.update(state.matchId).setTeams(matchPlayers).commit();
    await topic(`gather:${configId}:draft-complete`).publish(state);
    info('completeDraft', `Match ${state.matchId}: draft complete, notified engine`);
  } catch (e) {
    logErrorMessage(`Match ${state.matchId}: Failed to complete draft`, e);
    throw e;
  }
}

export async function clearDraft(configId: number) {
  await gather.getDraft(configId).del();
}
