export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          event_id: string | null
          id: string
          participant_id: string | null
          slot_end: string
          slot_start: string
        }
        Insert: {
          event_id?: string | null
          id?: string
          participant_id?: string | null
          slot_end: string
          slot_start: string
        }
        Update: {
          event_id?: string | null
          id?: string
          participant_id?: string | null
          slot_end?: string
          slot_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          admin_token: string
          created_at: string | null
          date_range_end: string
          date_range_start: string
          description: string | null
          granularity: string
          id: string
          name: string
          organizer_email: string | null
          selected_slot: Json | null
          slug: string
          time_end: number | null
          time_start: number | null
        }
        Insert: {
          admin_token: string
          created_at?: string | null
          date_range_end: string
          date_range_start: string
          description?: string | null
          granularity?: string
          id?: string
          name: string
          organizer_email?: string | null
          selected_slot?: Json | null
          slug: string
          time_end?: number | null
          time_start?: number | null
        }
        Update: {
          admin_token?: string
          created_at?: string | null
          date_range_end?: string
          date_range_start?: string
          description?: string | null
          granularity?: string
          id?: string
          name?: string
          organizer_email?: string | null
          selected_slot?: Json | null
          slug?: string
          time_end?: number | null
          time_start?: number | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          created_at: string | null
          email: string | null
          event_id: string | null
          id: string
          name: string
          session_token: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          name: string
          session_token: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          event_id?: string | null
          id?: string
          name?: string
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Event = Database['public']['Tables']['events']['Row'];
export type Participant = Database['public']['Tables']['participants']['Row'];
export type Availability = Database['public']['Tables']['availability']['Row'];
