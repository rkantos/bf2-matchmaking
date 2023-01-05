import { MatchesRow } from '@bf2-matchmaking/supabase/src/types';
import { info } from '@bf2-matchmaking/logging';

export const handleInsertedMatch = (match: MatchesRow) => {
  info('handleInsertedMatch', `New match ${match.id}`);
};

export const handleUpdatedMatch = (match: MatchesRow, oldMatch: Partial<MatchesRow>) => {
  info(
    'handleUpdatedMatch',
    `Match ${match.id} updated. ${oldMatch.status} -> ${match.status}`
  );
};

export const handleDeletedMatch = (oldMatch: Partial<MatchesRow>) => {
  info('handleDeletedMatch', `Match ${oldMatch.id} removed`);
};
