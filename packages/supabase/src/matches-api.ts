import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { MatchesInsert } from './types';
import { JoinedMatch, Match, MatchPlayer } from 'web-ssr/app/lib/supabase.server';

export default (client: SupabaseClient<Database>) => ({
  createMatch: (values: MatchesInsert) =>
    client.from('matches').insert([values]).select().single(),
  getMatches: () => client.from('matches').select('*'),
  getOpenMatches: () => client.from('matches').select('*').eq('status', 'open'),
  getMatch: (matchId: number | undefined) =>
    client
      .from('matches')
      .select<
        '*, players(*), maps(*), channel(*), teams:match_players(player_id, team, captain)',
        JoinedMatch
      >(
        '*, players(*), maps(*), channel(*), teams:match_players(player_id, team, captain)'
      )
      .eq('id', matchId)
      .single(),

  updateMatch: (matchId: string | undefined, values: Partial<Match>) =>
    client.from('matches').update(values).eq('id', matchId),

  createMatchPlayer: (match_id: number, player_id: string) =>
    client.from('match_players').insert([{ match_id, player_id }]),

  deleteMatchPlayer: (matchId: string, playerId: string) =>
    client
      .from('match_players')
      .delete()
      .eq('match_id', matchId)
      .eq('player_id', playerId),

  updateMatchPlayer: (matchId: number, playerId: string, values: Partial<MatchPlayer>) =>
    client
      .from('match_players')
      .update(values)
      .eq('match_id', matchId)
      .eq('player_id', playerId),

  createMatchMaps: (match_id: number, ...maps: Array<number>) =>
    client.from('match_maps').insert(maps.map((mapId) => ({ match_id, map_id: mapId }))),
});
