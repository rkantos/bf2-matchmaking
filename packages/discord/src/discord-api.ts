import { DiscordRequest } from './discord-fetch';

export const sendChannelMessage = (channelId: string, content: string, embed?: unknown) =>
  DiscordRequest(`channels/${channelId}/messages`, {
    method: 'POST',
    body: {
      content,
      embeds: [embed],
    },
  });
