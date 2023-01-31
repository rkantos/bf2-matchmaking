import { info, warn } from '@bf2-matchmaking/logging';
import {
  isDiscordMatch,
  MatchesJoined,
  MatchPlayersRow,
  MatchStatus,
  WebhookPostgresUpdatePayload,
} from '@bf2-matchmaking/types';
import { client, verifyResult, verifySingleResult } from '@bf2-matchmaking/supabase';
import {
  sendMatchDraftingMessage,
  sendMatchInfoMessage,
  sendMatchJoinMessage,
  sendMatchLeaveMessage,
} from './message-service';

export const handleInsertedMatchPlayer = async (matchPlayer: MatchPlayersRow) => {
  info('handleInsertedMatchPlayer', `Player ${matchPlayer.player_id} joined.`);
  const match = await client().getMatch(matchPlayer.match_id).then(verifySingleResult);

  if (isDiscordMatch(match)) {
    await sendMatchJoinMessage(matchPlayer, match);
  }

  if (match.status !== MatchStatus.Open) {
    warn(
      'handleInsertedMatchPlayer',
      `Player ${matchPlayer.player_id} joined a not open match(status="${match.status}").`
    );
  } else if (match.players.length === match.size) {
    info('handleInsertedMatchPlayer', `Setting match ${match.id} status to "drafting".`);
    await setMatchStatus(match, MatchStatus.Summoning);
  } else if (match.players.length > match.size) {
    warn(
      'handleInsertedMatchPlayer',
      `Player ${matchPlayer.player_id} joined full match ${match.id}. Removing player.`
    );
    client().deleteMatchPlayer(match.id, matchPlayer.player_id);
  }
};

export const handleUpdatedMatchPlayer = async (
  payload: WebhookPostgresUpdatePayload<MatchPlayersRow>
) => {
  if (isPickEvent(payload)) {
    await handlePlayerPicked(payload);
  } else if (isReadyEvent(payload)) {
    await handlePlayerReady(payload);
  }
};

export const handleDeletedMatchPlayer = async (
  oldMatchPlayer: Partial<MatchPlayersRow>
) => {
  info('handleDeletedMatchPlayer', `Player ${oldMatchPlayer.player_id} left.`);

  const match = await client().getMatch(oldMatchPlayer.match_id).then(verifySingleResult);
  if (isDiscordMatch(match)) {
    await sendMatchLeaveMessage(oldMatchPlayer, match);
  }
};

const setMatchStatus = async (match: MatchesJoined, status: MatchStatus) => {
  await client().updateMatch(match.id, { status }).then(verifyResult);
};

const setMatchStatusOngoing = async (match: MatchesJoined) => {
  client()
    .updateMatch(match.id, {
      status: MatchStatus.Ongoing,
      started_at: new Date().toISOString(),
    })
    .then(verifyResult);
};

const isPickEvent = (payload: WebhookPostgresUpdatePayload<MatchPlayersRow>) =>
  payload.old_record.team === null &&
  (payload.record.team === 'a' || payload.record.team === 'b');
const isReadyEvent = (payload: WebhookPostgresUpdatePayload<MatchPlayersRow>) =>
  !payload.old_record.ready && payload.record.ready;

const isFullMatch = (match: MatchesJoined) =>
  match.teams.filter((player) => player.team === 'a' || player.team === 'b').length ===
  match.size;

const isReadyMatch = (match: MatchesJoined) =>
  match.status === MatchStatus.Summoning && match.teams.every((player) => player.ready);

const handlePlayerPicked = async (
  payload: WebhookPostgresUpdatePayload<MatchPlayersRow>
) => {
  info(
    'handleUpdatedMatchPlayer',
    `Player ${payload.record.player_id} joined team ${payload.record.team}.`
  );
  const match = await client().getMatch(payload.record.match_id).then(verifySingleResult);

  if (match.status !== MatchStatus.Drafting) {
    warn(
      'handleUpdatedMatchPlayer',
      `Player ${payload.record.player_id} joined team for match not drafting(status="${match.status}").`
    );
  } else if (isFullMatch(match)) {
    info('handleUpdatedMatchPlayer', `Setting match ${match.id} status to "ongoing".`);
    await setMatchStatusOngoing(match);
    const { data: config } = await client().getMatchConfigByChannelId(
      match.channel?.channel_id
    );
    if (config) {
      info('handleUpdatedMatchPlayer', `Creating new match with config ${config.id}`);
      await client().services.createMatchFromConfig(config);
    }
  } else if (isDiscordMatch(match) && !payload.record.captain) {
    await sendMatchDraftingMessage(match);
  }
};

const handlePlayerReady = async (
  payload: WebhookPostgresUpdatePayload<MatchPlayersRow>
) => {
  const match = await client().getMatch(payload.record.match_id).then(verifySingleResult);
  if (isReadyMatch(match)) {
    await setMatchStatus(match, MatchStatus.Drafting);
  } else if (isDiscordMatch(match)) {
    await sendMatchInfoMessage(match);
  }
};
