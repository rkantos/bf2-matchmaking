export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      discord_channels: {
        Row: {
          id: number
          created_at: string | null
          name: string
          uri: string
          channel_id: string
          server_id: string
        }
        Insert: {
          id?: number
          created_at?: string | null
          name: string
          uri: string
          channel_id: string
          server_id: string
        }
        Update: {
          id?: number
          created_at?: string | null
          name?: string
          uri?: string
          channel_id?: string
          server_id?: string
        }
      }
      maps: {
        Row: {
          id: number
          created_at: string | null
          name: string | null
        }
        Insert: {
          id?: number
          created_at?: string | null
          name?: string | null
        }
        Update: {
          id?: number
          created_at?: string | null
          name?: string | null
        }
      }
      match_maps: {
        Row: {
          created_at: string | null
          match_id: number
          map_id: number
        }
        Insert: {
          created_at?: string | null
          match_id: number
          map_id: number
        }
        Update: {
          created_at?: string | null
          match_id?: number
          map_id?: number
        }
      }
      match_players: {
        Row: {
          player_id: string
          match_id: number
          updated_at: string
          team: string | null
          captain: boolean
        }
        Insert: {
          player_id: string
          match_id: number
          updated_at?: string
          team?: string | null
          captain?: boolean
        }
        Update: {
          player_id?: string
          match_id?: number
          updated_at?: string
          team?: string | null
          captain?: boolean
        }
      }
      matches: {
        Row: {
          id: number
          created_at: string | null
          status: string
          size: number
          pick: string
          channel: number | null
          map_draft: string
          server: string | null
        }
        Insert: {
          id?: number
          created_at?: string | null
          status?: string
          size?: number
          pick?: string
          channel?: number | null
          map_draft?: string
          server?: string | null
        }
        Update: {
          id?: number
          created_at?: string | null
          status?: string
          size?: number
          pick?: string
          channel?: number | null
          map_draft?: string
          server?: string | null
        }
      }
      players: {
        Row: {
          id: string
          updated_at: string
          username: string
          full_name: string
          avatar_url: string
          user_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          updated_at?: string
          username: string
          full_name: string
          avatar_url: string
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          updated_at?: string
          username?: string
          full_name?: string
          avatar_url?: string
          user_id?: string | null
          created_at?: string
        }
      }
      rounds: {
        Row: {
          id: number
          created_at: string
          team1_name: string
          team1_tickets: string
          team2_name: string
          team2_tickets: string
          server: string
          map: number
          si: Json | null
          pl: Json | null
        }
        Insert: {
          id?: number
          created_at?: string
          team1_name: string
          team1_tickets: string
          team2_name: string
          team2_tickets: string
          server: string
          map: number
          si?: Json | null
          pl?: Json | null
        }
        Update: {
          id?: number
          created_at?: string
          team1_name?: string
          team1_tickets?: string
          team2_name?: string
          team2_tickets?: string
          server?: string
          map?: number
          si?: Json | null
          pl?: Json | null
        }
      }
      servers: {
        Row: {
          ip: string
          name: string
          updated_at: string
        }
        Insert: {
          ip: string
          name: string
          updated_at?: string
        }
        Update: {
          ip?: string
          name?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
