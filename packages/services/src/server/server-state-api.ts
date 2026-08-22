import { LiveServer, ServerStatus } from '@bf2-matchmaking/types/server';
import { assertString } from '@bf2-matchmaking/utils';

function getBaseUrl() {
  const value = process.env.SERVER_STATE_API_BASE_URL?.trim();
  return value ? value.replace(/\/$/, '') : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('SERVER_STATE_API_BASE_URL is not configured');

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: init?.signal || AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(
      `Server-state API ${init?.method || 'GET'} ${path} failed: ` +
        `${response.status} ${response.statusText}${body ? ` - ${body}` : ''}`
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function mutationHeaders() {
  assertString(
    process.env.SERVER_STATE_API_KEY,
    'SERVER_STATE_API_KEY is required for authoritative server mutations'
  );
  return { 'X-API-Key': process.env.SERVER_STATE_API_KEY };
}

export function hasServerStateApi() {
  return getBaseUrl() !== null;
}

export async function getAuthoritativeServers(): Promise<Array<LiveServer> | null> {
  return hasServerStateApi() ? request<Array<LiveServer>>('/servers') : null;
}

export async function getAuthoritativeServer(
  address: string
): Promise<LiveServer | null> {
  return hasServerStateApi()
    ? request<LiveServer>(`/servers/${encodeURIComponent(address)}`)
    : null;
}

/**
 * Reserve the same match in the authoritative deployment's Redis.
 *
 * The preflight is important because the legacy start route resets a server it
 * already sees as active. We never invoke it unless the server is idle (or is
 * already assigned to this match), and verify the assignment afterwards.
 */
export async function reserveAuthoritativeServer(
  matchId: number,
  address: string
) {
  if (!hasServerStateApi()) return null;

  const current = await getAuthoritativeServer(address);
  if (current?.status === ServerStatus.ACTIVE && current.matchId === matchId) {
    return current;
  }
  if (current?.status !== ServerStatus.IDLE) {
    throw new Error(
      `Authoritative server ${address} is ${current?.status || 'missing'} and cannot be reserved`
    );
  }

  await request(`/matches/${matchId}/start`, {
    method: 'POST',
    headers: mutationHeaders(),
    body: JSON.stringify({ address }),
  });
  const reserved = await getAuthoritativeServer(address);
  if (reserved?.status !== ServerStatus.ACTIVE || reserved.matchId !== matchId) {
    throw new Error(
      `Authoritative server ${address} did not become active for match ${matchId}`
    );
  }
  return reserved;
}

/** Release only an assignment owned by this match, never another active match. */
export async function releaseAuthoritativeServer(
  matchId: number,
  address: string
) {
  if (!hasServerStateApi()) return false;

  const current = await getAuthoritativeServer(address);
  if (current?.status !== ServerStatus.ACTIVE || current.matchId !== matchId) {
    return false;
  }
  await request<void>(`/matches/${matchId}/teardown`, {
    method: 'POST',
    headers: mutationHeaders(),
    body: '{}',
  });
  return true;
}
