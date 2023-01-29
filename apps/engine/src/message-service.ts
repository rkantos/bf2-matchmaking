import { client, verifySingleResult } from '@bf2-matchmaking/supabase';
import { DiscordMatch, MatchPlayersRow } from '@bf2-matchmaking/types';
import { sendChannelMessage } from '@bf2-matchmaking/discord';
import { getMatchEmbed } from '@bf2-matchmaking/discord';
import { getCurrentCaptain } from '@bf2-matchmaking/utils';
import { error } from '@bf2-matchmaking/logging';

export const sendMatchJoinMessage = async (
  { player_id }: MatchPlayersRow,
  match: DiscordMatch
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(match.channel.channel_id, {
    content: `${player.full_name} joined`,
    embeds: [getMatchEmbed(match)],
  });
};

export const sendMatchLeaveMessage = async (
  { player_id }: Partial<MatchPlayersRow>,
  match: DiscordMatch
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(match.channel.channel_id, {
    content: `${player.full_name} left`,
    embeds: [getMatchEmbed(match)],
  });
};

export const sendMatchPickMessage = async (
  { player_id, team }: MatchPlayersRow,
  match: DiscordMatch
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  const embed = getMatchEmbed(match);
  await sendChannelMessage(match.channel.channel_id, {
    content: `${player.full_name} assigned to team ${team}`,
    embeds: [embed],
  });
};

export const sendMatchInfoMessage = async (match: DiscordMatch) => {
  const embed = getMatchEmbed(match);
  await sendChannelMessage(match.channel.channel_id, {
    content: `Match ${match.id} is ${match.status}`,
    embeds: [embed],
  });
};

export const sendMatchDraftingMessage = async (match: DiscordMatch) => {
  const embed = getMatchEmbed(match);
  const captain = getCurrentCaptain(match);
  if (captain) {
    await sendChannelMessage(match.channel.channel_id, {
      content: `${captain.username} is picking`,
      embeds: [embed],
    });
  } else {
    error(
      'sendMatchDraftingMessage',
      `Failed to get current captain for match ${match.id}`
    );
  }
};
