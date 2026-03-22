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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assessment_images: {
        Row: {
          caption: string | null
          created_at: string
          figure_number: number | null
          id: string
          image_type: string
          prompt: string | null
          section_id: string
          url: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          figure_number?: number | null
          id?: string
          image_type?: string
          prompt?: string | null
          section_id: string
          url?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          figure_number?: number | null
          id?: string
          image_type?: string
          prompt?: string | null
          section_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_images_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          brief_text: string | null
          created_at: string
          execution_plan: Json | null
          id: string
          settings: Json | null
          source_date_from: number | null
          source_date_to: number | null
          status: string
          title: string
          type: string | null
          updated_at: string
          use_seminal_sources: boolean | null
          user_id: string
          word_current: number
          word_target: number
        }
        Insert: {
          brief_text?: string | null
          created_at?: string
          execution_plan?: Json | null
          id?: string
          settings?: Json | null
          source_date_from?: number | null
          source_date_to?: number | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
          use_seminal_sources?: boolean | null
          user_id: string
          word_current?: number
          word_target?: number
        }
        Update: {
          brief_text?: string | null
          created_at?: string
          execution_plan?: Json | null
          id?: string
          settings?: Json | null
          source_date_from?: number | null
          source_date_to?: number | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
          use_seminal_sources?: boolean | null
          user_id?: string
          word_current?: number
          word_target?: number
        }
        Relationships: []
      }
      exports: {
        Row: {
          assessment_id: string
          created_at: string
          format: string
          id: string
          url: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string
          format?: string
          id?: string
          url?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string
          format?: string
          id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exports_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
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
          tier: string
          updated_at: string
          user_id: string
          word_limit: number
          words_used: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tier?: string
          updated_at?: string
          user_id: string
          word_limit?: number
          words_used?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          tier?: string
          updated_at?: string
          user_id?: string
          word_limit?: number
          words_used?: number
        }
        Relationships: []
      }
      sections: {
        Row: {
          a_plus_criteria: string | null
          assessment_id: string
          citation_count: number | null
          citations: Json | null
          constraints_text: string | null
          content: string | null
          created_at: string
          framework: string | null
          id: string
          learning_outcomes: string | null
          purpose_scope: string | null
          required_inputs: string | null
          sort_order: number
          status: string
          structure_formatting: string | null
          suggested_frameworks: Json | null
          title: string
          updated_at: string
          version: number
          word_current: number
          word_target: number
        }
        Insert: {
          a_plus_criteria?: string | null
          assessment_id: string
          citation_count?: number | null
          citations?: Json | null
          constraints_text?: string | null
          content?: string | null
          created_at?: string
          framework?: string | null
          id?: string
          learning_outcomes?: string | null
          purpose_scope?: string | null
          required_inputs?: string | null
          sort_order?: number
          status?: string
          structure_formatting?: string | null
          suggested_frameworks?: Json | null
          title: string
          updated_at?: string
          version?: number
          word_current?: number
          word_target?: number
        }
        Update: {
          a_plus_criteria?: string | null
          assessment_id?: string
          citation_count?: number | null
          citations?: Json | null
          constraints_text?: string | null
          content?: string | null
          created_at?: string
          framework?: string | null
          id?: string
          learning_outcomes?: string | null
          purpose_scope?: string | null
          required_inputs?: string | null
          sort_order?: number
          status?: string
          structure_formatting?: string | null
          suggested_frameworks?: Json | null
          title?: string
          updated_at?: string
          version?: number
          word_current?: number
          word_target?: number
        }
        Relationships: [
          {
            foreignKeyName: "sections_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
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
