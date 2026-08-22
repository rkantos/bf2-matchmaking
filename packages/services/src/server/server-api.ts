import {
  createLiveInfo,
  getJoinmeDirect,
  getJoinmeHref,
  reinitServer,
} from './server-service';
import {
  addActiveMatchServer,
  addServer,
  addServerWithStatus,
  getActiveMatchServer,
  getServer,
  getServerData,
  getServersWithStatus,
  removeServerWithStatus,
  reserveServerForMatch,
  setServer,
  setServerData,
} from '@bf2-matchmaking/redis/servers';
import { disconnect, hasNoVehicles } from '../rcon/bf2-rcon-api';
import { getServerLocation } from '../external-service';
import { LogContext, ServersRow } from '@bf2-matchmaking/types';
import { ServerStatus } from '@bf2-matchmaking/types/server';
import {
  info,
  logErrorMessage,
  logMessage,
  logWarnMessage,
  warn,
} from '@bf2-matchmaking/logging';
import { json } from '@bf2-matchmaking/redis/json';
import { AppEngineState } from '@bf2-matchmaking/types/engine';
import { hash } from '@bf2-matchmaking/redis/hash';
import { del } from '@bf2-matchmaking/redis/generic';
import { Server as RedisServer } from '@bf2-matchmaking/redis/types';
import { DateTime } from 'luxon';
import { stream } from '@bf2-matchmaking/redis/stream';
import { client } from '@bf2-matchmaking/supabase';
import { Job } from '@bf2-matchmaking/scheduler';

function logServerMessage(address: string, message: string, context?: LogContext) {
  logMessage(`Server ${address}: ${message}`, context);
  stream(`servers:${address}:log`)
    .log(message, 'info')
    .catch((e) =>
      logErrorMessage(`Server ${address}: Error logging server message`, e, context)
    );
}

function logServerError(
  address: string,
  message: string,
  e: unknown,
  context?: LogContext
) {
  logWarnMessage(`Server ${address}: ${message}`, { ...context, error: e });
  stream(`servers:${address}:log`)
    .log(message, 'error')
    .catch((e) =>
      logErrorMessage(`Server ${address}: Error logging server error`, e, context)
    );
}

export const ServerApi = {
  init: async (server: ServersRow) => {
    const { ip: address } = server;
    logServerMessage(address, 'Initializing server connection', { server });

    let status = ServerStatus.OFFLINE;
    try {
      await createLiveInfo(address, true);
      status = ServerStatus.IDLE;
    } catch (e) {
      logServerError(address, 'Failed to create live info', e, { server });
    }

    try {
      await createServerData(server);
    } catch (e) {
      logServerError(address, 'Failed to create server data', e, { server, status });
    }

    await addServer(address, status);
    logServerMessage(address, `Server connection initialized with status ${status}`, {
      server,
    });
    return getServer(address);
  },
  update: (address: string, server: Partial<RedisServer>) => {
    return hash(`servers:${address}`).set(server);
  },
  get(address: string) {
    return getServer(address);
  },
  getData: (address: string) => {
    return getServerData(address);
  },
  setMatch: async (address: string, matchId: string | number) => {
    info('Server.setMatch', `Server ${address} assigning to match ${matchId}`);
    if (!(await reserveServerForMatch(address, matchId))) {
      const current = await getServer(address);
      throw new Error(
        `Server ${address} is not idle and cannot be assigned to match ${matchId}` +
          (current?.matchId ? ` (already assigned to match ${current.matchId})` : '')
      );
    }
    logServerMessage(address, `Assigned to match ${matchId}`);
  },
  findByMatch: async (matchId: string | number) => {
    return getActiveMatchServer(matchId.toString());
  },
  /**
   * Pick a random idle server.
   *
   * Reads the idle set rather than a fixed list of addresses. The previous
   * hardcoded list had drifted from reality in both directions: it still probed
   * cphdock.bf2.top, which no longer exists (producing recurring "Failed to
   * parse values" warnings for a server with no status), while never offering
   * breikernl.4e.fi, which is registered and idle.
   */
  findIdle: async (excluded: Iterable<string> = []): Promise<string | undefined> => {
    const excludedSet = new Set(excluded);
    const idleServers = (await getServersWithStatus(ServerStatus.IDLE)).filter(
      (address) => !excludedSet.has(address)
    );
    return idleServers.at(Math.floor(Math.random() * idleServers.length));
  },
  reset: async (address: string) => {
    info('Server.reset', `Server ${address}: Resetting...`);
    await setServer(address, { status: ServerStatus.IDLE, matchId: undefined });
    await removeServerWithStatus(address, ServerStatus.ACTIVE);
    await addServerWithStatus(address, ServerStatus.IDLE);
    await json<AppEngineState>('app:engine:state').delProperty(address.replace('.', ''));
    logServerMessage(address, 'Server reset');
  },
  restart: async (address: string, reboot: boolean = false) => {
    await setServer(address, {
      status: ServerStatus.RESTARTING,
      updatedAt: undefined,
      errorAt: undefined,
    });
    await del([`servers:${address}:info`, `servers:${address}:data`]);
    logServerMessage(address, reboot ? 'Server rebooting' : 'Server restarting');
    Job.create(`reinitialize-${address}`, reinitServer)
      .on('failed', (name, error) => {
        logServerError(address, 'Server reinitialization failed', error);
      })
      .on('finished', (name, output) => {
        if (!output) {
          return Job.get(name).delete();
        }
        info(address, `Server reinitialized with status ${output.status}`);
      })
      .on('stopped', () => {
        warn(address, 'Server reinitialization stopped.');
      })
      .schedule({
        input: address,
        interval: '10s',
      });
    return getServer(address);
  },
  setOffline: async (address: string, reason: string) => {
    await removeServerWithStatus(address, ServerStatus.IDLE);
    await addServerWithStatus(address, ServerStatus.OFFLINE);
    await hash(`servers:${address}`).set({
      status: ServerStatus.OFFLINE,
      errorAt: undefined,
      updatedAt: undefined,
      matchId: undefined,
    });
    logServerMessage(address, `Server is offline: ${reason}`);
  },
  setError: async (address: string, e: unknown) => {
    await hash(`servers:${address}`).set({ errorAt: DateTime.now().toISO() });
    logServerError(address, 'Something failed', e);
  },
  delete: async (address: string) => {
    await removeServerWithStatus(address, ServerStatus.IDLE);
    await removeServerWithStatus(address, ServerStatus.OFFLINE);
    await removeServerWithStatus(address, ServerStatus.ACTIVE);
    await del([
      `servers:${address}`,
      `servers:${address}:info`,
      `servers:${address}:data`,
    ]);
    await hash('cache:rcons').delEntry(address);
    disconnect(address);
    logServerMessage(address, 'Server deleted');
    return 'ok';
  },
};

//TODO: make this hash, only noVehicles can change. Dont delete everything at restarrt
async function createServerData(server: ServersRow) {
  const { ip, port, demos_path, name } = server;
  const joinmeHref = await getJoinmeHref(ip, port);
  const joinmeDirect = await getJoinmeDirect(ip, port);
  const { city, country } = await getServerLocation(ip);
  const noVehicles = await hasNoVehicles(ip);

  const data = {
    port,
    name,
    joinmeHref,
    joinmeDirect,
    country,
    city,
    noVehicles,
    demos_path,
  };
  const res = await setServerData(server.ip, data);
  info('createServerData', `Server ${server.ip}: Server data created. [result=${res}]`);

  return data;
}
