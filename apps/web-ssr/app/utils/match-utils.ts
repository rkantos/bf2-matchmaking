import { JoinedMatch, Match, Player } from '~/lib/supabase.server';

export const isNotDeleted = (match: Match) => match.status !== 'deleted';
export const isOpen = (match: Match) => match.status === 'open';
export const isStarted = (match: Match) => match.status === 'started' || match.status === 'closed';

export const shuffleArray = <T = unknown>(array: Array<T>) => {
  const clonedArray = [...array];
  for (let i = clonedArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clonedArray[i], clonedArray[j]] = [clonedArray[j], clonedArray[i]];
  }
  return clonedArray;
};

export const assignMatchPlayerTeams = (players: Array<Player>) =>
  shuffleArray(players).map((player, i) => ({
    playerId: player.id,
    team: i % 2 === 1 ? 'a' : 'b',
  }));

export const isAssignedTeam = (match: JoinedMatch, playerId: string) =>
  match.teams.some(({ player_id, team }) => player_id === playerId && team !== null);

export const getTeamCaptain = (match: JoinedMatch, team: string) => {
  const playerId = match.teams.find((player) => player.captain && player.team === team)?.player_id;
  return match.players.find(({ id }) => id === playerId);
};