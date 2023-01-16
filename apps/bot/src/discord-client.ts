import { Client } from 'eris';
import invariant from 'tiny-invariant';
import { error, info } from '@bf2-matchmaking/logging';
import { initDiscordGateway } from './discord-gateway';
import { MatchesJoined } from '@bf2-matchmaking/types';
import { getMatchEmbed } from '@bf2-matchmaking/discord';

let client: Client | undefined;

const getClient = async () => {
  if (client) {
    return client;
  }
  invariant(process.env.DISCORD_TOKEN, 'process.env.DISCORD_TOKEN is not defined');
  client = new Client(process.env.DISCORD_TOKEN, {
    intents: ['guildMessages'],
  });
  client.on('ready', async () => {
    info('discord-client', 'Connected');
  });
  client.on('error', (err) => {
    error('discord-client', err.message);
  });
  await initDiscordGateway(client);
  await client.connect();
  return client;
};

export const sendMessage = async (match: MatchesJoined) => {
  const c = await getClient();
  return c.createMessage(match.channel.channel_id, {
    embed: getMatchEmbed(match),
  });
};
