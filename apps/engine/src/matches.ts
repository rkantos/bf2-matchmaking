import { client, verifyResult, verifySingleResult } from '@bf2-matchmaking/supabase';
import { info } from '@bf2-matchmaking/logging';
import {
  isDiscordMatch,
  MatchesJoined,
  MatchesRow,
  MatchStatus,
  WebhookPostgresUpdatePayload,
} from '@bf2-matchmaking/types';
import { sendMatchDraftingMessage, sendMatchInfoMessage } from './message-service';
import { assignMatchPlayerTeams, shuffleArray } from '@bf2-matchmaking/utils';

export const handleInsertedMatch = (match: MatchesRow) => {
  info('handleInsertedMatch', `New match ${match.id}`);
};

export const handleUpdatedMatch = async (
  payload: WebhookPostgresUpdatePayload<MatchesRow>
) => {
  info(
    'handleUpdatedMatch',
    `Match ${payload.record.id} updated. ${payload.old_record.status} -> ${payload.record.status}`
  );
  const matchJoined = await client().getMatch(payload.record.id).then(verifySingleResult);
  if (isDraftingUpdate(payload)) {
    if (matchJoined.pick === 'random') {
      await setRandomTeams(matchJoined);
    } else {
      await setMatchCaptains(matchJoined);
      const matchWithCaptains = await client()
        .getMatch(payload.record.id)
        .then(verifySingleResult);
      if (isDiscordMatch(matchWithCaptains)) {
        await sendMatchDraftingMessage(matchWithCaptains);
      }
    }
  } else if (isClosedUpdate(payload) || isDeletedUpdate(payload)) {
    const { data: config } = await client().getMatchConfigByChannelId(
      matchJoined.channel?.channel_id
    );
    if (config) {
      const { data } = await client().getStagingMatchesByChannelId(
        config.channel.channel_id
      );
      if (!data || data.length === 0) {
        await client().services.createMatchFromConfig(config);
      }
    }
  } else {
    if (isDiscordMatch(matchJoined)) {
      await sendMatchInfoMessage(matchJoined);
    }
  }
};

export const handleDeletedMatch = (oldMatch: Partial<MatchesRow>) => {
  info('handleDeletedMatch', `Match ${oldMatch.id} removed`);
};

const setRandomTeams = async (match: MatchesJoined) => {
  await Promise.all(
    assignMatchPlayerTeams(match.players).map(({ playerId, team }) =>
      client().updateMatchPlayer(match.id, playerId, { team })
    )
  );
};

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
  record.status === MatchStatus.Summoning && old_record.status === MatchStatus.Drafting;
const isClosedUpdate = ({ record }: WebhookPostgresUpdatePayload<MatchesRow>) =>
  record.status === MatchStatus.Closed;

const isDeletedUpdate = ({ record }: WebhookPostgresUpdatePayload<MatchesRow>) =>
  record.status === MatchStatus.Deleted;
