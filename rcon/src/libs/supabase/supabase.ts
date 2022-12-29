import { createClient, SupabaseClient } from '@supabase/supabase-js';
import invariant from 'tiny-invariant';
import { Database } from './database.types';
export type Round = Database['public']['Tables']['rounds'];
export type Map = Database['public']['Tables']['maps'];

let supabase: SupabaseClient<Database> | undefined;
const getClient = () => {
  if (!supabase) {
    invariant(process.env.SUPABASE_URL, 'SUPABASE_URL not defined.');
    invariant(process.env.SUPABASE_SERVICE_KEY, 'SUPABASE_SERVICE_KEY not defined.');
    supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
  return supabase;
};

export const createRound = (round: Round['Insert']) =>
  getClient().from('rounds').insert([round]).select().single();

export const searchMap = (map: string) =>
  getClient().from('maps').select().textSearch('name', `'${map}'`);

export const upsertServer = (ip: string, name: string) =>
  getClient().from('servers').upsert({ ip, name }).select().single();
