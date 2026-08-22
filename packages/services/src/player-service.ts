import {
  isNotNull,
  isTeamspeakPlayer,
  MatchesJoined,
  MatchPlayerResultsInsert,
  MatchPlayersInsert,
  PlayerRatingsRow,
  RatedMatchPlayer,
  TeamspeakPlayer,
} from '@bf2-matchmaking/types';
import { client, verifyResult } from '@bf2-matchmaking/supabase';
import {
  hasNotKeyhash,
  mapToKeyhashes,
  toPlayerRatingUpdate,
} from '@bf2-matchmaking/utils';
import { logMessage, warn } from '@bf2-matchmaking/logging';

export async function updatePlayerRatings(
  playerResults: Array<MatchPlayerResultsInsert>,
  config: number
) {
  const playerRatings = await client()
    .getPlayerRatingsByIdList(
      playerResults.map((p) => p.player_id),
      config
    )
    .then(verifyResult);

  const playerUpdates = playerResults
    .map(toPlayerRatingUpdate(playerRatings, config))
    .filter(isNotNull);

  if (playerUpdates.length > 0) {
    return client().upsertPlayerRatings(playerUpdates).then(verifyResult);
  }

  return [];
}

export async function fixMissingMatchPlayers(match: MatchesJoined) {
  const keyHashes = mapToKeyhashes(match.rounds);
  const orphanKeys = keyHashes.filter(hasNotKeyhash(match));
  const orphanPlayers = match.players.filter(
    (p) => !(p.keyhash && keyHashes.includes(p.keyhash))
  );

  if (orphanPlayers.length === 1 && orphanKeys.length === 1) {
    const player = orphanPlayers[0];
    await client().updatePlayer(player.id, { keyhash: orphanKeys[0] });

    const { data } = await client().getMatch(match.id);
    logMessage(`Match ${match.id}: Fixed missing player`, {
      player,
      keyhash: orphanKeys[0],
      match: data,
    });

    return data;
  }
  return null;
}

export async function getTeamspeakPlayer(
  identifier: string
): Promise<TeamspeakPlayer | null> {
  const { data } = await client().getPlayerByTeamspeakId(identifier);
  if (!isTeamspeakPlayer(data)) {
    warn('MatchQueue', `Player with ${identifier} not found`);
    return null;
  }
  return data;
}

export function sumRating(acc: number, player: RatedMatchPlayer) {
  return acc + player.rating;
}

/**
 * Which config's ratings a draft should read.
 *
 * A new queue has no ratings of its own, so withRating() falls back to 1500 for
 * everyone and both draft modes lose the thing they balance on. Pointing it at
 * an established config played in the same format gives real history from the
 * queue's first match.
 *
 * Reads only. Results are written against the match's own config
 * (updatePlayerRatings is called with match.config.id), so a borrowed ladder is
 * never written back into.
 */
export function ratingsConfigId(configId: number) {
  const configured = Number(process.env.RATINGS_CONFIG_ID);
  return Number.isInteger(configured) && configured > 0 ? configured : configId;
}

export const withRating =
  (ratings: Array<PlayerRatingsRow>) =>
  (mp: MatchPlayersInsert): RatedMatchPlayer => ({
    ...mp,
    rating: ratings.find((r) => r.player_id === mp.player_id)?.rating || 1500,
  });
