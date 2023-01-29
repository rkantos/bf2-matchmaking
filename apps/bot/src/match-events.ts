import { addChannel, removeChannel } from './member-listener';
import { getMatchEmbed, sendChannelMessage } from '@bf2-matchmaking/discord';
import { DiscordMatch } from './types';

export const handleMatchSummon = async (match: DiscordMatch) => {
  if (match.channel.staging_channel) {
    await addChannel(match.channel.staging_channel, match);
    await sendChannelMessage(match.channel.channel_id, {
      embeds: [getMatchEmbed(match)],
    });
  }
};
export const handleMatchDraft = async (match: DiscordMatch) => {
  if (match.channel.staging_channel) {
    await removeChannel(match.channel.staging_channel);
  }
};
