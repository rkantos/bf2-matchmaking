import { list } from '../core/list';
import { del } from '../core/generic';
import { getMultiple, json } from '../core/json';
import { GatherPlayer, MatchConfigsRow } from '@bf2-matchmaking/types';
import { GatherDraftState, GatherState } from '@bf2-matchmaking/types/gather';
import { GatherStateSchema } from '../schemas';
import { hash } from '../core/hash2';
import { hash as oldHash } from '../core/hash';

export const gather = {
  getQueue: (configId: number) => list(`gather:${configId}:queue`),
  getState: (configId: number) =>
    hash<'status' | 'address' | 'summonedAt' | 'failReason'>(`gather:${configId}`),
  /**
   * Operator-configurable settings, kept separate from the state hash because
   * reset() and nextQueue() delete that hash on every queue cycle - a setting
   * stored there would not survive a single gather.
   */
  getSettings: (configId: number) =>
    hash<'summonTimeout' | 'draftMode'>(`gather:${configId}:settings`),
  /**
   * In-progress captain draft. Absent unless the gather is Drafting.
   *
   * Kept out of the state hash because that hash is deleted on every queue
   * cycle, and because the draft is a structured document rather than flat
   * fields.
   */
  getDraft: (configId: number | string) =>
    json<GatherDraftState>(`gather:${configId}:draft`),
  getPlayer: (id: string) => json<GatherPlayer>(`gather:players:${id}`).get(),
  getPlayersByIdentifier: (identifiers: Array<string>) =>
    getMultiple<GatherPlayer>(identifiers.map((id) => `gather:players:${id}`)),
  setPlayer: (player: GatherPlayer) =>
    json<GatherPlayer>(`gather:players:${player.teamspeak_id}`).set(player),
  /**
   * Drop a cached gather player so the next lookup re-reads the database.
   *
   * getGatherPlayer serves from this cache and only falls back to the database
   * on a miss. Without invalidation, a player who changes their keyhash or
   * teamspeak_id keeps being matched on the old value, and summon verification
   * can never recognise them as present on the server.
   */
  deletePlayer: (teamspeakId: string) => del(`gather:players:${teamspeakId}`),
};
