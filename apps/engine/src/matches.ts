import { client, verifyResult, verifySingleResult } from '@bf2-matchmaking/supabase';
import { error, info } from '@bf2-matchmaking/logging';
import {
  DiscordMatch,
  isDiscordMatch,
  MatchesJoined,
  MatchesRow,
  MatchEvent,
  MatchPlayersRow,
  MatchStatus,
  WebhookPostgresUpdatePayload,
} from '@bf2-matchmaking/types';
import { sendMatchInfoMessage } from './message-service';
import { api, assignMatchPlayerTeams, shuffleArray } from '@bf2-matchmaking/utils';
import moment from 'moment';

export const handleInsertedMatch = async (match: MatchesRow) => {
  info('handleInsertedMatch', `New match ${match.id}`);
  const matchJoined = await client().getMatch(match.id).then(verifySingleResult);
  if (isDiscordMatch(matchJoined)) {
    return sendMatchInfoMessage(matchJoined);
  }
};

export const handleUpdatedMatch = async (
  payload: WebhookPostgresUpdatePayload<MatchesRow>
) => {
  info(
    'handleUpdatedMatch',
    `Match ${payload.record.id} updated. ${payload.old_record.status} -> ${payload.record.status}`
  );
  const match = await client().getMatch(payload.record.id).then(verifySingleResult);
  if (isSummoningUpdate(payload)) {
    await handleMatchSummon(match);
  }
  if (isDraftingUpdate(payload)) {
    return await handleMatchDraft(match);
  }
  if (isReopenUpdate(payload)) {
    return await handleMatchReopen(match);
  }
  if (isDiscordMatch(match) && (isClosedUpdate(payload) || isDeletedUpdate(payload))) {
    await handleMatchClosed(match);
  }
  if (isDiscordMatch(match)) {
    return sendMatchInfoMessage(match);
  }
};

export const handleDeletedMatch = (oldMatch: Partial<MatchesRow>) => {
  info('handleDeletedMatch', `Match ${oldMatch.id} removed`);
};

export const handleMatchReopen = (match: MatchesJoined) => {
  info('handleMatchReopen', `Match ${match.id} reopened`);

  return Promise.all(
    match.teams.map(({ player_id, match_id }) =>
      client().updateMatchPlayer(match_id, player_id, {
        team: null,
        captain: false,
        ready: false,
      })
    )
  );
};

export const handleMatchSummon = async (match: MatchesJoined) => {
  setTimeout(async () => {
    const timedOutMatch = await client().getMatch(match.id).then(verifySingleResult);
    if (timedOutMatch.status === MatchStatus.Summoning) {
      await removeMatchPlayers(timedOutMatch.teams.filter((player) => !player.ready));
      await setMatchOpen(timedOutMatch);
    }
  }, moment(match.ready_at).diff(moment()));

  if (isDiscordMatch(match) && match.channel.staging_channel) {
    try {
      const { error: err } = await api.bot().postMatchEvent(match.id, MatchEvent.Summon);
      if (err) {
        error('handleMatchSummon', err);
      }
    } catch (err) {
      error('handleMatchSummon', err);
    }
  }
};

export const handleMatchDraft = async (match: MatchesJoined) => {
  try {
    if (isDiscordMatch(match) && match.channel.staging_channel) {
      const { error: err } = await api.bot().postMatchEvent(match.id, MatchEvent.Summon);
      if (err) {
        error('handleMatchDraft', err);
      }
    }
  } catch (err) {
    error('handleMatchDraft', err);
  }

  if (match.pick === 'random') {
    await setRandomTeams(match);
  }
  if (match.pick === 'captain') {
    await setMatchCaptains(match);
    const matchWithCaptains = await client().getMatch(match.id).then(verifySingleResult);
    if (isDiscordMatch(matchWithCaptains)) {
      await sendMatchInfoMessage(matchWithCaptains);
    }
  }
};

export const handleMatchClosed = async (match: DiscordMatch) => {
  const { data: config } = await client().getMatchConfigByChannelId(
    match.channel.channel_id
  );
  if (config) {
    const { data } = await client().getStagingMatchesByChannelId(
      config.channel.channel_id
    );
    if (!data || data.length === 0) {
      await client().services.createMatchFromConfig(config);
    }
  }
};

const setRandomTeams = async (match: MatchesJoined) => {
  await Promise.all(
    assignMatchPlayerTeams(match.players).map(({ playerId, team }) =>
      client().updateMatchPlayer(match.id, playerId, { team })
    )
  );
};

const setMatchOpen = async (match: MatchesJoined) => {
  await client()
    .updateMatch(match.id, { status: MatchStatus.Open, ready_at: null })
    .then(verifyResult);
};

const removeMatchPlayers = (players: Array<MatchPlayersRow>) =>
  Promise.all(
    players.map(({ player_id, match_id }) =>
      client().deleteMatchPlayer(match_id, player_id)
    )
  );

const setMatchCaptains = async (match: MatchesJoined) => {
  const shuffledPlayers = shuffleArray(
    match.players.filter((player) => !player.username.includes('Test'))
  );
  if (shuffledPlayers.length < 2) {
    throw new Error('To few players for captain mode.');
  }
  info(
    'setMatchCaptains',
    `Setting player ${shuffledPlayers[0].id} as captain for team a.`
  );
  await client()
    .updateMatchPlayer(match.id, shuffledPlayers[0].id, {
      team: 'a',
      captain: true,
    })
    .then(verifyResult);
  info(
    'setMatchCaptains',
    `Setting player ${shuffledPlayers[1].id} as captain for team b.`
  );
  await client()
    .updateMatchPlayer(match.id, shuffledPlayers[1].id, {
      team: 'b',
      captain: true,
    })
    .then(verifyResult);
};

const isDraftingUpdate = ({
  record,
  old_record,
}: WebhookPostgresUpdatePayload<MatchesRow>) =>
  record.status === MatchStatus.Drafting && old_record.status === MatchStatus.Summoning;

const isSummoningUpdate = ({
  record,
  old_record,
}: WebhookPostgresUpdatePayload<MatchesRow>) =>
  record.status === MatchStatus.Summoning && old_record.status === MatchStatus.Open;

const isReopenUpdate = ({
  record,
  old_record,
}: WebhookPostgresUpdatePayload<MatchesRow>) =>
  record.status === MatchStatus.Open &&
  (old_record.status === MatchStatus.Summoning ||
    old_record.status === MatchStatus.Drafting ||
    old_record.status === MatchStatus.Ongoing);

const isClosedUpdate = ({
  record,
  old_record,
}: WebhookPostgresUpdatePayload<MatchesRow>) =>
  record.status === MatchStatus.Closed && old_record.status !== MatchStatus.Closed;

const isDeletedUpdate = ({
  record,
  old_record,
}: WebhookPostgresUpdatePayload<MatchesRow>) =>
  record.status === MatchStatus.Deleted && old_record.status !== MatchStatus.Deleted;
