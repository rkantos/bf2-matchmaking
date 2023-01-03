import { Database } from 'web-ssr/app/lib/databse.types';

export type PlayersRow = Database['public']['Tables']['players']['Row'];
export type MapsRow = Database['public']['Tables']['maps']['Row'];
export type MatchesRow = Database['public']['Tables']['matches']['Row'];
export type MatchPlayersRow = Database['public']['Tables']['match_players']['Row'];
export type RoundsRow = Database['public']['Tables']['rounds']['Row'];
export type ServersRow = Database['public']['Tables']['servers']['Row'];
export type DiscordChannelsRow = Database['public']['Tables']['discord_channels']['Row'];

export type MatchesInsert = Database['public']['Tables']['matches']['Insert'];

export type MatchesJoined = MatchesRow & { maps: Array<MapsRow> } & {
  players: Array<PlayersRow>;
} & { channel: DiscordChannelsRow } & {
  teams: Array<{ player_id: string; team: string | null; captain: boolean }>;
};
export type RoundsJoined = RoundsRow & { map: MapsRow } & { server: ServersRow };
