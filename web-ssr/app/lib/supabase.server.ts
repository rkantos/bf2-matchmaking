import { createServerClient, SupabaseClient } from '@supabase/auth-helpers-remix';
import { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { Database } from './databse.types';

export type Player = Database['public']['Tables']['players']['Row'];
export type Map = Database['public']['Tables']['maps']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchPlayer = Database['public']['Tables']['match_players']['Row'];
export type Round = Database['public']['Tables']['rounds']['Row'];
export type Server = Database['public']['Tables']['servers']['Row'];
export type JoinedMatch = Match & { maps: Array<Map> } & { players: Array<Player> } & {
  teams: Array<{ player_id: string; team: string | null; captain: boolean }>;
};
export type JoinedRound = Round & { map: Map } & { server: Server };

let supabase: SupabaseClient | undefined;
export const initSupabase = (request: Request) => {
  invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
  invariant(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY not defined.');
  const response = new Response();
  supabase = createServerClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    request,
    response,
  });
  return response;
};

const getClient = <T = any>() => {
  invariant(supabase, 'Supabase client is not initiated.');
  return supabase as SupabaseClient<T>;
};

export const getSession = () => getClient().auth.getSession();

interface CreateMatchOptions {
  size: number;
  pick: string;
  channel: number;
}
export const createMatch = (options: CreateMatchOptions) =>
  getClient<Database>().from('matches').insert([options]).select().single();

export const getMatch = (
  matchId: string | undefined
): PromiseLike<PostgrestSingleResponse<JoinedMatch>> =>
  getClient()
    .from('matches')
    .select('*, maps(*), players(*), teams:match_players(player_id, team, captain)')
    .eq('id', matchId)
    .single();

export const updateMatch = (matchId: string | undefined, values: Partial<Match>) =>
  getClient<Database>().from('matches').update(values).eq('id', matchId);

export const createMatchPlayer = (match_id: string, player_id: string) =>
  getClient().from('match_players').insert([{ match_id, player_id }]);

export const deleteMatchPlayer = (matchId: string, playerId: string) =>
  getClient().from('match_players').delete().eq('match_id', matchId).eq('player_id', playerId);

export const updateMatchPlayer = (
  matchId: number,
  playerId: string,
  values: Partial<MatchPlayer>
) =>
  getClient<Database>()
    .from('match_players')
    .update(values)
    .eq('match_id', matchId)
    .eq('player_id', playerId);

export const createMatchMaps = (matchId: string, ...maps: Array<number>) =>
  getClient<Database>()
    .from('match_maps')
    .insert(maps.map((mapId) => ({ match_id: parseInt(matchId), map_id: mapId })));

export const getPlayerByUserId = (userId: string) =>
  getClient<Database>().from('players').select('*').eq('user_id', userId).single();

export const getRounds = (): PromiseLike<PostgrestResponse<JoinedRound>> =>
  getClient().from('rounds').select('*, map(*), server(*)');
