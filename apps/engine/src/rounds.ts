import { info, warn } from '@bf2-matchmaking/logging';
import {
  MatchesJoined,
  MatchesRow,
  RoundsRow,
} from '@bf2-matchmaking/supabase/src/types';
import { client, verifyResult } from '@bf2-matchmaking/supabase';

export const handleInsertedRound = async (round: RoundsRow) => {
  info('handleInsertedRound', `New round ${round.id}`);
  const matches = await client()
    .getStartedMatchesByServer(round.server)
    .then(verifyResult);
  if (matches.length === 0) {
    info('handleInsertedRound', `No started match found for round ${round.id}`);
  }
  if (matches.length > 1) {
    warn('handleInsertedRound', `Multiple started matches found for round ${round.id}`);
  }
  const [match] = matches;
  if (match && match.server && match.started_at) {
    const rounds = await client()
      .getServerRoundsByTimestampRange(
        match.server,
        match.started_at,
        new Date().toISOString()
      )
      .then(verifyResult);
    if (rounds.length >= 4) {
      await setMatchStatusClosed(match);
    }
  }
};

const setMatchStatusClosed = async (match: MatchesRow) => {
  client()
    .updateMatch(match.id, { status: 'closed', closed_at: new Date().toISOString() })
    .then(verifyResult);
};
