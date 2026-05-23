import { MatchPlayersInsert, PlayersRow } from './database-types';

export * from './database-types.generated';
export * from './api-types';
export * from './database-types';
export * from './type-guards';
export * from './fetch';
export * from './discord';
export * from './rcon';

type WebhookPostgresChangesPayloadBase = {
  schema: string;
  table: string;
};

export type WebhookPostgresInsertPayload<T extends Record<string, any>> =
  WebhookPostgresChangesPayloadBase & {
    type: `${WEBHOOK_POSTGRES_CHANGES_TYPE.INSERT}`;
    record: T;
    old_record: null;
  };

export type WebhookPostgresUpdatePayload<T extends Record<string, any>> =
  WebhookPostgresChangesPayloadBase & {
    type: `${WEBHOOK_POSTGRES_CHANGES_TYPE.UPDATE}`;
    record: T;
    old_record: Partial<T>;
  };

export type WebhookPostgresDeletePayload<T extends Record<string, any>> =
  WebhookPostgresChangesPayloadBase & {
    type: `${WEBHOOK_POSTGRES_CHANGES_TYPE.DELETE}`;
    record: null;
    old_record: Partial<T>;
  };

export type WebhookPostgresDeleteTypeCheckedPayload<T extends Record<string, any>> =
  WebhookPostgresChangesPayloadBase & {
    type: `${WEBHOOK_POSTGRES_CHANGES_TYPE.DELETE}`;
    record: null;
    old_record: T;
  };

export type WebhookPostgresChangesPayload<T extends Record<string, any>> =
  | WebhookPostgresInsertPayload<T>
  | WebhookPostgresUpdatePayload<T>
  | WebhookPostgresDeletePayload<T>;

export enum WEBHOOK_POSTGRES_CHANGES_TYPE {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface PostgrestError {
  message: string;
  details: string | null;
  hint: string;
  code: string;
}

export interface DraftStep {
  pool: Array<PlayersRow>;
  team: number | null;
  captain: PlayersRow | null;
}

export interface TeamPlayer extends MatchPlayersInsert {
  player: PlayersRow;
}

export enum MatchReaction {
  READY = '✅',
  CANCEL = '⛔',
}

export enum PollEmoji {
  ACCEPT = '✅',
  REJECT = '❌',
}

export enum LocationEmoji {
  Amsterdam = '🇳🇱',
  Frankfurt = '🇩🇪',
  Warsaw = '🇵🇱',
  Stockholm = '🇸🇪',
  London = '🇬🇧',
  Miami = '🇺🇸',
  NewYork = '🍎',
  Existing = '💎',
}

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export interface RoundStats {
  score: number;
  kills: number;
  deaths: number;
}

export type LiveServerState =
  | 'pending'
  | 'warmup'
  | 'prelive'
  | 'live'
  | 'endlive'
  | 'finished'
  | 'stale';

export interface PendingServer {
  address: string;
  port: string;
  rcon_port: number;
  rcon_pw: string;
  demo_path: string;
}

export type MatchProcessError = 'MISSING_PLAYERS' | 'MISSING_ROUNDS' | 'EXTRA_ROUNDS';

interface AsyncSuccessResponse<T> {
  data: T;
  error: null;
}

export interface AsyncError {
  message: string;
  properties?: Record<string, string | number | boolean | null>;
}
export interface AsyncErrorResponse {
  error: AsyncError;
  data: null;
}

export type AsyncResult<T> = AsyncSuccessResponse<T> | AsyncErrorResponse;

export type PollResult = [string, Array<string>];

export interface CreateServerOptions {
  name: string;
  region: string;
  map?: string | null;
  subDomain: string;
}

export type LogContext = Record<any, any>;

export interface PostRestartServerRequestBody {
  mode: 'infantry' | 'vehicles' | null;
  mapName?: string;
  serverName?: string;
  admins: 'all' | 'none' | number;
  pubobotMatchId?: string;
}
