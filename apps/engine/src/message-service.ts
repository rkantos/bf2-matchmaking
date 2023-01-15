import { client, verifySingleResult } from '@bf2-matchmaking/supabase';
import { MatchesJoined, MatchPlayersRow } from '@bf2-matchmaking/types';
import { sendChannelMessage } from '@bf2-matchmaking/discord';
import { getMatchEmbed } from '@bf2-matchmaking/discord';
import { getCurrentCaptain } from '@bf2-matchmaking/utils';
import { error } from '@bf2-matchmaking/logging';

export const sendMatchJoinMessage = async (
  { player_id }: MatchPlayersRow,
  match: MatchesJoined
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(
    match.channel.channel_id,
    `${player.full_name} joined`,
    getMatchEmbed(match)
  );
};

export const sendMatchLeaveMessage = async (
  { player_id }: Partial<MatchPlayersRow>,
  match: MatchesJoined
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(
    match.channel.channel_id,
    `${player.full_name} left`,
    getMatchEmbed(match)
  );
};

export const sendMatchPickMessage = async (
  { player_id, team }: MatchPlayersRow,
  match: MatchesJoined
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  const embed = getMatchEmbed(match);
  await sendChannelMessage(
    match.channel.channel_id,
    `${player.full_name} assigned to team ${team}`,
    embed
  );
};

export const sendMatchInfoMessage = async (match: MatchesJoined) => {
  const embed = getMatchEmbed(match);
  await sendChannelMessage(
    match.channel.channel_id,
    `Match ${match.id} is ${match.status}`,
    embed
  );
};

export const sendMatchDraftingMessage = async (match: MatchesJoined) => {
  const embed = getMatchEmbed(match);
  const captain = getCurrentCaptain(match);
  if (captain) {
    await sendChannelMessage(
      match.channel.channel_id,
      `${captain.username} is picking`,
      embed
    );
  } else {
    error(
      'sendMatchDraftingMessage',
      `Failed to get current captain for match ${match.id}`
    );
  }
};
