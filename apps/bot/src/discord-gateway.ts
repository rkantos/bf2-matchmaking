import Eris, { Message, PossiblyUncachedTextableChannel } from 'eris';
import { error, info } from '@bf2-matchmaking/logging';
import {
  addPlayer,
  getMatchInfoByChannel,
  pickMatchPlayer,
  removePlayer,
} from './match-interactions';
import { client, verifyResult } from '@bf2-matchmaking/supabase';

export const initDiscordGateway = async (discordClient: Eris.Client) => {
  const channels = await client().getChannels().then(verifyResult);
  const channelMap = new Map(channels.map(({ channel_id, id }) => [channel_id, id]));

  discordClient.on('messageCreate', async (msg) => {
    if (!channelMap.has(msg.channel.id)) {
      return;
    }
    try {
      const result = await parseMessage(msg);
      if (result) {
        await discordClient.createMessage(msg.channel.id, result);
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

const parseMessage = (msg: Message<PossiblyUncachedTextableChannel>) => {
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
      return 'Commands: `!who`, `--`, `++`, `!pick <@user>`';
    default:
      return Promise.resolve();
  }
};

const onWho = async (msg: Message<PossiblyUncachedTextableChannel>) => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  return getMatchInfoByChannel(msg.channel.id);
};

const onLeave = async (msg: Message<PossiblyUncachedTextableChannel>) => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  await removePlayer(msg.channel.id, msg.author);
};

const onJoin = async (msg: Message<PossiblyUncachedTextableChannel>) => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  await addPlayer(msg.channel.id, msg.author);
};
const onPick = async (
  msg: Message<PossiblyUncachedTextableChannel>
): Promise<string | undefined> => {
  info(
    'discord-gateway',
    `Received command <${msg.content}> for channel <${msg.channel.id}>`
  );
  const playerId = msg.mentions[0]?.id || msg.content.split(' ')[1];
  if (!playerId) {
    return 'No player mentioned';
  }
  return pickMatchPlayer(msg.channel.id, msg.author.id, playerId);
};
