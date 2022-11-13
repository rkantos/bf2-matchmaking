import { createServerClient, SupabaseClient } from '@supabase/auth-helpers-remix';
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { Database } from './databse.types';

export type Player = Database['public']['Tables']['players']['Row'];
export type Map = Database['public']['Tables']['maps']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];

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

export const createMatch = (size: string) =>
  getClient<Database>()
    .from('matches')
    .insert([{ size: parseInt(size) }])
    .select()
    .single();

export const getMatch = (
  matchId: string | undefined
): PromiseLike<
  PostgrestSingleResponse<Match & { maps: Array<Map> } & { players: Array<Player> }>
> => getClient().from('matches').select('*, maps(*), players(*)').eq('id', matchId).single();

export const updateMatch = (matchId: string | undefined, values: Partial<Match>) =>
  getClient<Database>().from('matches').update(values).eq('id', matchId);

export const joinMatch = (matchId: string, userId: string) =>
  getClient()
    .from('match_players')
    .insert([{ match_id: parseInt(matchId), player_id: userId }]);

export const leaveMatch = (matchId: string, userId: string) =>
  getClient()
    .from('match_players')
    .delete()
    .eq('match_id', parseInt(matchId))
    .eq('player_id', userId);

export const addMapsToMatch = (matchId: string, ...maps: Array<number>) =>
  getClient<Database>()
    .from('match_maps')
    .insert(maps.map((mapId) => ({ match_id: parseInt(matchId), map_id: mapId })));
