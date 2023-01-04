import { MatchesJoined, RoundsJoined } from '../types';
export const getMatchRounds = async (match: MatchesJoined, client: any) => {
  if (!match.server) {
    return null;
  }
  if (!match.started_at) {
    return null;
  }

  const closedAt = match.closed_at || new Date().toISOString();
  console.log(match.closed_at);
  console.log(match.started_at);
  const { data, error } = await client.getServerRoundsByTimestampRange(
    match.server.ip,
    match.started_at,
    closedAt
  );
  console.log(data);
  if (error) {
    console.log(error);
    return null;
  }
  return data as Array<RoundsJoined>;
};
