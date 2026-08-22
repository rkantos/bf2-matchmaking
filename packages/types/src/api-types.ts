import { GatherPlayer, MatchesInsert, MatchPlayersInsert } from './database-types';
import { LiveServerState, PlayerListItem, ServerInfo } from './index';
import { LiveServer } from './server';
import { GatherDraftMode, GatherDraftState, GatherState } from './gather';
import { StreamEventReply } from './redis';

export interface SessionUser {
  id: string;
  nick: string;
  keyhash: string;
}

export interface SystemUser extends SessionUser {
  id: 'system';
  nick: 'system';
  keyhash: 'system';
}

export type AccessRoles =
  | 'user'
  | 'player_admin'
  | 'match_admin'
  | 'server_admin'
  | 'system_admin';

export interface LiveInfo extends ServerInfo {
  players: Array<PlayerListItem>;
}

export interface PostServersRequestBody {
  ip: string;
  port: string;
  rcon_pw: string;
  rcon_port: string;
}

export interface PostServerExecRequestBody {
  cmd: 'admin.restartMap' | 'quit';
}

export interface PostServerExecResponseBody {
  reply: string;
}

export interface PostServerPlayersSwitchRequestBody {
  players: Array<string>;
}

export interface LiveMatch {
  matchId: number;
  state: LiveServerState;
  roundsPlayed: number;
  pendingSince?: string | null;
  live_at?: string | null;
  server: LiveServer | null;
}

export interface ActiveLiveMatch extends LiveMatch {
  server: LiveServer;
}

export interface PostMatchRequestBody {
  matchValues: MatchesInsert;
  matchMaps: Array<number> | null;
  matchTeams: Array<MatchPlayersInsert> | null;
}

export interface GetGatherResponse {
  state: GatherState;
  players: Array<GatherPlayer>;
  events: Array<StreamEventReply>;
  /** Operator-configured summon window in ms; the default when never set. */
  summonTimeout: number;
  draftMode: GatherDraftMode;
  /** Present only while captains are picking. */
  draft: GatherDraftState | null;
  testClients: {
    teamspeak: number;
    bf2: number;
  };
  /** Live connection indicators keyed by players.id. */
  connections: Record<
    string,
    {
      teamspeak: boolean;
      bf2: boolean;
      /** Current Battlefield 2 side reported by the game server ("1" or "2"). */
      bf2Team?: string;
    }
  >;
}
