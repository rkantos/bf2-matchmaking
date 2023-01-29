import { MatchesJoined, MatchesRow, MatchStatus } from '@bf2-matchmaking/types';

export const isOpen = (match: MatchesRow) => match.status === MatchStatus.Open;
export const isStarted = (match: MatchesRow) =>
  match.status === MatchStatus.Ongoing || match.status === MatchStatus.Closed;

export const isAssignedTeam = (match: MatchesJoined, playerId: string) =>
  match.teams.some(({ player_id, team }) => player_id === playerId && team !== null);

export const getTeamCaptain = (match: MatchesJoined, team: string) => {
  const playerId = match.teams.find((player) => player.captain && player.team === team)?.player_id;
  return match.players.find(({ id }) => id === playerId);
};

export const isCaptain = (match: MatchesJoined, userId?: string) => {
  const playerId = match.players.find((player) => player.user_id === userId)?.id;
  return match.teams.some((player) => player.player_id === playerId && player.captain);
};
