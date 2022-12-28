import { JoinedRound } from '../lib/supabase.server';

export const groupRoundsByServer = (rounds: Array<JoinedRound>) => {
  const groupedByServers = rounds.reduce<Record<string, Array<JoinedRound>>>((acc, cur) => {
    const serverRounds = acc[cur.server];
    if (serverRounds) {
      return { ...acc, [cur.server]: serverRounds.concat(cur) };
    } else {
      return { ...acc, [cur.server]: [cur] };
    }
  }, {});

  return Object.entries(groupedByServers).sort((serverA, serverB) =>
    serverA[0].localeCompare(serverB[0])
  );
};
