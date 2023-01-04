import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import matches from './matches-api';
import { RoundsJoined, ServersJoined } from './types';

export default (client: SupabaseClient<Database>) => ({
  ...matches(client),
  getPlayerByUserId: (userId: string) =>
    client.from('players').select('*').eq('user_id', userId).single(),
  getRounds: () =>
    client
      .from('rounds')
      .select<'*, map(*), server(*)', RoundsJoined>('*, map(*), server(*)'),
  getServers: () =>
    client
      .from('servers')
      .select<'*, matches(id, status)', ServersJoined>('*, matches(id, status)')
      .or('status.eq.picking,status.eq.started', { foreignTable: 'matches' }),
});
