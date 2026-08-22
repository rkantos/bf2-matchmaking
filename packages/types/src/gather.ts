import { GatherPlayer, MatchesJoined } from './database-types';
import { StreamEventReply } from './redis';

export enum GatherStatus {
  Queueing = 'Queueing',
  Summoning = 'Summoning',
  /** Captains are picking teams; only reached when draft mode is 'captains'. */
  Drafting = 'Drafting',
  Starting = 'Starting',
  Aborting = 'Aborting',
  Failed = 'Failed',
}

/**
 * How teams are decided once everyone has been summoned.
 *
 * 'elo' builds balanced teams automatically from player ratings and starts the
 * match immediately. 'captains' pauses on a snake draft run by two randomly
 * chosen players from the gather.
 */
export enum GatherDraftMode {
  Elo = 'elo',
  Captains = 'captains',
}

export interface GatherDraftPlayer {
  playerId: string;
  teamspeakId: string;
  nick: string;
  rating: number;
}

export interface GatherDraftState {
  matchId: number;
  /** Player ids of the two captains, index 0 leads team 1. */
  captains: [string, string];
  /** Player ids still available to pick. */
  pool: Array<string>;
  team1: Array<string>;
  team2: Array<string>;
  /** Which team picks next. */
  turn: 1 | 2;
  /** Zero-based index into the snake pick order. */
  pickIndex: number;
  players: Array<GatherDraftPlayer>;
}

export interface GatherState extends Record<string, string | number | undefined> {
  status: GatherStatus;
  address: string;
  summonedAt?: number;
  matchId?: string;
  summoningAt?: string;
  failReason?: string;
}
export interface StatusChange {
  prevStatus: GatherStatus | null;
  status: GatherStatus;
  payload: unknown;
}
export interface SummoningStatusChange extends StatusChange {
  status: GatherStatus.Summoning;
  payload: { address: string };
}
export interface StartingStatusChange extends StatusChange {
  status: GatherStatus.Starting;
  payload: MatchesJoined;
}
export interface AbortingStatusChange extends StatusChange {
  status: GatherStatus.Aborting;
  payload: Array<GatherPlayer>;
}

export type InitatedGatherEvent = StreamEventReply<
  'initiated',
  { address: string; clientUIds: Array<string> }
>;
export type PlayerJoiningGatherEvent = StreamEventReply<
  'playerJoining',
  { clientUId: string; nick: string }
>;
export type PlayerJoiniedGatherEvent = StreamEventReply<
  'playerJoined',
  { clientUId: string; nick: string }
>;
export type PlayerRejectedGatherEvent = StreamEventReply<
  'playerRejected',
  { clientUId: string; reason: 'tsid' | 'keyhash'; nick: string }
>;
export type PlayerRemovedGatherEvent = StreamEventReply<
  'playerRemoved',
  { clientUId: string; reason: string; nick: string }
>;
export type PlayerLeftGatherEvent = StreamEventReply<
  'playerLeft',
  { clientUId: string; nick: string }
>;
export type PlayersSummonedGatherEvent = StreamEventReply<
  'playersSummoned',
  { address: string; clientUIds: Array<string> }
>;
export type SummonCompleteGatherEvent = StreamEventReply<
  'summonComplete',
  { clientUIds: Array<string> }
>;
export type DraftStartedGatherEvent = StreamEventReply<
  'draftStarted',
  { matchId: number }
>;
export type DraftUpdatedGatherEvent = StreamEventReply<
  'draftUpdated',
  { matchId: number; pickIndex: number; complete: boolean }
>;
export type PlayerMovedGatherEvent = StreamEventReply<
  'playerMoved',
  { clientUId: string; toChannel: string; nick: string }
>;
export type GatherStartedGatherEvent = StreamEventReply<
  'gatherStarted',
  { matchId: string }
>;
export type NextQueueGatherEvent = StreamEventReply<
  'nextQueue',
  { clientUIds: Array<string>; address: string }
>;
export type SummonFailGatherEvent = StreamEventReply<
  'summonFail',
  { missingClientUIds: Array<string> }
>;
export type GatherEvent =
  | InitatedGatherEvent
  | PlayerJoiningGatherEvent
  | PlayerJoiniedGatherEvent
  | PlayerRejectedGatherEvent
  | PlayerLeftGatherEvent
  | PlayersSummonedGatherEvent
  | PlayerRemovedGatherEvent
  | SummonCompleteGatherEvent
  | DraftStartedGatherEvent
  | DraftUpdatedGatherEvent
  | PlayerMovedGatherEvent
  | GatherStartedGatherEvent
  | NextQueueGatherEvent
  | SummonFailGatherEvent;
