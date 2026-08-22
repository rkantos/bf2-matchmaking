'use server';
import { getValues } from '@bf2-matchmaking/utils/form';
import { players } from '@/lib/supabase/supabase-server';
import { verifySingleResult } from '@bf2-matchmaking/supabase';
import { parseError } from '@bf2-matchmaking/services/error';
import { ActionResult } from '@/lib/types/form';
import { gather } from '@bf2-matchmaking/redis/gather';

export async function registerTeamspeakId(data: FormData): Promise<ActionResult> {
  try {
    const { tsid, playerId } = getValues(data, 'tsid', 'playerId');
    const player = await players
      .update(playerId, { teamspeak_id: tsid })
      .then(verifySingleResult);
    // The gather caches players by teamspeak id; a stale entry under this id
    // would shadow the row we just wrote.
    await gather.deletePlayer(tsid);
    return {
      success: `Teamspeak ID registered for ${player.nick}`,
      ok: true,
      error: null,
    };
  } catch (e) {
    return {
      success: null,
      ok: false,
      error: `Failed to register teamspeak id (${parseError(e)})`,
    };
  }
}

export async function registerKeyhash(data: FormData): Promise<ActionResult> {
  try {
    const { keyhash, playerId } = getValues(data, 'keyhash', 'playerId');
    const player = await players.update(playerId, { keyhash }).then(verifySingleResult);
    // Summon verification matches server players to gather players by keyhash,
    // so a cached record holding the previous one makes this player permanently
    // unverifiable.
    if (player.teamspeak_id) {
      await gather.deletePlayer(player.teamspeak_id);
    }
    return {
      success: `Keyhash registered for ${player.nick}`,
      ok: true,
      error: null,
    };
  } catch (e) {
    return {
      success: null,
      ok: false,
      error: `Failed to register keyhash (${parseError(e)})`,
    };
  }
}
