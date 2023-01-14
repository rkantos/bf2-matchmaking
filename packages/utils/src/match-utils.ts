import { MatchesJoined } from '@bf2-matchmaking/types';

export const findCaptain = (
  playerId: string,
  players: Array<{ player_id: string; team: string | null; captain: boolean }>
) => players.find(({ captain, player_id }) => captain && player_id === playerId);

export const getPlayerPool = (match: MatchesJoined) =>
  match.teams.filter(({ team }) => team === null);

export const getCurrentTeam = (match: MatchesJoined) =>
  getPlayerPool(match).length % 2 === 0 ? 'a' : 'b';

export const getCurrentCaptain = (match: MatchesJoined) =>
  match.players.find(
    (player) =>
      match.teams.find(({ team, captain }) => captain && team === getCurrentTeam(match))
        ?.player_id === player.id
  );

export const isAssignedTeam = (
  match: MatchesJoined,
  playerId: string,
  team: 'a' | 'b' | null
) => match.teams.some((player) => player.player_id === playerId && player.team === team);
