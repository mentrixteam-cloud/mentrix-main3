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
      ai_conversations: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          teacher_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          teacher_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          class_id: string | null
          color: string | null
          created_at: string
          description: string | null
          end_date: string | null
          event_type: string
          google_event_id: string | null
          id: string
          start_date: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          class_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          google_event_id?: string | null
          id?: string
          start_date: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          class_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          google_event_id?: string | null
          id?: string
          start_date?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          grade_level: string | null
          id: string
          name: string
          subject: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          grade_level?: string | null
          id?: string
          name: string
          subject?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          grade_level?: string | null
          id?: string
          name?: string
          subject?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          assignment: string
          class_id: string | null
          created_at: string
          feedback: string | null
          grade: number
          id: string
          lesson_id: string | null
          max_points: number | null
          percentage: number | null
          student_id: string
          subject: string | null
          teacher_id: string
        }
        Insert: {
          assignment: string
          class_id?: string | null
          created_at?: string
          feedback?: string | null
          grade: number
          id?: string
          lesson_id?: string | null
          max_points?: number | null
          percentage?: number | null
          student_id: string
          subject?: string | null
          teacher_id: string
        }
        Update: {
          assignment?: string
          class_id?: string | null
          created_at?: string
          feedback?: string | null
          grade?: number
          id?: string
          lesson_id?: string | null
          max_points?: number | null
          percentage?: number | null
          student_id?: string
          subject?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          class_id: string | null
          content: string | null
          created_at: string
          description: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          grade_level: string | null
          id: string
          objectives: string | null
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          grade_level?: string | null
          id?: string
          objectives?: string | null
          subject?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          grade_level?: string | null
          id?: string
          objectives?: string | null
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          grade_level: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          last_name: string | null
          school: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          grade_level?: string | null
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          school?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          grade_level?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          school?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_assignments: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          student_id: string | null
          submitted_at: string
          teacher_id: string
          title: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          student_id?: string | null
          submitted_at?: string
          teacher_id: string
          title: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          student_id?: string | null
          submitted_at?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_classes: {
        Row: {
          class_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          class_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          class_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_classes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          grade_level: string | null
          id: string
          is_active: boolean | null
          last_name: string
          notes: string | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          grade_level?: string | null
          id?: string
          is_active?: boolean | null
          last_name: string
          notes?: string | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          grade_level?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          notes?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_documents: {
        Row: {
          content: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          teacher_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          teacher_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      teacher_todos: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_archived: boolean | null
          is_completed: boolean | null
          priority: string | null
          related_class_id: string | null
          related_lesson_id: string | null
          related_student_id: string | null
          reminder_date: string | null
          task_type: string | null
          teacher_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean | null
          is_completed?: boolean | null
          priority?: string | null
          related_class_id?: string | null
          related_lesson_id?: string | null
          related_student_id?: string | null
          reminder_date?: string | null
          task_type?: string | null
          teacher_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean | null
          is_completed?: boolean | null
          priority?: string | null
          related_class_id?: string | null
          related_lesson_id?: string | null
          related_student_id?: string | null
          reminder_date?: string | null
          task_type?: string | null
          teacher_id?: string
          title?: string
        }
        Relationships: []
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
