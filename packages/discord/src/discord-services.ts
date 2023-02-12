import {
  editChannelMessage,
  getChannelMessages,
  removeChannelMessage,
} from './discord-rest';
import { MatchesJoined } from '@bf2-matchmaking/types';
import { isMatchTitle } from './embed-utils';
import { APIEmbed, APIMessage } from 'discord-api-types/v10';
import { info } from '@bf2-matchmaking/logging';

const hasEmbeds = (message: APIMessage) => message.embeds.length > 0;
const hasMatch = (embed: APIEmbed, matches: Array<MatchesJoined>) =>
  matches.some((match) => isMatchTitle(match, embed.title));
export const removeExistingMatchEmbeds = async (
  channelId: string,
  matches: Array<MatchesJoined>
) => {
  const { data: messages } = await getChannelMessages(channelId);
  if (messages) {
    messages.filter(hasEmbeds).forEach((message) => {
      const embedsWithoutExistingMatches = message.embeds.filter(
        (embed) => !hasMatch(embed, matches)
      );

      if (embedsWithoutExistingMatches.length === 0) {
        info('removeExistingMatchEmbeds', `Removing channel message ${message.id}`);
        removeChannelMessage(message.channel_id, message.id);
      } else {
        info('removeExistingMatchEmbeds', `Editing channel message ${message.id}`);
        editChannelMessage(message.channel_id, message.id, {
          embeds: embedsWithoutExistingMatches,
        });
      }
    });
  }
};
