import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import matches from './matches-api';
import { RoundsJoined } from './types';

export default (client: SupabaseClient<Database>) => ({
  ...matches(client),
  getPlayerByUserId: (userId: string) =>
    client.from('players').select('*').eq('user_id', userId).single(),
  getRounds: () =>
    client
      .from('rounds')
      .select<'*, map(*), server(*)', RoundsJoined>('*, map(*), server(*)'),
});
