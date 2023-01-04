import { RoundsJoined } from '@bf2-matchmaking/supabase/src/types';

export const groupRoundsByServer = (rounds: Array<RoundsJoined>) => {
  const groupedByServers = rounds.reduce<Record<string, Array<RoundsJoined>>>((acc, cur) => {
    const serverRounds = acc[cur.server.name];
    if (serverRounds) {
      return { ...acc, [cur.server.name]: serverRounds.concat(cur) };
    } else {
      return { ...acc, [cur.server.name]: [cur] };
    }
  }, {});

  return Object.entries(groupedByServers).sort((serverA, serverB) =>
    serverA[0].localeCompare(serverB[0])
  );
};
