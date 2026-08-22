import { mapListPlayers, mapMapList, mapServerInfo } from './mapper';
import { getFakePlayers, withFakePlayerCount } from './fake-players';
import { warn } from '@bf2-matchmaking/logging';
import { getSocket, send } from './socket-manager';
import { toFetchError } from '@bf2-matchmaking/utils';
import { PlayerListItem, ServerInfo, RconResult } from '@bf2-matchmaking/types/rcon';
import { ServiceError } from '../error';

export { createSockets, createSocket, disconnect } from './socket-manager';

export function unpauseRound(address: string) {
  return sendMessage(address, 'bf2cc unpause');
}

export function pauseRound(address: string) {
  return sendMessage(address, 'bf2cc pause');
}

export async function getMapList(address: string): Promise<RconResult<string[]>> {
  const reply = await sendMessage(address, 'exec maplist.list');
  if (reply.error) {
    return reply;
  }
  if (!reply.data) {
    return { ...reply, data: null, error: { message: 'Empty map list response' } };
  }
  const data = mapMapList(reply.data);
  if (!data) {
    return { ...reply, data: null, error: { message: 'Failed to parse map list' } };
  }
  return { ...reply, data };
}

export async function getPlayerList(
  address: string
): Promise<RconResult<PlayerListItem[]>> {
  const reply = await sendMessage(address, 'bf2cc pl');

  // Resolved up front so the fake rows can also stand in for a failed, empty or
  // unparseable reply. Notably, `bf2cc pl` sends no response at all when nobody
  // is connected, so the command times out - which is why createLiveInfo skips
  // it entirely when connectedPlayers is '0'. Without this the fakes would be
  // unreachable on an otherwise empty server.
  const fakes = await getFakePlayers(address);

  if (reply.error) {
    if (!fakes.length) {
      return reply;
    }
    warn(
      'getPlayerList',
      `${address}: substituting ${fakes.length} fake player(s) for failed rcon call (${reply.error.message})`
    );
    return { ...reply, error: null, data: fakes };
  }

  if (!reply.data) {
    return fakes.length
      ? { ...reply, data: fakes }
      : { ...reply, data: null, error: { message: 'Empty player list response' } };
  }
  const data = mapListPlayers(reply.data);
  if (!data) {
    return fakes.length
      ? { ...reply, data: fakes }
      : { ...reply, data: null, error: { message: 'Failed to parse player list' } };
  }
  return {
    ...reply,
    data: data.concat(
      fakes.map((_, i) => ({ ...fakes[i], index: String(data.length + i) }))
    ),
  };
}

export async function getServerInfo(address: string): Promise<RconResult<ServerInfo>> {
  const reply = await sendMessage(address, 'bf2cc si');
  if (reply.error) {
    return reply;
  }
  if (!reply.data) {
    return { ...reply, data: null, error: { message: 'Empty server info response' } };
  }
  const data = mapServerInfo(reply.data);
  if (!data) {
    return { ...reply, data: null, error: { message: 'Failed to parse server info' } };
  }
  return { ...reply, data: await withFakePlayerCount(address, data) };
}

export async function switchPlayers(address: string, players: Array<string>) {
  const resultArray = [];
  for (const playerId of players) {
    const result = await sendMessage(address, `bf2cc switchplayer ${playerId} 3`);
    resultArray.push(result);
  }
  return resultArray;
}

export function restartRound(address: string) {
  return sendMessage(address, 'admin.restartMap');
}

export function restartServer(address: string) {
  return sendMessage(address, 'quit');
}

export function exec(address: string, command: string) {
  return sendMessage(address, `exec ${command}`);
}

export async function hasNoVehicles(address: string) {
  const response = await exec(address, 'sv.noVehicles').then(verifyRconResult);
  if (!(response.trim() === '1' || response.trim() === '0')) {
    throw ServiceError.BadGateway('Unexpected response from "exec sv.noVehicles"');
  }

  return response.trim() === '1';
}

async function sendMessage(address: string, message: string): Promise<RconResult> {
  let readyState = 'missing';
  try {
    const socket = await getSocket(address);
    readyState = socket.readyState;
    const data = await send(socket, message);
    readyState = socket.readyState;
    return { data, error: null, readyState };
  } catch (e) {
    return { data: null, error: toFetchError(e), readyState };
  }
}

export function verifyRconResult<T>(result: RconResult<T>): T {
  if (result.error) {
    throw ServiceError.BadGateway(
      `result.error.message[readyState=${result.readyState}]`
    );
  }
  return result.data;
}
