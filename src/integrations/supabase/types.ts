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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      apartment_expenses: {
        Row: {
          amount: number
          amount_paid: number
          apartment_id: string
          created_at: string
          expense_id: string
          id: string
          is_canceled: boolean
        }
        Insert: {
          amount: number
          amount_paid?: number
          apartment_id: string
          created_at?: string
          expense_id: string
          id?: string
          is_canceled?: boolean
        }
        Update: {
          amount?: number
          amount_paid?: number
          apartment_id?: string
          created_at?: string
          expense_id?: string
          id?: string
          is_canceled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "apartment_expenses_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartment_expenses_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      apartments: {
        Row: {
          apartment_number: string
          beneficiary_id: string | null
          building_id: string
          created_at: string | null
          credit: number
          floor: string | null
          id: string
          occupancy_start: string | null
          owner_id: string | null
          status: string
          subscription_amount: number
          subscription_status: string
          updated_at: string | null
        }
        Insert: {
          apartment_number: string
          beneficiary_id?: string | null
          building_id: string
          created_at?: string | null
          credit?: number
          floor?: string | null
          id?: string
          occupancy_start?: string | null
          owner_id?: string | null
          status?: string
          subscription_amount?: number
          subscription_status?: string
          updated_at?: string | null
        }
        Update: {
          apartment_number?: string
          beneficiary_id?: string | null
          building_id?: string
          created_at?: string | null
          credit?: number
          floor?: string | null
          id?: string
          occupancy_start?: string | null
          owner_id?: string | null
          status?: string
          subscription_amount?: number
          subscription_status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          last_used_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          last_used_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          last_used_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_details: Json | null
          action_type: Database["public"]["Enums"]["audit_action_type"]
          created_at: string
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action_details?: Json | null
          action_type: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action_details?: Json | null
          action_type?: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      buildings: {
        Row: {
          address: string
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          number_of_floors: number | null
          underground_floors: number | null
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          number_of_floors?: number | null
          underground_floors?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          number_of_floors?: number | null
          underground_floors?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          failure_reason: string | null
          id: string
          language_used: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          subject_sent: string | null
          template_identifier: string
          user_id: string | null
          user_preferred_language: string | null
        }
        Insert: {
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          language_used?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          subject_sent?: string | null
          template_identifier: string
          user_id?: string | null
          user_preferred_language?: string | null
        }
        Update: {
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          language_used?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          subject_sent?: string | null
          template_identifier?: string
          user_id?: string | null
          user_preferred_language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_translations: {
        Row: {
          created_at: string | null
          html_body: string
          id: string
          language: string
          subject: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          html_body: string
          id?: string
          language: string
          subject: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          html_body?: string
          id?: string
          language?: string
          subject?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_template_translations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          identifier: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          identifier: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          identifier?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          building_id: string
          category: string | null
          created_at: string | null
          description: string
          expense_date: string
          id: string
          is_recurring: boolean
          parent_expense_id: string | null
          recurring_end_date: string | null
          recurring_start_date: string | null
          recurring_type: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          building_id: string
          category?: string | null
          created_at?: string | null
          description: string
          expense_date: string
          id?: string
          is_recurring?: boolean
          parent_expense_id?: string | null
          recurring_end_date?: string | null
          recurring_start_date?: string | null
          recurring_type?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          building_id?: string
          category?: string | null
          created_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          is_recurring?: boolean
          parent_expense_id?: string | null
          recurring_end_date?: string | null
          recurring_start_date?: string | null
          recurring_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_parent_expense_id_fkey"
            columns: ["parent_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      general_information: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          text_1: string | null
          text_2: string | null
          text_3: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          text_1?: string | null
          text_2?: string | null
          text_3?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          text_1?: string | null
          text_2?: string | null
          text_3?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      moderator_buildings: {
        Row: {
          building_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          building_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          building_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderator_buildings_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderator_buildings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_allocated: number
          apartment_expense_id: string
          created_at: string
          id: string
          payment_id: string
        }
        Insert: {
          amount_allocated: number
          apartment_expense_id: string
          created_at?: string
          id?: string
          payment_id: string
        }
        Update: {
          amount_allocated?: number
          apartment_expense_id?: string
          created_at?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_apartment_expense_id_fkey"
            columns: ["apartment_expense_id"]
            isOneToOne: false
            referencedRelation: "apartment_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          apartment_id: string
          created_at: string | null
          id: string
          is_canceled: boolean
          month: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          apartment_id: string
          created_at?: string | null
          id?: string
          is_canceled?: boolean
          month: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          apartment_id?: string
          created_at?: string | null
          id?: string
          is_canceled?: boolean
          month?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string | null
          preferred_language: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_branding: {
        Row: {
          company_name: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          turnstile_enabled: boolean
          turnstile_site_key: string | null
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          turnstile_enabled?: boolean
          turnstile_site_key?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          turnstile_enabled?: boolean
          turnstile_site_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          monthly_fee: number
          resend_api_key: string | null
          smtp_enabled: boolean
          smtp_from_email: string | null
          smtp_from_name: string | null
          system_language: string
          turnstile_enabled: boolean
          turnstile_site_key: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          monthly_fee?: number
          resend_api_key?: string | null
          smtp_enabled?: boolean
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          system_language?: string
          turnstile_enabled?: boolean
          turnstile_site_key?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          monthly_fee?: number
          resend_api_key?: string | null
          smtp_enabled?: boolean
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          system_language?: string
          turnstile_enabled?: boolean
          turnstile_site_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_apartments: {
        Row: {
          apartment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          apartment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          apartment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_apartments_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: true
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_audit_log: {
        Args: {
          p_action_details: Json
          p_action_type: Database["public"]["Enums"]["audit_action_type"]
          p_record_id: string
          p_table_name: string
          p_user_email: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_moderator_of_building: {
        Args: { _building_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator"
      audit_action_type:
        | "login"
        | "logout"
        | "signup"
        | "create"
        | "update"
        | "delete"
        | "role_change"
        | "password_change"
        | "api_key_created"
        | "api_key_deleted"
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
      app_role: ["admin", "user", "moderator"],
      audit_action_type: [
        "login",
        "logout",
        "signup",
        "create",
        "update",
        "delete",
        "role_change",
        "password_change",
        "api_key_created",
        "api_key_deleted",
      ],
    },
  },
} as const
