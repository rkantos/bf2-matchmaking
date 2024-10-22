import { MatchEvent } from '@bf2-matchmaking/types';

export const bot = () => {
  const basePath = 'https://bot.bf2-matchmaking-production.up.railway.app';
  return {
    postMatchEvent: async (matchId: number, event: MatchEvent) => {
      const headers = {
        'Content-Type': 'application/json',
      };
      const res = await fetch(`${basePath}/api/match_events`, {
        headers,
        method: 'POST',
        body: JSON.stringify({ matchId, event }),
      });
      if (res.ok) {
        return { data: res, error: null };
      } else {
        const error = await res.text();
        return { data: null, error };
      }
    },
  };
};
