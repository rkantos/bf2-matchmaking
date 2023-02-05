import { client, verifySingleResult } from '@bf2-matchmaking/supabase';
import { DiscordMatch, MatchPlayersRow } from '@bf2-matchmaking/types';
import { sendChannelMessage } from '@bf2-matchmaking/discord';
import { getMatchEmbed } from '@bf2-matchmaking/discord';
import { getDraftStep } from '@bf2-matchmaking/utils';
import { error } from '@bf2-matchmaking/logging';

export const sendMatchJoinMessage = async (
  { player_id, source }: MatchPlayersRow,
  match: DiscordMatch
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(match.channel.channel_id, {
    embeds: [
      getMatchEmbed(match, source === 'web' ? `${player.full_name} joined` : undefined),
    ],
  });
};

export const sendMatchLeaveMessage = async (
  { player_id, source }: Partial<MatchPlayersRow>,
  match: DiscordMatch
) => {
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await sendChannelMessage(match.channel.channel_id, {
    embeds: [
      getMatchEmbed(match, source === 'web' ? `${player.full_name} left` : undefined),
    ],
  });
};

export const sendMatchInfoMessage = async (match: DiscordMatch) => {
  const embed = getMatchEmbed(match);
  await sendChannelMessage(match.channel.channel_id, {
    embeds: [embed],
  });
};

export const sendMatchDraftingMessage = async (match: DiscordMatch) => {
  const { captain } = getDraftStep(match);
  if (captain) {
    const embed = getMatchEmbed(match, `${captain.username} is picking`);
    await sendChannelMessage(match.channel.channel_id, {
      embeds: [embed],
    });
  } else {
    error(
      'sendMatchDraftingMessage',
      `Failed to get current captain for match ${match.id}`
    );
  }
};
