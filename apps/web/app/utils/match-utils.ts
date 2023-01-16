import { MatchesJoined, MatchesRow, MatchStatus, PlayersRow } from '@bf2-matchmaking/types';

export const isOpen = (match: MatchesRow) => match.status === MatchStatus.Open;
export const isStarted = (match: MatchesRow) =>
  match.status === MatchStatus.Ongoing || match.status === MatchStatus.Closed;

export const shuffleArray = <T = unknown>(array: Array<T>) => {
  const clonedArray = [...array];
  for (let i = clonedArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clonedArray[i], clonedArray[j]] = [clonedArray[j], clonedArray[i]];
  }
  return clonedArray;
};

export const assignMatchPlayerTeams = (players: Array<PlayersRow>) =>
  shuffleArray(players).map((player, i) => ({
    playerId: player.id,
    team: i % 2 === 1 ? 'a' : 'b',
  }));

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

export const compareMatchByChannel = (channel: number) => (match: MatchesJoined) =>
  match.channel.id === channel;
