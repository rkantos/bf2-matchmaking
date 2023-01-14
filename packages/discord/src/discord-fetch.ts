import { error, info } from '@bf2-matchmaking/logging';
import invariant from 'tiny-invariant';
import { verifyKey } from 'discord-interactions';

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
    error(
      '@bf2-matchmaking/discord',
      `HTTP: ${res.status} Error: ${JSON.stringify(data)}`
    );
  }
  return res;
}

export const VerifyDiscordRequest = (clientKey: string) => {
  return function (req: any, res: any, buf: any, encoding: any) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
      throw new Error('Bad request signature');
    }
  };
};
