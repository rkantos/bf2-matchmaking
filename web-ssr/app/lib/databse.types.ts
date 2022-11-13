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
          created_at: string | null
          match_id: number
          player_id: string
          team: string | null
        }
        Insert: {
          created_at?: string | null
          match_id: number
          player_id: string
          team?: string | null
        }
        Update: {
          created_at?: string | null
          match_id?: number
          player_id?: string
          team?: string | null
        }
      }
      matches: {
        Row: {
          id: number
          created_at: string | null
          status: string
          size: number
        }
        Insert: {
          id?: number
          created_at?: string | null
          status?: string
          size?: number
        }
        Update: {
          id?: number
          created_at?: string | null
          status?: string
          size?: number
        }
      }
      players: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          avatar_url: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
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
