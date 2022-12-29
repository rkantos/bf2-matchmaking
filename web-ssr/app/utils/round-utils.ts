import { JoinedRound } from '../lib/supabase.server';

export const groupRoundsByServer = (rounds: Array<JoinedRound>) => {
  const groupedByServers = rounds.reduce<Record<string, Array<JoinedRound>>>((acc, cur) => {
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
