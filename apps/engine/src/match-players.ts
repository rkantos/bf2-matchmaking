import { info, warn } from '@bf2-matchmaking/logging';
import {
  MatchesJoined,
  MatchPlayersRow,
  WebhookPostgresUpdatePayload,
} from '@bf2-matchmaking/types';
import { client, verifyResult, verifySingleResult } from '@bf2-matchmaking/supabase';
import {
  sendMatchDraftingMessage,
  sendMatchJoinMessage,
  sendMatchLeaveMessage,
  sendMatchPickMessage,
} from './message-service';

export const handleInsertedMatchPlayer = async (matchPlayer: MatchPlayersRow) => {
  info('handleInsertedMatchPlayer', `Player ${matchPlayer.player_id} joined.`);
  const match = await client().getMatch(matchPlayer.match_id).then(verifySingleResult);

  if (match.channel) {
    await sendMatchJoinMessage(matchPlayer, match);
  }

  if (match.status !== 'open') {
    warn(
      'handleInsertedMatchPlayer',
      `Player ${matchPlayer.player_id} joined a not open match(status="${match.status}").`
    );
  } else if (match.players.length === match.size && match.pick === 'captain') {
    info('handleInsertedMatchPlayer', `Setting match ${match.id} status to "picking".`);
    await setMatchStatusDrafting(match);
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
    info(
      'handleUpdatedMatchPlayer',
      `Player ${payload.record.player_id} joined team ${payload.record.team}.`
    );
    const match = await client()
      .getMatch(payload.record.match_id)
      .then(verifySingleResult);

    if (match.status !== 'picking') {
      warn(
        'handleUpdatedMatchPlayer',
        `Player ${payload.record.player_id} joined team for match not drafting(status="${match.status}").`
      );
    } else if (isFullMatch(match)) {
      info('handleUpdatedMatchPlayer', `Setting match ${match.id} status to "started".`);
      await setMatchStatusStarted(match);
      const { data: config } = await client().getMatchConfigByChannelId(
        match.channel.channel_id
      );
      if (config) {
        info('handleUpdatedMatchPlayer', `Creating new match with config ${config.id}`);
        await client().services.createMatchFromConfig(config);
      }
    } else if (match.channel && !payload.record.captain) {
      await sendMatchDraftingMessage(match);
    }
  }
};

export const handleDeletedMatchPlayer = async (
  oldMatchPlayer: Partial<MatchPlayersRow>
) => {
  info('handleDeletedMatchPlayer', `Player ${oldMatchPlayer.player_id} left.`);

  const match = await client().getMatch(oldMatchPlayer.match_id).then(verifySingleResult);
  if (match.channel) {
    await sendMatchLeaveMessage(oldMatchPlayer, match);
  }
};

const setMatchStatusDrafting = async (match: MatchesJoined) => {
  await client().updateMatch(match.id, { status: 'picking' }).then(verifyResult);
};

const setMatchStatusStarted = async (match: MatchesJoined) => {
  client()
    .updateMatch(match.id, { status: 'started', started_at: new Date().toISOString() })
    .then(verifyResult);
};

const isPickEvent = (payload: WebhookPostgresUpdatePayload<MatchPlayersRow>) =>
  payload.old_record.team === null &&
  (payload.record.team === 'a' || payload.record.team === 'b');

const isFullMatch = (match: MatchesJoined) =>
  match.teams.filter((player) => player.team === 'a' || player.team === 'b').length ===
  match.size;
