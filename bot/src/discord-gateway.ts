import { Client, Message, PossiblyUncachedTextableChannel } from 'eris';
import invariant from 'tiny-invariant';
import { error, info } from './libs/logging';
import { getChannelMap } from './services/channel';
import {
  addPlayer,
  getMatchPlayerNamesByChannel,
  removePlayer,
  startMatchDraft,
} from './services/match';

let channels = new Map<string, number>();

export const initDiscordGateway = () => {
  invariant(process.env.DISCORD_TOKEN, 'process.env.DISCORD_TOKEN is not defined');
  const gateway = new Client(process.env.DISCORD_TOKEN, {
    intents: ['guildMessages'],
  });

  gateway.on('ready', async () => {
    channels = new Map(await getChannelMap());
    info('discord-gateway', 'Connected');
  });

  gateway.on('error', (err) => {
    error('discord-gateway', err.message);
  });

  gateway.on('messageCreate', async (msg) => {
    if (!channels.has(msg.channel.id)) {
      return;
    }
    try {
      switch (msg.content) {
        case '!who':
          return onWho(msg);
        case '--':
          return onLeave(msg);
        case '++':
          onJoin(msg);
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

  const onWho = async (msg: Message<PossiblyUncachedTextableChannel>) => {
    info('discord-gateway', `Received command <${msg.content}> for channel <${msg.channel.id}>`);
    const players = await getMatchPlayerNamesByChannel(msg.channel.id);
    const message = players.length ? `[${players.join(', ')}]` : 'No players';
    gateway.createMessage(msg.channel.id, message);
  };

  const onLeave = async (msg: Message<PossiblyUncachedTextableChannel>) => {
    info('discord-gateway', `Received command <${msg.content}> for channel <${msg.channel.id}>`);
    await removePlayer(msg.channel.id, msg.author);
  };

  const onJoin = async (msg: Message<PossiblyUncachedTextableChannel>) => {
    info('discord-gateway', `Received command <${msg.content}> for channel <${msg.channel.id}>`);
    const match = await addPlayer(msg.channel.id, msg.author);

    if (match.players.length === match.size && match.pick === 'captain') {
      await startMatchDraft(match);
    }
  };

  gateway.connect();
};
