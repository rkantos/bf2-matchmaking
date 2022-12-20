import {
  createClient,
  RealtimePostgresInsertPayload,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { Database } from './database.types';
import { APIUser } from 'discord-api-types/v10';
import { verifySingleResult } from '../../utils';

export type Player = Database['public']['Tables']['players']['Row'];
export type InsertPlayer = Database['public']['Tables']['players']['Insert'];
export type Map = Database['public']['Tables']['maps']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchPlayer = Database['public']['Tables']['match_players']['Row'];
export type DiscordChannel = Database['public']['Tables']['discord_channels']['Row'];
export type JoinedMatch = Match & { players: Array<Player> } & { channel: DiscordChannel };

let supabase: SupabaseClient<Database> | undefined;
const getClient = () => {
  if (!supabase) {
    invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
    invariant(process.env.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_KEY not defined.');
    supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
};

export const onMatchesInsert = (
  callback: (payload: RealtimePostgresInsertPayload<Match>) => void
) =>
  getClient()
    .channel('public:matches')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, callback)
    .subscribe();

export const onMatchPlayersChange = (
  callback: (payload: RealtimePostgresChangesPayload<MatchPlayer>) => void
) =>
  getClient()
    .channel('public:match_players')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_players' }, callback)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'match_players' }, callback)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_players' }, callback)
    .subscribe();

export const getChannel = (channelId: number | null) =>
  getClient().from('discord_channels').select('*').eq('id', channelId).single();

export const getChannels = () => getClient().from('discord_channels').select('*');

export const getPlayer = (playerId: string | undefined) =>
  getClient().from('players').select('*').eq('id', playerId).single();

export const createPlayer = (player: InsertPlayer) =>
  getClient().from('players').insert([player]).select().single();

export const createMatchPlayer = (match_id: number, player_id: string) =>
  getClient().from('match_players').insert([{ match_id, player_id }]).select('*');

export const deleteMatchPlayer = (matchId: number, playerId: string) =>
  getClient().from('match_players').delete().eq('match_id', matchId).eq('player_id', playerId);

export const updateMatchPlayer = (
  matchId: number,
  playerId: string,
  values: Partial<MatchPlayer>
) =>
  getClient()
    .from('match_players')
    .update(values)
    .eq('match_id', matchId)
    .eq('player_id', playerId);

export const getOpenMatchByChannel = (channelId: string) =>
  getClient()
    .from('matches')
    .select<'*, players(*), channel!inner(*)', JoinedMatch>('*, players(*), channel!inner(*)')
    .eq('channel.channel_id', channelId)
    .eq('status', 'open')
    .single();

export const getMatch = (matchId: number | undefined) =>
  getClient()
    .from('matches')
    .select<'*, players(*), channel(*)', JoinedMatch>('*, players(*), channel(*)')
    .eq('id', matchId)
    .single();

export const updateMatch = (matchId: number, values: Partial<Match>) =>
  getClient().from('matches').update(values).eq('id', matchId);
/*
export type JoinedMatch = Match & { maps: Array<Map> } & { players: Array<Player> } & {
  teams: Array<{ player_id: string; team: string | null; captain: boolean }>;
};

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
