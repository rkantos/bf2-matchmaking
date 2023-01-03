import { JoinedMatch, Player } from '../libs/supabase/supabase';

export const getTeamPlayers = (match: JoinedMatch, team: 'a' | 'b' | null) =>
  match.teams
    .filter((player) => player.team === team)
    .map((teamPlayer) => match.players.find((player) => player.id === teamPlayer.player_id))
    .filter((player): player is Player => player !== undefined);

export const isAssignedTeam = (match: JoinedMatch, playerId: string) =>
  match.teams.some(({ player_id, team }) => player_id === playerId && team !== null);

export const getTeamCaptain = (match: JoinedMatch, team: string) => {
  const playerId = match.teams.find((player) => player.captain && player.team === team)?.player_id;
  return match.players.find(({ id }) => id === playerId);
};
