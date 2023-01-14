import { Client, Message, PossiblyUncachedTextableChannel } from 'eris';
import invariant from 'tiny-invariant';
import { error, info } from '@bf2-matchmaking/logging';
import {
  addPlayer,
  getMatchInfoByChannel,
  pickMatchPlayer,
  removePlayer,
} from './match-interactions';
import { client, verifyResult } from '@bf2-matchmaking/supabase';

let channelMap = new Map<string, number>();

export const initDiscordGateway = () => {
  invariant(process.env.DISCORD_TOKEN, 'process.env.DISCORD_TOKEN is not defined');
  const gateway = new Client(process.env.DISCORD_TOKEN, {
    intents: ['guildMessages'],
  });

  gateway.on('ready', async () => {
    const channels = await client().getChannels().then(verifyResult);
    channelMap = new Map(channels.map(({ channel_id, id }) => [channel_id, id]));
    info('discord-gateway', 'Connected');
  });

  gateway.on('error', (err) => {
    error('discord-gateway', err.message);
  });

  gateway.on('messageCreate', async (msg) => {
    if (!channelMap.has(msg.channel.id)) {
      return;
    }
    try {
      const result = await parseMessage(msg);
      if (result) {
        await gateway.createMessage(msg.channel.id, result);
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

  gateway.connect();
};
