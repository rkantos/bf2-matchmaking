import { PlayersRow } from '@bf2-matchmaking/types';
import { shuffleArray } from './array-utils';

export const assignMatchPlayerTeams = (players: Array<PlayersRow>) =>
  shuffleArray(players).map((player, i) => ({
    playerId: player.id,
    team: i % 2 === 1 ? 'a' : 'b',
  }));
