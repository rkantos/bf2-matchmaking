import 'dotenv/config';
import { verifyKey } from 'discord-interactions';
import fetch from 'cross-fetch';
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';
import {
  APIApplicationCommandInteractionDataOption,
  APIInteractionDataOptionBase,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';

export function VerifyDiscordRequest(clientKey: string) {
  return function (req: any, res: any, buf: any, encoding: any) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
      throw new Error('Bad request signature');
    }
  };
}

export const verifyResult = <T>({ data, error }: PostgrestResponse<T>) => {
  if (error) {
    throw error;
  }
  return data;
};

export const verifySingleResult = <T>({ data, error }: PostgrestSingleResponse<T>) => {
  if (error) {
    throw error;
  }
  return data;
};

type Options = {
  body?: unknown;
} & Omit<RequestInit, 'body'>;
export async function DiscordRequest(endpoint: string, options: Options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  console.log('Making request to: ', url);
  // Stringify payloads
  if (options.body) {
    options.body = JSON.stringify(options.body);
    console.log('with body: ', options.body);
  }

  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/espehel/bf2-matchmaking, 1.0.0)',
    },
    ...(options as RequestInit),
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  const emojiList = [
    '😭',
    '😄',
    '😌',
    '🤓',
    '😎',
    '😤',
    '🤖',
    '😶‍🌫️',
    '🌏',
    '📸',
    '💿',
    '👋',
    '🌊',
    '✨',
  ];
  return emojiList[Math.floor(Math.random() * emojiList.length)];
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const getOption = (
  key: string,
  options: APIApplicationCommandInteractionDataOption[] = []
) => {
  const option = options.find((option) => option.name === key) as
    | APIInteractionDataOptionBase<ApplicationCommandOptionType.Channel, string>
    | undefined;
  return option?.value;
};
