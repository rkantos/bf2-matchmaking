import { getApiBaseUrl } from '@bf2-matchmaking/utils/base-urls';

export const getEventSource = (url: string): EventSource => {
  const source = new EventSource(url);
  source.addEventListener('error', (event) => {
    console.error('SSE Error:', JSON.stringify(event));
  });
  return source;
};

// Browser-side: only NEXT_PUBLIC_API_BASE_URL can reach here, since Next inlines
// NEXT_PUBLIC_-prefixed vars at build time. Defaults to production when unset.
const basePath = getApiBaseUrl();
const gathers = `${basePath}/gathers`;
const servers = `${basePath}/servers`;
export const api = {
  getGatherEventsStream: (config: number | string, start: string | undefined) =>
    getEventSource(`${gathers}/${config}/events/stream?start=${start}`),
  getServerLiveStream: (address: string) =>
    getEventSource(`${servers}/${address}/stream`),
};
