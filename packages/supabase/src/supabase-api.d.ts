import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { RoundsJoined, ServersJoined } from './types';
declare const _default: (client: SupabaseClient<Database>) => {
    getPlayerByUserId: (userId: string) => PromiseLike<import("@supabase/supabase-js").PostgrestSingleResponse<{
        id: string;
        updated_at: string;
        username: string;
        full_name: string;
        avatar_url: string;
        user_id: string | null;
        created_at: string;
    }>>;
    getRounds: () => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        id: number;
        created_at: string;
        team1_name: string;
        team1_tickets: string;
        team2_name: string;
        team2_tickets: string;
        server: string;
        map: number;
        si: import("./database.types").Json;
        pl: import("./database.types").Json;
    }, RoundsJoined>;
    getServers: () => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        ip: string;
        name: string;
        updated_at: string;
    }, ServersJoined>;
    getServerRoundsByTimestampRange: (serverIp: string, timestampFrom: string, timestampTo: string) => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        id: number;
        created_at: string;
        team1_name: string;
        team1_tickets: string;
        team2_name: string;
        team2_tickets: string;
        server: string;
        map: number;
        si: import("./database.types").Json;
        pl: import("./database.types").Json;
    }, RoundsJoined>;
    createMatch: (values: {
        id?: number | undefined;
        created_at?: string | null | undefined;
        status?: string | undefined;
        size?: number | undefined;
        pick?: string | undefined;
        channel?: number | null | undefined;
        map_draft?: string | undefined;
        server?: string | null | undefined;
        started_at?: string | null | undefined;
        closed_at?: string | null | undefined;
    }) => PromiseLike<import("@supabase/supabase-js").PostgrestSingleResponse<{
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }>>;
    getMatches: () => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }, {
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }>;
    getOpenMatches: () => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }, {
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }>;
    getMatch: (matchId: number | undefined) => PromiseLike<import("@supabase/supabase-js").PostgrestSingleResponse<import("./types").MatchesJoined>>;
    updateMatch: (matchId: number | undefined, values: {
        id?: number | undefined;
        created_at?: string | null | undefined;
        status?: string | undefined;
        size?: number | undefined;
        pick?: string | undefined;
        channel?: number | null | undefined;
        map_draft?: string | undefined;
        server?: string | null | undefined;
        started_at?: string | null | undefined;
        closed_at?: string | null | undefined;
    }) => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }, undefined>;
    createMatchPlayer: (match_id: number, player_id: string) => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        player_id: string;
        match_id: number;
        updated_at: string;
        team: string | null;
        captain: boolean;
    }, undefined>;
    deleteMatchPlayer: (matchId: string, playerId: string) => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        player_id: string;
        match_id: number;
        updated_at: string;
        team: string | null;
        captain: boolean;
    }, undefined>;
    updateMatchPlayer: (matchId: number, playerId: string, values: Partial<{
        player_id: string;
        match_id: number;
        updated_at: string;
        team: string | null;
        captain: boolean;
    }>) => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        player_id: string;
        match_id: number;
        updated_at: string;
        team: string | null;
        captain: boolean;
    }, undefined>;
    createMatchMaps: (match_id: number, ...maps: number[]) => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        created_at: string | null;
        match_id: number;
        map_id: number;
    }, undefined>;
    getStartedMatchesByServer: (serverIp: string) => import("@supabase/postgrest-js").PostgrestFilterBuilder<{
        Tables: {
            discord_channels: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name: string;
                    uri: string;
                    channel_id: string;
                    server_id: string;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | undefined;
                    uri?: string | undefined;
                    channel_id?: string | undefined;
                    server_id?: string | undefined;
                };
            };
            maps: {
                Row: {
                    id: number;
                    created_at: string | null;
                    name: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    name?: string | null | undefined;
                };
            };
            match_maps: {
                Row: {
                    created_at: string | null;
                    match_id: number;
                    map_id: number;
                };
                Insert: {
                    created_at?: string | null | undefined;
                    match_id: number;
                    map_id: number;
                };
                Update: {
                    created_at?: string | null | undefined;
                    match_id?: number | undefined;
                    map_id?: number | undefined;
                };
            };
            match_players: {
                Row: {
                    player_id: string;
                    match_id: number;
                    updated_at: string;
                    team: string | null;
                    captain: boolean;
                };
                Insert: {
                    player_id: string;
                    match_id: number;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
                Update: {
                    player_id?: string | undefined;
                    match_id?: number | undefined;
                    updated_at?: string | undefined;
                    team?: string | null | undefined;
                    captain?: boolean | undefined;
                };
            };
            matches: {
                Row: {
                    id: number;
                    created_at: string | null;
                    status: string;
                    size: number;
                    pick: string;
                    channel: number | null;
                    map_draft: string;
                    server: string | null;
                    started_at: string | null;
                    closed_at: string | null;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | null | undefined;
                    status?: string | undefined;
                    size?: number | undefined;
                    pick?: string | undefined;
                    channel?: number | null | undefined;
                    map_draft?: string | undefined;
                    server?: string | null | undefined;
                    started_at?: string | null | undefined;
                    closed_at?: string | null | undefined;
                };
            };
            players: {
                Row: {
                    id: string;
                    updated_at: string;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    updated_at?: string | undefined;
                    username: string;
                    full_name: string;
                    avatar_url: string;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
                Update: {
                    id?: string | undefined;
                    updated_at?: string | undefined;
                    username?: string | undefined;
                    full_name?: string | undefined;
                    avatar_url?: string | undefined;
                    user_id?: string | null | undefined;
                    created_at?: string | undefined;
                };
            };
            rounds: {
                Row: {
                    id: number;
                    created_at: string;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si: import("./database.types").Json;
                    pl: import("./database.types").Json;
                };
                Insert: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name: string;
                    team1_tickets: string;
                    team2_name: string;
                    team2_tickets: string;
                    server: string;
                    map: number;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
                Update: {
                    id?: number | undefined;
                    created_at?: string | undefined;
                    team1_name?: string | undefined;
                    team1_tickets?: string | undefined;
                    team2_name?: string | undefined;
                    team2_tickets?: string | undefined;
                    server?: string | undefined;
                    map?: number | undefined;
                    si?: import("./database.types").Json | undefined;
                    pl?: import("./database.types").Json | undefined;
                };
            };
            servers: {
                Row: {
                    ip: string;
                    name: string;
                    updated_at: string;
                };
                Insert: {
                    ip: string;
                    name: string;
                    updated_at?: string | undefined;
                };
                Update: {
                    ip?: string | undefined;
                    name?: string | undefined;
                    updated_at?: string | undefined;
                };
            };
        };
        Views: {};
        Functions: {};
        Enums: {};
    }, {
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }, {
        id: number;
        created_at: string | null;
        status: string;
        size: number;
        pick: string;
        channel: number | null;
        map_draft: string;
        server: string | null;
        started_at: string | null;
        closed_at: string | null;
    }>;
};
export default _default;
