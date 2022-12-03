import {
  PostgrestSingleResponse,
  createClient,
  SupabaseClient,
  RealtimePostgresInsertPayload,
} from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { Database } from './database.types';

export type Player = Database['public']['Tables']['players']['Row'];
export type Map = Database['public']['Tables']['maps']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchPlayer = Database['public']['Tables']['match_players']['Row'];
export type JoinedMatch = Match & { maps: Array<Map> } & { players: Array<Player> } & {
  teams: Array<{ player_id: string; team: string | null; captain: boolean }>;
};

let supabase: SupabaseClient<Database> | undefined;
export const initSupabase = (request: Request) => {
  invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
  invariant(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY not defined.');
  const response = new Response();
  supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  return response;
};

const getClient = () => {
  if (!supabase) {
    invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
    invariant(process.env.SUPABASE_ANON_KEY, 'SUPABASE_ANON_KEY not defined.');
    supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  }
  return supabase;
};

export const subscribeMatches = (
  callback: (payload: RealtimePostgresInsertPayload<Match>) => void
) =>
  getClient()
    .channel('public:matches')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, callback)
    .subscribe();

export const getChannel = (channelId: number | null) =>
  getClient().from('discord_channels').select('*').eq('id', channelId).single();

/*
export const getSession = () => getClient().auth.getSession();

interface CreateMatchOptions {
  size: number;
  pick: string;
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

export const createMatchPlayer = (matchId: string, playerId: string) =>
  getClient()
    .from('match_players')
    .insert([{ match_id: parseInt(matchId), player_id: playerId }]);

export const deleteMatchPlayer = (matchId: string, playerId: string) =>
  getClient()
    .from('match_players')
    .delete()
    .eq('match_id', parseInt(matchId))
    .eq('player_id', playerId);

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
*/
