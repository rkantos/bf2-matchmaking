import { DiscordMatch, MatchPlayersRow } from '@bf2-matchmaking/types';
import { sendChannelMessage } from '@bf2-matchmaking/discord';
import { getMatchEmbed } from '@bf2-matchmaking/discord';

export const sendMatchJoinMessage = async (
  { player_id, source }: MatchPlayersRow,
  match: DiscordMatch
) => {
  const player = match.players.find((p) => p.id === player_id);
  await sendChannelMessage(match.channel.channel_id, {
    embeds: [
      getMatchEmbed(
        match,
        source === 'web' && player ? `${player.full_name} joined` : undefined
      ),
    ],
  });
};

export const sendMatchLeaveMessage = async (
  { player_id, source }: Partial<MatchPlayersRow>,
  match: DiscordMatch
) => {
  const player = match.players.find((p) => p.id === player_id);
  await sendChannelMessage(match.channel.channel_id, {
    embeds: [
      getMatchEmbed(
        match,
        source === 'web' && player ? `${player.full_name} left` : undefined
      ),
    ],
  });
};

export const sendMatchInfoMessage = async (match: DiscordMatch) => {
  const embed = getMatchEmbed(match);
  await sendChannelMessage(match.channel.channel_id, {
    embeds: [embed],
  });
};
