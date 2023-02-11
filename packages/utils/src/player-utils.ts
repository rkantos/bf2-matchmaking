import { MatchesJoined, MatchPlayersRow, PlayersRow } from '@bf2-matchmaking/types';
import { shuffleArray } from './array-utils';

export const assignMatchPlayerTeams = (players: Array<PlayersRow>) =>
  shuffleArray(players).map((player, i) => ({
    player_id: player.id,
    team: i % 2 === 1 ? 'a' : 'b',
  }));

export const getTeamPlayers = (match: MatchesJoined, team: 'a' | 'b' | null) =>
  match.teams
    .filter((player) => player.team === team)
    .map((teamPlayer) =>
      match.players.find((player) => player.id === teamPlayer.player_id)
    )
    .filter((player): player is PlayersRow => player !== undefined);

export const getPlayersReadyStatus = (match: MatchesJoined) =>
  match.teams.map((teamPlayer) => {
    const player = match.players.find((player) => player.id === teamPlayer.player_id);
    return {
      id: teamPlayer.player_id,
      ready: teamPlayer.ready,
      name: player?.full_name || '-',
    };
  });
