import { DiscordMatch, MatchPlayersRow } from '@bf2-matchmaking/types';
import { sendChannelMessage, removeChannelMessage } from '@bf2-matchmaking/discord';
import { getMatchEmbed } from '@bf2-matchmaking/discord';
import { client, verifySingleResult } from '@bf2-matchmaking/supabase';
import { RESTPostAPIChannelMessageJSONBody } from 'discord-api-types/v10';
import { info } from '@bf2-matchmaking/logging';

const matchMessageMap = new Map<number, string>();

export const sendMatchJoinMessage = async (
  { player_id, source }: MatchPlayersRow,
  match: DiscordMatch
) => {
  const player = match.players.find((p) => p.id === player_id);
  await replaceChannelMessage(match, {
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
  const player = await client().getPlayer(player_id).then(verifySingleResult);
  await replaceChannelMessage(match, {
    embeds: [
      getMatchEmbed(match, source === 'web' ? `${player.full_name} left` : undefined),
    ],
  });
};

export const sendMatchInfoMessage = async (match: DiscordMatch) => {
  const embed = getMatchEmbed(match);
  await replaceChannelMessage(match, {
    embeds: [embed],
  });
};

const replaceChannelMessage = async (
  match: DiscordMatch,
  body: RESTPostAPIChannelMessageJSONBody
) => {
  info('replaceChannelMessage', `Replacing match message for match ${match.id}`);
  if (matchMessageMap.has(match.id)) {
    info(
      'replaceChannelMessage',
      `Removing message { matchId: ${match.id}, channelId: ${
        match.channel.channel_id
      }, messageId: ${matchMessageMap.get(match.id)}`
    );
    removeChannelMessage(match.channel.channel_id, matchMessageMap.get(match.id)!);
  }
  const { data } = await sendChannelMessage(match.channel.channel_id, body);

  if (data) {
    info(
      'replaceChannelMessage',
      `Storing message { matchId: ${match.id}, messageId: ${data.id}`
    );
    matchMessageMap.set(match.id, data.id);
  }
};
