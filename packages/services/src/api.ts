import {
  PostServerExecRequestBody,
  PostServerExecResponseBody,
  LiveMatch,
  PostRestartServerRequestBody,
  MatchesJoined,
  GetGatherResponse,
} from '@bf2-matchmaking/types';
import {
  deleteJSON,
  getApiBaseUrl,
  getEventSource,
  getJSON,
  postJSON,
  postWithApiKeyJSON,
  toBearerRequestInit,
} from '@bf2-matchmaking/utils';
import {
  ConnectedLiveServer,
  LiveServer,
  ServerLogEntry,
  ServersLogs,
} from '@bf2-matchmaking/types/server';
import { StreamEventReply } from '@bf2-matchmaking/types/redis';
import { GetMatchLogsResponse, MatchesPostRequestBody } from './schemas/matches';

// Override with API_BASE_URL / NEXT_PUBLIC_API_BASE_URL (e.g. http://localhost:5004
// for local dev); defaults to production when unset.
const basePath = getApiBaseUrl();
const gathers = `${basePath}/gathers`;
const matches = `${basePath}/matches`;
const servers = `${basePath}/servers`;
const admin = `${basePath}/admin`;
export const api = {
  getHealth: () => getJSON(`${basePath}/health`, { signal: AbortSignal.timeout(5000) }),
  getGather: (config: number | string) =>
    getJSON<GetGatherResponse>(`${gathers}/${config}`, {
      cache: 'no-store',
    }),
  postGatherServer: (config: number | string, address: string) =>
    postWithApiKeyJSON<number>(`${gathers}/${config}/address`, {
      address,
    }),
  postGatherSummonTimeout: (
    config: number | string,
    summonTimeout: number,
    token: string
  ) =>
    postJSON<{ summonTimeout: number }>(
      `${gathers}/${config}/summon-timeout`,
      { summonTimeout },
      toBearerRequestInit(token)
    ),
  postGatherDraftMode: (config: number | string, draftMode: string, token: string) =>
    postJSON<{ draftMode: string }>(
      `${gathers}/${config}/draft-mode`,
      { draftMode },
      toBearerRequestInit(token)
    ),
  postGatherTestClientCount: (
    config: number | string,
    kind: 'teamspeak' | 'bf2',
    count: number,
    token: string
  ) =>
    postJSON<{ count: number }>(
      `${gathers}/${config}/test-clients/${kind}`,
      { count },
      toBearerRequestInit(token)
    ),
  postGatherDraftPick: (
    config: number | string,
    playerId: string,
    team: 1 | 2,
    token: string
  ) =>
    postJSON(
      `${gathers}/${config}/draft/pick`,
      { playerId, team },
      toBearerRequestInit(token)
    ),
  postGatherDraftUndo: (config: number | string, playerId: string, token: string) =>
    postJSON<GetGatherResponse>(
      `${gathers}/${config}/draft/undo`,
      { playerId },
      toBearerRequestInit(token)
    ),
  getGatherEvents: (config: number | string) =>
    getJSON<Array<StreamEventReply>>(`${gathers}/${config}/events`, {
      cache: 'no-store',
    }),
  getGatherEventsStream: (config: number | string, start: string | undefined) =>
    getEventSource(`${gathers}/${config}/events/stream?start=${start}`),
  postMatches: (body: MatchesPostRequestBody) =>
    postWithApiKeyJSON<MatchesJoined>(`${matches}`, body),
  getMatches: () => getJSON<Array<LiveMatch>>(`${matches}`),
  getMatch: (matchId: number) => getJSON<LiveMatch>(`${matches}/${matchId}`),
  postMatchStart: (matchId: number, server: string, token: string) =>
    postJSON<LiveMatch>(
      `${matches}/${matchId}/start`,
      { address: server },
      toBearerRequestInit(token)
    ),
  getMatchServer: (matchId: number) =>
    getJSON<ConnectedLiveServer>(`${matches}/${matchId}/server`),
  postMatchServer: (matchId: number, address: string, force: boolean) =>
    postWithApiKeyJSON<ConnectedLiveServer>(
      `${matches}/${matchId}/server?force=${force}`,
      { address }
    ),
  getMatchLog: (matchId: number) =>
    getJSON<GetMatchLogsResponse>(`${matches}/${matchId}/log`, { cache: 'no-store' }),
  getServers: () =>
    getJSON<Array<LiveServer>>(`${servers}`, {
      next: { revalidate: 60 },
    }),
  getServersLogs: () => getJSON<ServersLogs>(`${servers}/logs`, { cache: 'no-store' }),
  getServer: (address: string) =>
    getJSON<LiveServer>(`${servers}/${address}`, {
      cache: 'no-store',
    }),
  getServerLiveStream: (address: string) =>
    getEventSource(`${servers}/${address}/stream`),
  getServerLog: (address: string) =>
    getJSON<Array<ServerLogEntry>>(`${servers}/${address}/log`, {
      cache: 'no-store',
    }),
  postServerReboot: (address: string, token: string) =>
    postJSON(`${servers}/${address}/reboot`, {}, toBearerRequestInit(token)),
  postServerExec: (address: string, body: PostServerExecRequestBody, token: string) =>
    postJSON<PostServerExecResponseBody>(
      `${servers}/${address}/exec`,
      body,
      toBearerRequestInit(token)
    ),
  postServerPause: (address: string, token: string) =>
    postJSON(`${servers}/${address}/pause`, {}, toBearerRequestInit(token)),
  postServerUnpause: (address: string, token: string) =>
    postJSON(`${servers}/${address}/unpause`, {}, toBearerRequestInit(token)),
  postServerMaps: (address: string, map: number, token: string) =>
    postJSON(`${servers}/${address}/maps`, { map }, toBearerRequestInit(token)),
  deleteServer: (address: string, token: string) =>
    deleteJSON(`${servers}/${address}`, toBearerRequestInit(token)),
  postServerRestart: (
    address: string,
    body: PostRestartServerRequestBody,
    token: string
  ) =>
    postJSON<PostServerExecResponseBody>(
      `${servers}/${address}/restart`,
      body,
      toBearerRequestInit(token)
    ),
  adminReset: () => postWithApiKeyJSON(`${admin}/reset`, {}),
  adminResetEngine: () => postWithApiKeyJSON(`${admin}/reset/engine`, {}),
  adminResetServers: () => postWithApiKeyJSON(`${admin}/reset/servers`, {}),
};

export const engine = {
  getHealth: () =>
    getJSON<string>(`https://engine.bf2.top/health`, {
      signal: AbortSignal.timeout(5000),
    }),
};
