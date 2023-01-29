import { RequestData, REST } from '@discordjs/rest';
import {
  Routes,
  APIGuildMember,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageResult,
  APIApplicationCommand,
} from 'discord-api-types/v10';
import invariant from 'tiny-invariant';
import { error } from '@bf2-matchmaking/logging';

invariant(process.env.DISCORD_TOKEN, 'process.env.DISCORD_TOKEN not defined');
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

export interface SuccessResponse<T> {
  data: T;
  error: null;
}
export interface ErrorResponse {
  data: null;
  error: unknown;
}
const postDiscordRoute = async <T>(
  route: `/${string}`,
  options?: RequestData
): Promise<SuccessResponse<T> | ErrorResponse> => {
  try {
    const data = (await rest.post(route, options)) as T;
    return { data, error: null };
  } catch (e) {
    error('postDiscordRoute', e);
    return { data: null, error: e };
  }
};

const getDiscordRoute = async <T>(
  route: `/${string}`,
  options?: RequestData
): Promise<SuccessResponse<T> | ErrorResponse> => {
  try {
    const data = (await rest.get(route, options)) as T;
    return { data, error: null };
  } catch (e) {
    error('getDiscordRoute', e);
    return { data: null, error: e };
  }
};

export const sendChannelMessage = (
  channelId: string,
  body: RESTPostAPIChannelMessageJSONBody
) =>
  postDiscordRoute<RESTPostAPIChannelMessageResult>(Routes.channelMessages(channelId), {
    body,
  });

export const getMembers = (guildId: string) =>
  getDiscordRoute<Array<APIGuildMember>>(`${Routes.guildMembers(guildId)}?limit=1000`);

export const getMember = (guildId: string, userId?: string) =>
  getDiscordRoute<APIGuildMember>(Routes.guildMember(guildId, userId));

export const postCommand = (
  appId: string,
  guildId: string,
  command: Partial<APIApplicationCommand>
) =>
  postDiscordRoute<APIApplicationCommand>(
    Routes.applicationGuildCommands(appId, guildId),
    { body: command }
  );

export const getCommands = (appId: string, guildId: string) =>
  getDiscordRoute<Array<APIApplicationCommand>>(
    Routes.applicationGuildCommands(appId, guildId)
  );
