import { LiveInfo } from '@bf2-matchmaking/types';
import { hash } from '../core/hash';
import { set } from '../core/set';
import { assertString, isUniqueString } from '@bf2-matchmaking/utils';
import { json } from '../core/json';
import { topic } from '../core/topic';
import { Server, ServerData } from '../types';
import { serverDataSchema, serverSchema } from '../schemas';
import { ServerStatus } from '@bf2-matchmaking/types/server';
import { logErrorMessage } from '@bf2-matchmaking/logging';
import { getClient } from '../client';

export async function getAllServers() {
  return (
    await Promise.all([
      getServersWithStatus(ServerStatus.ACTIVE),
      getServersWithStatus(ServerStatus.IDLE),
      getServersWithStatus(ServerStatus.OFFLINE),
      getServersWithStatus(ServerStatus.RESTARTING),
    ])
  )
    .flat()
    .filter(isUniqueString);
}

export function getServersWithStatus(status: ServerStatus) {
  if (status === ServerStatus.ACTIVE) {
    return hash(`servers:active`).values();
  }
  return set(`servers:${status}`).members();
}

export async function addActiveMatchServer(address: string, matchId: string) {
  return hash('servers:active').set({ [matchId]: address });
}
export async function getActiveMatchServer(matchId: string): Promise<string | undefined> {
  return hash<Record<string, string>>('servers:active').get(matchId);
}
export async function getActiveMatchServers(): Promise<Record<string, string>> {
  return hash<Record<string, string>>('servers:active').getAll();
}

export async function addServerWithStatus(
  address: string,
  key: ServerStatus,
  matchId?: string
) {
  if (key !== ServerStatus.ACTIVE) {
    return set(`servers:${key}`).add(address);
  }
  assertString(matchId, 'matchId must be defined when key is active');
  return addActiveMatchServer(address, matchId);
}
export async function removeServerWithStatus(address: string, key: ServerStatus) {
  if (key === ServerStatus.ACTIVE) {
    return hash('servers:active').delValue(address);
  }
  return set(`servers:${key}`).remove(address);
}

export async function setServerLiveInfo(address: string, info: LiveInfo) {
  const result = await json(`servers:${address}:info`).set(info);
  return result;
}
export async function getServerLiveInfo(address: string) {
  return json<LiveInfo>(`servers:${address}:info`).get();
}

export async function setServerData(address: string, data: ServerData) {
  return json(`servers:${address}:data`).set(data);
}
export async function getServerData(address: string) {
  return json(`servers:${address}:data`).get().then(serverDataSchema.parse);
}
export async function getServerDataSafe(address: string) {
  try {
    return await getServerData(address);
  } catch (e) {
    return null;
  }
}

export async function setServer(address: string, server: Partial<Server>) {
  return hash(`servers:${address}`).set(server);
}

/** Atomically claim an idle server for one match. Idempotent for that match. */
export async function reserveServerForMatch(address: string, matchId: string | number) {
  const client = await getClient();
  const result = await client.eval(
    `local status = redis.call('HGET', KEYS[1], 'status')
     if status == ARGV[3] then
       if redis.call('HGET', KEYS[1], 'matchId') == ARGV[2] then return 1 end
       return 0
     end
     if status ~= ARGV[4] then return 0 end
     redis.call('HSET', KEYS[1], 'status', ARGV[3], 'matchId', ARGV[2])
     redis.call('SREM', KEYS[2], ARGV[1])
     redis.call('HSET', KEYS[3], ARGV[2], ARGV[1])
     return 1`,
    {
      keys: [`servers:${address}`, `servers:${ServerStatus.IDLE}`, 'servers:active'],
      arguments: [
        address,
        String(matchId),
        ServerStatus.ACTIVE,
        ServerStatus.IDLE,
      ],
    }
  );
  return Number(result) === 1;
}
export async function getServer(address: string) {
  const result = await hash<Server>(`servers:${address}`)
    .getAll()
    .then(serverSchema.safeParse);
  if (result.error) {
    logErrorMessage(`Server ${address}: Failed to parse values`, result.error, {
      result,
    });
  }
  return result.data || null;
}

export async function addServer(address: string, status: ServerStatus) {
  await hash(`servers:${address}`).set({ status });
  await addServerWithStatus(address, status);
}
