import { info, warn } from '@bf2-matchmaking/logging';
import {
  MatchesJoined,
  MatchPlayersRow,
  WebhookPostgresUpdatePayload,
} from '@bf2-matchmaking/types';
import { client, verifyResult, verifySingleResult } from '@bf2-matchmaking/supabase';
import { sendMatchJoinMessage, sendMatchLeaveMessage } from './message-service';

export const handleInsertedMatchPlayer = async (matchPlayer: MatchPlayersRow) => {
  info('handleInsertedMatchPlayer', `Player ${matchPlayer.player_id} joined.`);
  const match = await client().getMatch(matchPlayer.match_id).then(verifySingleResult);

  if (match.channel) {
    await sendMatchJoinMessage(matchPlayer, match.channel.channel_id);
  }

  if (match.status !== 'open') {
    warn(
      'handleInsertedMatchPlayer',
      `Player ${matchPlayer.player_id} joined a not open match(status="${match.status}").`
    );
  } else if (match.players.length === match.size && match.pick === 'captain') {
    info('handleInsertedMatchPlayer', `Setting match ${match.id} status to "picking".`);
    await setMatchStatusDrafting(match);
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

    if (match.channel) {
      await sendMatchJoinMessage(payload.record, match.channel.channel_id);
    }

    if (match.status !== 'picking') {
      warn(
        'handleUpdatedMatchPlayer',
        `Player ${payload.record.player_id} joined team for match not drafting(status="${match.status}").`
      );
    } else if (isFullMatch(match)) {
      info('handleUpdatedMatchPlayer', `Setting match ${match.id} status to "started".`);
      await setMatchStatusStarted(match);
      // TODO: Create new match if config
    }
  }
};

export const handleDeletedMatchPlayer = async (
  oldMatchPlayer: Partial<MatchPlayersRow>
) => {
  info('handleDeletedMatchPlayer', `Player ${oldMatchPlayer.player_id} left.`);

  const match = await client().getMatch(oldMatchPlayer.match_id).then(verifySingleResult);
  if (match.channel) {
    await sendMatchLeaveMessage(oldMatchPlayer, match.channel.channel_id);
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
