import { createServerClient, SupabaseClient } from '@supabase/auth-helpers-remix';
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { Database } from './databse.types';

type Player = Database['public']['Tables']['players']['Row'];
type Map = Database['public']['Tables']['maps']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

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

const getClient = () => {
  invariant(supabase, 'Supabase client is not initiated.');
  return supabase;
};

export const getSession = () => getClient().auth.getSession();

export const getMatch = (
  matchId: string | undefined
): PromiseLike<
  PostgrestSingleResponse<Match & { maps: Array<Map> } & { players: Array<Player> }>
> => getClient().from('matches').select('*, maps(*), players(*)').eq('id', matchId).single();

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
