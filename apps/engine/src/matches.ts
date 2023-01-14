import { client, verifyResult, verifySingleResult } from '@bf2-matchmaking/supabase';
import { info } from '@bf2-matchmaking/logging';
import { shuffleArray } from './utils';
import { assignMatchPlayerTeams } from 'web/app/utils/match-utils';
import { MatchesJoined, MatchesRow } from '@bf2-matchmaking/types';
import { sendMatchInfoMessage } from './message-service';

export const handleInsertedMatch = (match: MatchesRow) => {
  info('handleInsertedMatch', `New match ${match.id}`);
};

export const handleUpdatedMatch = async (
  match: MatchesRow,
  oldMatch: Partial<MatchesRow>
) => {
  info(
    'handleUpdatedMatch',
    `Match ${match.id} updated. ${oldMatch.status} -> ${match.status}`
  );
  const matchJoined = await client().getMatch(match.id).then(verifySingleResult);
  await sendMatchInfoMessage(matchJoined);
  if (oldMatch.status === 'open' && match.status === 'picking') {
    if (match.pick === 'random') {
      await setRandomTeams(matchJoined);
    } else {
      await setMatchCaptains(matchJoined);
    }
  }
};

export const handleDeletedMatch = (oldMatch: Partial<MatchesRow>) => {
  info('handleDeletedMatch', `Match ${oldMatch.id} removed`);
};

const setRandomTeams = async (match: MatchesJoined) => {
  await Promise.all(
    assignMatchPlayerTeams(match.players).map(({ playerId, team }) =>
      client().updateMatchPlayer(match.id, playerId, { team })
    )
  );
};

const setMatchCaptains = async (match: MatchesJoined) => {
  const shuffledPlayers = shuffleArray(
    match.players.filter((player) => !player.username.includes('Test'))
  );
  if (shuffledPlayers.length < 2) {
    throw new Error('To few players for captain mode.');
  }
  info(
    'setMatchCaptains',
    `Setting player ${shuffledPlayers[0].id} as captain for team a.`
  );
  await client()
    .updateMatchPlayer(match.id, shuffledPlayers[0].id, {
      team: 'a',
      captain: true,
    })
    .then(verifyResult);
  info(
    'setMatchCaptains',
    `Setting player ${shuffledPlayers[1].id} as captain for team b.`
  );
  await client()
    .updateMatchPlayer(match.id, shuffledPlayers[1].id, {
      team: 'b',
      captain: true,
    })
    .then(verifyResult);
};
