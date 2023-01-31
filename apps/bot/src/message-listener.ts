import { error, info } from '@bf2-matchmaking/logging';
import {
  addPlayer,
  getMatchInfoByChannel,
  pickMatchPlayer,
  removePlayer,
} from './match-interactions';
import { client, verifyResult } from '@bf2-matchmaking/supabase';
import { getDiscordClient } from './client';
import { sendChannelMessage } from '@bf2-matchmaking/discord';
import { Message } from 'discord.js';

export const initMessageListener = async () => {
  const channels = await client().getChannels().then(verifyResult);
  const channelMap = new Map(channels.map(({ channel_id, id }) => [channel_id, id]));
  const discordClient = await getDiscordClient();
  discordClient.on('messageCreate', async (msg) => {
    if (!channelMap.has(msg.channel.id)) {
      return;
    }
    try {
      const result = await parseMessage(msg);
      if (result) {
        await sendChannelMessage(msg.channel.id, result);
      }
    } catch (e) {
      if (e instanceof Error) {
        error('discord-gateway', e.message);
      } else if (typeof e === 'string') {
        error('discord-gateway', e);
      } else {
        error('discord-gateway', JSON.stringify(e));
      }
    }
  });
};

const parseMessage = (msg: Message) => {
  switch (msg.content.split(' ')[0]) {
    case '!who':
      return onWho(msg);
    case '--':
      return onLeave(msg);
    case '++':
      return onJoin(msg);
    case '!pick':
      return onPick(msg);
    case '!help':
      return { content: 'Commands: `!who`, `--`, `++`, `!pick <@user>`' };
    default:
      return Promise.resolve();
  }
};

const onWho = async (msg: Message) => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  const embed = await getMatchInfoByChannel(msg.channel.id);
  return { embeds: [embed] };
};

const onLeave = async (msg: Message) => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  return removePlayer(msg.channel.id, msg.author);
};

const onJoin = async (msg: Message) => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  return addPlayer(msg.channel.id, msg.author);
};
const onPick = async (msg: Message) => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  const playerId = msg.mentions.users.first()?.id || msg.content.split(' ')[1];
  if (!playerId) {
    return { content: 'No player mentioned' };
  }
  const feedbackMessage = await pickMatchPlayer(msg.channel.id, msg.author.id, playerId);
  return { content: feedbackMessage };
};
