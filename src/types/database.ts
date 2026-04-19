export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
      poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          position: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          voter_key: string
          voter_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          voter_key: string
          voter_name: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          voter_key?: string
          voter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          admin_token: string
          closed: boolean
          created_at: string
          description: string | null
          id: string
          slug: string
          title: string
        }
        Insert: {
          admin_token: string
          closed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          title: string
        }
        Update: {
          admin_token?: string
          closed?: boolean
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
        }
        Relationships: []
      }
      signup_claims: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          participant_email: string | null
          participant_name: string
          session_token: string
          signup_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          participant_email?: string | null
          participant_name: string
          session_token: string
          signup_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          participant_email?: string | null
          participant_name?: string
          session_token?: string
          signup_id?: string
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
      signup_items: {
        Row: {
          capacity: number
          date: string | null
          description: string | null
          id: string
          label: string
          signup_id: string
          sort_order: number
        }
        Insert: {
          capacity?: number
          date?: string | null
          description?: string | null
          id?: string
          label: string
          signup_id: string
          sort_order?: number
        }
        Update: {
          capacity?: number
          date?: string | null
          description?: string | null
          id?: string
          label?: string
          signup_id?: string
          sort_order?: number
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
      signups: {
        Row: {
          admin_token: string
          created_at: string | null
          description: string | null
          dietary_notes: string | null
          dropoff_location: string | null
          id: string
          name: string
          organizer_email: string | null
          recipient_name: string | null
          slug: string
          type: string
        }
        Insert: {
          admin_token: string
          created_at?: string | null
          description?: string | null
          dietary_notes?: string | null
          dropoff_location?: string | null
          id?: string
          name: string
          organizer_email?: string | null
          recipient_name?: string | null
          slug: string
          type?: string
        }
        Update: {
          admin_token?: string
          created_at?: string | null
          description?: string | null
          dietary_notes?: string | null
          dropoff_location?: string | null
          id?: string
          name?: string
          organizer_email?: string | null
          recipient_name?: string | null
          slug?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_signup_item: {
        Args: {
          p_item_id: string
          p_participant_email: string
          p_participant_name: string
          p_session_token: string
          p_signup_id: string
        }
        Returns: {
          created_at: string | null
          id: string
          item_id: string
          participant_email: string | null
          participant_name: string
          session_token: string
          signup_id: string
        }
        SetofOptions: {
          from: "*"
          to: "signup_claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      superadmin_event_counts: {
        Args: never
        Returns: {
          event_id: string
          participant_count: number
        }[]
      }
      superadmin_signup_counts: {
        Args: never
        Returns: {
          claim_count: number
          signup_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

export type Event = Database['public']['Tables']['events']['Row'];
export type Participant = Database['public']['Tables']['participants']['Row'];
export type Availability = Database['public']['Tables']['availability']['Row'];
export type Signup = Database['public']['Tables']['signups']['Row'];
export type SignupItem = Database['public']['Tables']['signup_items']['Row'];
export type SignupClaim = Database['public']['Tables']['signup_claims']['Row'];
export type Poll = Database['public']['Tables']['polls']['Row'];
export type PollOption = Database['public']['Tables']['poll_options']['Row'];
export type PollVote = Database['public']['Tables']['poll_votes']['Row'];
