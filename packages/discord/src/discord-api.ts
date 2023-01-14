import { DiscordRequest } from './discord-fetch';

export const sendChannelMessage = (
  channelId: string,
  content: string,
  embed?: unknown
) => {
  const embeds = embed ? [embed] : [];
  return DiscordRequest(`channels/${channelId}/messages`, {
    method: 'POST',
    body: {
      content,
      embeds,
    },
  });
};
