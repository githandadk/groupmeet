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
          timezone: string
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
          timezone?: string
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
          timezone?: string
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
      signups: {
        Row: {
          id: string
          slug: string
          admin_token: string
          name: string
          description: string | null
          type: 'timeslot' | 'potluck'
          organizer_email: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          slug: string
          admin_token: string
          name: string
          description?: string | null
          type?: 'timeslot' | 'potluck'
          organizer_email?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          slug?: string
          admin_token?: string
          name?: string
          description?: string | null
          type?: 'timeslot' | 'potluck'
          organizer_email?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      signup_items: {
        Row: {
          id: string
          signup_id: string
          label: string
          description: string | null
          capacity: number
          sort_order: number
          date: string | null
        }
        Insert: {
          id?: string
          signup_id: string
          label: string
          description?: string | null
          capacity?: number
          sort_order?: number
          date?: string | null
        }
        Update: {
          id?: string
          signup_id?: string
          label?: string
          description?: string | null
          capacity?: number
          sort_order?: number
          date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signup_items_signup_id_fkey"
            columns: ["signup_id"]
            isOneToOne: false
            referencedRelation: "signups"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_claims: {
        Row: {
          id: string
          item_id: string
          signup_id: string
          participant_name: string
          participant_email: string | null
          session_token: string
          created_at: string | null
        }
        Insert: {
          id?: string
          item_id: string
          signup_id: string
          participant_name: string
          participant_email?: string | null
          session_token: string
          created_at?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          signup_id?: string
          participant_name?: string
          participant_email?: string | null
          session_token?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signup_claims_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "signup_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_claims_signup_id_fkey"
            columns: ["signup_id"]
            isOneToOne: false
            referencedRelation: "signups"
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
export type Signup = Database['public']['Tables']['signups']['Row'];
export type SignupItem = Database['public']['Tables']['signup_items']['Row'];
export type SignupClaim = Database['public']['Tables']['signup_claims']['Row'];
