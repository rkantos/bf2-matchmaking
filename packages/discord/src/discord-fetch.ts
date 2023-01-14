import { info } from '@bf2-matchmaking/logging';
import invariant from 'tiny-invariant';

type Options = {
  body?: unknown;
} & Omit<RequestInit, 'body'>;

export async function DiscordRequest(endpoint: string, options: Options) {
  invariant(process.env.DISCORD_TOKEN, 'process.env.DISCORD_TOKEN not defined');

  const url = 'https://discord.com/api/v10/' + endpoint;
  info('@bf2-matchmaking/discord', `Making request to: ${url}`);

  if (options.body) {
    options.body = JSON.stringify(options.body);
    info('@bf2-matchmaking/discord', `Request body: ${options.body}`);
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/espehel/bf2-matchmaking, 1.0.0)',
    },
    ...(options as RequestInit),
  });
  if (!res.ok) {
    const data = await res.json();
    console.error('@bf2-matchmaking/discord', res.status);
    throw new Error(JSON.stringify(data));
  }
  return res;
}
