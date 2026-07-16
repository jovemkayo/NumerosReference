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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      carriers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_number_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          employee_id: string
          id: string
          phone_number_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id: string
          id?: string
          phone_number_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id?: string
          id?: string
          phone_number_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_number_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_number_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_number_assignments_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_number_stats"
            referencedColumns: ["phone_number_id"]
          },
          {
            foreignKeyName: "phone_number_assignments_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_number_history: {
        Row: {
          changed_fields: Json | null
          event_type: Database["public"]["Enums"]["history_event"]
          from_employee_id: string | null
          from_status: Database["public"]["Enums"]["phone_status"] | null
          id: string
          performed_at: string
          performed_by: string | null
          phone_number_id: string
          reason: string | null
          to_employee_id: string | null
          to_status: Database["public"]["Enums"]["phone_status"] | null
        }
        Insert: {
          changed_fields?: Json | null
          event_type: Database["public"]["Enums"]["history_event"]
          from_employee_id?: string | null
          from_status?: Database["public"]["Enums"]["phone_status"] | null
          id?: string
          performed_at?: string
          performed_by?: string | null
          phone_number_id: string
          reason?: string | null
          to_employee_id?: string | null
          to_status?: Database["public"]["Enums"]["phone_status"] | null
        }
        Update: {
          changed_fields?: Json | null
          event_type?: Database["public"]["Enums"]["history_event"]
          from_employee_id?: string | null
          from_status?: Database["public"]["Enums"]["phone_status"] | null
          id?: string
          performed_at?: string
          performed_by?: string | null
          phone_number_id?: string
          reason?: string | null
          to_employee_id?: string | null
          to_status?: Database["public"]["Enums"]["phone_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_number_history_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_number_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_number_history_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_number_stats"
            referencedColumns: ["phone_number_id"]
          },
          {
            foreignKeyName: "phone_number_history_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_number_history_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          activated_at: string | null
          block_reason: string | null
          blocked_at: string | null
          carrier_id: string | null
          created_at: string
          created_by: string | null
          current_employee_id: string | null
          deactivated_at: string | null
          id: string
          observations: string | null
          phone_number: string
          previous_employee_id: string | null
          previous_number_id: string | null
          registered_at: string
          replacement_number_id: string | null
          status: Database["public"]["Enums"]["phone_status"]
          updated_at: string
          updated_by: string | null
          whatsapp_type: Database["public"]["Enums"]["whatsapp_type"]
        }
        Insert: {
          activated_at?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          carrier_id?: string | null
          created_at?: string
          created_by?: string | null
          current_employee_id?: string | null
          deactivated_at?: string | null
          id?: string
          observations?: string | null
          phone_number: string
          previous_employee_id?: string | null
          previous_number_id?: string | null
          registered_at?: string
          replacement_number_id?: string | null
          status?: Database["public"]["Enums"]["phone_status"]
          updated_at?: string
          updated_by?: string | null
          whatsapp_type?: Database["public"]["Enums"]["whatsapp_type"]
        }
        Update: {
          activated_at?: string | null
          block_reason?: string | null
          blocked_at?: string | null
          carrier_id?: string | null
          created_at?: string
          created_by?: string | null
          current_employee_id?: string | null
          deactivated_at?: string | null
          id?: string
          observations?: string | null
          phone_number?: string
          previous_employee_id?: string | null
          previous_number_id?: string | null
          registered_at?: string
          replacement_number_id?: string | null
          status?: Database["public"]["Enums"]["phone_status"]
          updated_at?: string
          updated_by?: string | null
          whatsapp_type?: Database["public"]["Enums"]["whatsapp_type"]
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_current_employee_id_fkey"
            columns: ["current_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_previous_employee_id_fkey"
            columns: ["previous_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_previous_number_id_fkey"
            columns: ["previous_number_id"]
            isOneToOne: false
            referencedRelation: "phone_number_stats"
            referencedColumns: ["phone_number_id"]
          },
          {
            foreignKeyName: "phone_numbers_previous_number_id_fkey"
            columns: ["previous_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_replacement_number_id_fkey"
            columns: ["replacement_number_id"]
            isOneToOne: false
            referencedRelation: "phone_number_stats"
            referencedColumns: ["phone_number_id"]
          },
          {
            foreignKeyName: "phone_numbers_replacement_number_id_fkey"
            columns: ["replacement_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_numbers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      phone_number_stats: {
        Row: {
          activation_count: number | null
          block_count: number | null
          deactivation_count: number | null
          last_event_at: string | null
          phone_number_id: string | null
          transfer_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      history_event:
        | "created"
        | "activated"
        | "blocked"
        | "unblocked"
        | "transferred"
        | "deactivated"
        | "reactivated"
        | "banned"
        | "edited"
        | "observation_added"
        | "whatsapp_changed"
        | "carrier_changed"
      phone_status:
        | "working"
        | "blocked"
        | "under_review"
        | "deactivated"
        | "permanently_banned"
      whatsapp_type: "business" | "normal" | "none"
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
    Enums: {
      app_role: ["admin", "user"],
      history_event: [
        "created",
        "activated",
        "blocked",
        "unblocked",
        "transferred",
        "deactivated",
        "reactivated",
        "banned",
        "edited",
        "observation_added",
        "whatsapp_changed",
        "carrier_changed",
      ],
      phone_status: [
        "working",
        "blocked",
        "under_review",
        "deactivated",
        "permanently_banned",
      ],
      whatsapp_type: ["business", "normal", "none"],
    },
  },
} as const
