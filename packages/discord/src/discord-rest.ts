import { RequestData, REST } from '@discordjs/rest';
import {
  Routes,
  APIGuildMember,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageResult,
  APIApplicationCommand,
  RESTGetAPIChannelMessagesResult,
  RESTPatchAPIChannelMessageJSONBody,
  RESTPatchAPIChannelMessageResult,
} from 'discord-api-types/v10';
import invariant from 'tiny-invariant';
import { error } from '@bf2-matchmaking/logging';
import { RESTDeleteAPIChannelMessageResult } from 'discord-api-types/rest/v10/channel';

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

const deleteDiscordRoute = async <T>(
  route: `/${string}`,
  options?: RequestData
): Promise<SuccessResponse<T> | ErrorResponse> => {
  try {
    const data = (await rest.delete(route, options)) as T;
    return { data, error: null };
  } catch (e) {
    error('deleteDiscordRoute', e);
    return { data: null, error: e };
  }
};

const patchDiscordRoute = async <T>(
  route: `/${string}`,
  options?: RequestData
): Promise<SuccessResponse<T> | ErrorResponse> => {
  try {
    const data = (await rest.patch(route, options)) as T;
    return { data, error: null };
  } catch (e) {
    error('patchDiscordRoute', e);
    return { data: null, error: e };
  }
};

export const getChannelMessages = (channelId: string) =>
  getDiscordRoute<RESTGetAPIChannelMessagesResult>(
    `${Routes.channelMessages(channelId)}?limit=50`
  );

export const sendChannelMessage = (
  channelId: string,
  body: RESTPostAPIChannelMessageJSONBody
) =>
  postDiscordRoute<RESTPostAPIChannelMessageResult>(Routes.channelMessages(channelId), {
    body,
  });

export const editChannelMessage = (
  channelId: string,
  messageId: string,
  body: RESTPatchAPIChannelMessageJSONBody
) =>
  patchDiscordRoute<RESTPatchAPIChannelMessageResult>(
    Routes.channelMessage(channelId, messageId),
    { body }
  );

export const removeChannelMessage = (channelId: string, messageId: string) =>
  deleteDiscordRoute<RESTDeleteAPIChannelMessageResult>(
    Routes.channelMessage(channelId, messageId)
  );

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
