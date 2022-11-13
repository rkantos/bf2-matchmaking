import { Match, Player } from '~/lib/supabase.server';

export const isNotDeleted = (match: Match) => match.status !== 'deleted';

const shuffleArray = <T = unknown>(array: Array<T>) => {
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
