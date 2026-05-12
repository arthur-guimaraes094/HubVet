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
      consultation_items: {
        Row: {
          applied_cost: number
          consultation_id: string
          created_at: string
          id: string
          inventory_id: string
          is_prescribed: boolean
          quantity: number
        }
        Insert: {
          applied_cost: number
          consultation_id: string
          created_at?: string
          id?: string
          inventory_id: string
          is_prescribed?: boolean
          quantity: number
        }
        Update: {
          applied_cost?: number
          consultation_id?: string
          created_at?: string
          id?: string
          inventory_id?: string
          is_prescribed?: boolean
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultation_items_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          address: string | null
          base_fee: number
          clinical_notes: string | null
          created_at: string
          date: string
          id: string
          images: string[] | null
          patient_id: string
          profile_id: string
          status: string
          type: string
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          base_fee?: number
          clinical_notes?: string | null
          created_at?: string
          date?: string
          id?: string
          images?: string[] | null
          patient_id: string
          profile_id: string
          status?: string
          type: string
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          base_fee?: number
          clinical_notes?: string | null
          created_at?: string
          date?: string
          id?: string
          images?: string[] | null
          patient_id?: string
          profile_id?: string
          status?: string
          type?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          concentration: string | null
          created_at: string
          id: string
          name: string
          profile_id: string
          quantity_in_stock: number
          sale_price: number
          type: string
          unit_cost: number
        }
        Insert: {
          concentration?: string | null
          created_at?: string
          id?: string
          name: string
          profile_id: string
          quantity_in_stock?: number
          sale_price?: number
          type: string
          unit_cost?: number
        }
        Update: {
          concentration?: string | null
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
          quantity_in_stock?: number
          sale_price?: number
          type?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          patient_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount: number
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          patient_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          patient_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          breed: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          species: string
          tutor_id: string
          weight_kg: number | null
        }
        Insert: {
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          species: string
          tutor_id: string
          weight_kg?: number | null
        }
        Update: {
          birth_date?: string | null
          breed?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          species?: string
          tutor_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          crmv: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          crmv?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          crmv?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          profile_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          consultation_id: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          profile_id: string
          type: string
        }
        Insert: {
          amount: number
          category: string
          consultation_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          profile_id: string
          type: string
        }
        Update: {
          amount?: number
          category?: string
          consultation_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          profile_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutors: {
        Row: {
          address: string | null
          cpf: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          profile_id: string
        }
        Insert: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          profile_id: string
        }
        Update: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_inventory: {
        Args: { amount: number; item_id: string }
        Returns: undefined
      }
    }
    Enums: {
      invoice_status: "pending" | "paid" | "cancelled"
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
      invoice_status: ["pending", "paid", "cancelled"],
    },
  },
} as const
