import { createServerClient, SupabaseClient } from '@supabase/auth-helpers-remix';
import invariant from 'tiny-invariant';

let supabase: SupabaseClient | undefined;
export const initSupabase = (request: Request) => {
  invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
  invariant(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY not defined.');
  const response = new Response();
  supabase = createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
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

export const getMatch = (matchId: string | undefined) =>
  getClient().from('matches').select('*, maps(*), players(*)').eq('id', matchId).single();

export const joinMatch = (matchId: string, userId: string) =>
  getClient()
    .from('match_players')
    .insert([{ match_id: matchId, player_id: userId }]);
