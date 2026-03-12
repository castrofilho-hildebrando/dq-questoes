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
      admin_notebook_folders: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          parent_folder_id: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_folder_id?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_folder_id?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notebook_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "admin_notebook_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notebook_folders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notebook_questions: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_order: number | null
          id: string
          notebook_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          notebook_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          notebook_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notebook_questions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "admin_question_notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notebook_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notebook_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notebook_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_question_notebooks: {
        Row: {
          created_at: string
          description: string | null
          folder_id: string | null
          id: string
          is_active: boolean | null
          name: string
          question_count: number | null
          study_topic_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          question_count?: number | null
          study_topic_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          question_count?: number | null
          study_topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_question_notebooks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "admin_notebook_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_question_notebooks_study_topic_id_fkey"
            columns: ["study_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          config_type: string
          description: string | null
          id: string
          model: string
          system_prompt: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_type: string
          description?: string | null
          id: string
          model?: string
          system_prompt: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_type?: string
          description?: string | null
          id?: string
          model?: string
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      areas: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      auth_error_logs: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string | null
          error_code: string | null
          error_message: string
          error_type: string
          id: string
          ip_address: string | null
          resolved_at: string | null
          user_agent: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          error_code?: string | null
          error_message: string
          error_type?: string
          id?: string
          ip_address?: string | null
          resolved_at?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          error_code?: string | null
          error_message?: string
          error_type?: string
          id?: string
          ip_address?: string | null
          resolved_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      authorized_email_products: {
        Row: {
          access_end: string | null
          access_start: string
          created_at: string
          email: string
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          access_end?: string | null
          access_start?: string
          created_at?: string
          email: string
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          access_end?: string | null
          access_start?: string
          created_at?: string
          email?: string
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_email_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_emails: {
        Row: {
          authorized_at: string | null
          authorized_by: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      backup_cronograma_tasks_ghost_fix_20260124: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cronograma_id: string | null
          duration_minutes: number | null
          goal_id: string | null
          id: string | null
          is_completed: boolean | null
          is_revision: boolean | null
          notes: string | null
          part_number: number | null
          revision_number: number | null
          scheduled_date: string | null
          source_topic_id: string | null
          start_time: string | null
          total_parts: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date?: string | null
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date?: string | null
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_cronograma_tasks_legislacao_to_fundamentos_20260126: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cronograma_id: string | null
          duration_minutes: number | null
          goal_id: string | null
          id: string | null
          is_completed: boolean | null
          is_revision: boolean | null
          notes: string | null
          part_number: number | null
          revision_number: number | null
          scheduled_date: string | null
          source_topic_id: string | null
          start_time: string | null
          total_parts: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date?: string | null
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date?: string | null
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_duplicate_goals_20260125: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_minutes: number | null
          flashcard_links: string[] | null
          goal_type: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pdf_links: Json | null
          question_notebook_ids: string[] | null
          topic_id: string | null
          updated_at: string | null
          video_links: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Relationships: []
      }
      backup_duplicate_goals_20260218: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_minutes: number | null
          flashcard_links: string[] | null
          goal_type: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pdf_links: Json | null
          question_notebook_ids: string[] | null
          replaced_at: string | null
          replaced_by: string | null
          replacement_batch_id: string | null
          topic_id: string | null
          updated_at: string | null
          video_links: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Relationships: []
      }
      backup_duplicate_tasks_20260127: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cronograma_id: string | null
          duration_minutes: number | null
          goal_id: string | null
          id: string | null
          is_completed: boolean | null
          is_revision: boolean | null
          notes: string | null
          part_number: number | null
          revision_number: number | null
          scheduled_date: string | null
          source_topic_id: string | null
          start_time: string | null
          total_parts: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date?: string | null
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id?: string | null
          duration_minutes?: number | null
          goal_id?: string | null
          id?: string | null
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date?: string | null
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_orphan_questions_cleanup_20260124: {
        Row: {
          answered_at: string | null
          id: string | null
          is_correct: boolean | null
          question_code: string | null
          question_id: string | null
          selected_answer: string | null
          source_table: string | null
          user_id: string | null
        }
        Insert: {
          answered_at?: string | null
          id?: string | null
          is_correct?: boolean | null
          question_code?: string | null
          question_id?: string | null
          selected_answer?: string | null
          source_table?: string | null
          user_id?: string | null
        }
        Update: {
          answered_at?: string | null
          id?: string | null
          is_correct?: boolean | null
          question_code?: string | null
          question_id?: string | null
          selected_answer?: string | null
          source_table?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_phantom_notebooks_20260124: {
        Row: {
          created_at: string | null
          description: string | null
          folder_id: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          question_count: number | null
          study_topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          question_count?: number | null
          study_topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          folder_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          question_count?: number | null
          study_topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      backup_study_topics_ghost_fix_20260124: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          generation_type: string | null
          id: string | null
          is_active: boolean | null
          is_source: boolean | null
          name: string | null
          source_notebook_id: string | null
          source_topic_id: string | null
          study_discipline_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          generation_type?: string | null
          id?: string | null
          is_active?: boolean | null
          is_source?: boolean | null
          name?: string | null
          source_notebook_id?: string | null
          source_topic_id?: string | null
          study_discipline_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          generation_type?: string | null
          id?: string | null
          is_active?: boolean | null
          is_source?: boolean | null
          name?: string | null
          source_notebook_id?: string | null
          source_topic_id?: string | null
          study_discipline_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      backup_study_topics_source_fix_20260124: {
        Row: {
          generation_type: string | null
          id: string | null
          name: string | null
          source_topic_id: string | null
          study_discipline_id: string | null
        }
        Insert: {
          generation_type?: string | null
          id?: string | null
          name?: string | null
          source_topic_id?: string | null
          study_discipline_id?: string | null
        }
        Update: {
          generation_type?: string | null
          id?: string | null
          name?: string | null
          source_topic_id?: string | null
          study_discipline_id?: string | null
        }
        Relationships: []
      }
      backup_topic_goals_ghost_fix_20260124: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_minutes: number | null
          flashcard_links: string[] | null
          goal_type: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pdf_links: Json | null
          question_notebook_ids: string[] | null
          topic_id: string | null
          updated_at: string | null
          video_links: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Relationships: []
      }
      backup_topic_goals_standardization_20260126: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_minutes: number | null
          flashcard_links: string[] | null
          goal_type: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pdf_links: Json | null
          question_notebook_ids: string[] | null
          replaced_at: string | null
          replaced_by: string | null
          replacement_batch_id: string | null
          topic_id: string | null
          updated_at: string | null
          video_links: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
        }
        Relationships: []
      }
      bancas: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      community_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          link: string | null
          name: string
          qr_code_url: string | null
          section_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          name: string
          qr_code_url?: string | null
          section_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          name?: string
          qr_code_url?: string | null
          section_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_groups_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "community_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      community_sections: {
        Row: {
          created_at: string | null
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      conselho_mentor_slots: {
        Row: {
          booking_link: string
          created_at: string
          id: string
          notes: string | null
          scheduled_at: string | null
          slot_number: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_link?: string
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_at?: string | null
          slot_number: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_link?: string
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_at?: string | null
          slot_number?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conselho_sessions: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          pdf_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          pdf_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          pdf_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      conselho_student_groups: {
        Row: {
          created_at: string
          group_link: string
          group_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_link?: string
          group_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_link?: string
          group_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conselho_weekly_reports: {
        Row: {
          created_at: string
          id: string
          pdf_url: string
          title: string
          updated_at: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          pdf_url: string
          title?: string
          updated_at?: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          pdf_url?: string
          title?: string
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      cronograma_health_daily: {
        Row: {
          check_date: string
          checked_by: string | null
          created_at: string
          duplicate_tasks_count: number
          ghost_discipline_order_count: number
          id: string
          orphan_tasks_count: number
          phantom_goals_count: number
          top_issues: Json | null
          trigger_active: boolean
        }
        Insert: {
          check_date?: string
          checked_by?: string | null
          created_at?: string
          duplicate_tasks_count?: number
          ghost_discipline_order_count?: number
          id?: string
          orphan_tasks_count?: number
          phantom_goals_count?: number
          top_issues?: Json | null
          trigger_active?: boolean
        }
        Update: {
          check_date?: string
          checked_by?: string | null
          created_at?: string
          duplicate_tasks_count?: number
          ghost_discipline_order_count?: number
          id?: string
          orphan_tasks_count?: number
          phantom_goals_count?: number
          top_issues?: Json | null
          trigger_active?: boolean
        }
        Relationships: []
      }
      cronograma_health_events: {
        Row: {
          context: string | null
          created_at: string
          event_count: number
          event_date: string
          event_type: string
          id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          event_count?: number
          event_date?: string
          event_type: string
          id?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          event_count?: number
          event_date?: string
          event_type?: string
          id?: string
        }
        Relationships: []
      }
      didatica_modules: {
        Row: {
          created_at: string
          display_order: number
          duration_minutes: number | null
          id: string
          is_active: boolean
          module_type: string
          pdf_url: string | null
          section_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "didatica_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "didatica_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      didatica_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_position_seconds: number | null
          module_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "didatica_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "didatica_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      didatica_sections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      discipline_replacement_batches: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          discipline_id: string
          goals_created: number | null
          goals_deactivated: number | null
          id: string
          revisions_created: number | null
          revisions_deactivated: number | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          status: string | null
          topics_created: number | null
          topics_deactivated: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          discipline_id: string
          goals_created?: number | null
          goals_deactivated?: number | null
          id?: string
          revisions_created?: number | null
          revisions_deactivated?: number | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          status?: string | null
          topics_created?: number | null
          topics_deactivated?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          discipline_id?: string
          goals_created?: number | null
          goals_deactivated?: number | null
          id?: string
          revisions_created?: number | null
          revisions_deactivated?: number | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          status?: string | null
          topics_created?: number | null
          topics_deactivated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discipline_replacement_batches_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertativa_material_modules: {
        Row: {
          created_at: string
          display_order: number
          duration_minutes: number | null
          id: string
          is_active: boolean
          module_type: string
          pdf_url: string | null
          section_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dissertativa_material_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "dissertativa_material_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertativa_material_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_position_seconds: number | null
          module_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dissertativa_material_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "dissertativa_material_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertativa_material_sections: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dissertativa_material_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertative_course_disciplines: {
        Row: {
          course_id: string
          created_at: string
          discipline_id: string
          display_order: number
          id: string
          is_active: boolean
        }
        Insert: {
          course_id: string
          created_at?: string
          discipline_id: string
          display_order?: number
          id?: string
          is_active?: boolean
        }
        Update: {
          course_id?: string
          created_at?: string
          discipline_id?: string
          display_order?: number
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dissertative_course_disciplines_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissertative_course_disciplines_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertative_courses: {
        Row: {
          access_mode: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          access_mode?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          access_mode?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dissertative_exam_contexts: {
        Row: {
          context_json: Json
          course_id: string | null
          created_at: string
          exam_code: string
          exam_name: string
          id: string
          is_active: boolean
          updated_at: string
          version: number
        }
        Insert: {
          context_json: Json
          course_id?: string | null
          created_at?: string
          exam_code: string
          exam_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          context_json?: Json
          course_id?: string | null
          created_at?: string
          exam_code?: string
          exam_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dissertative_exam_contexts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertative_modules: {
        Row: {
          content_text: string | null
          course_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          module_type: string
          pdf_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content_text?: string | null
          course_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content_text?: string | null
          course_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dissertative_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertative_prompt_templates: {
        Row: {
          course_id: string | null
          created_at: string
          discipline_id: string | null
          id: string
          is_active: boolean
          model_settings: Json | null
          prompt_text: string
          prompt_type: string
          updated_at: string
          version: number
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          discipline_id?: string | null
          id?: string
          is_active?: boolean
          model_settings?: Json | null
          prompt_text: string
          prompt_type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          course_id?: string | null
          created_at?: string
          discipline_id?: string | null
          id?: string
          is_active?: boolean
          model_settings?: Json | null
          prompt_text?: string
          prompt_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dissertative_prompt_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissertative_prompt_templates_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertative_questions: {
        Row: {
          answer_key: string
          course_id: string
          created_at: string
          discipline_id: string
          display_order: number
          id: string
          is_active: boolean
          model_answer: string | null
          statement: string
          status: string
          topic_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          answer_key: string
          course_id: string
          created_at?: string
          discipline_id: string
          display_order?: number
          id?: string
          is_active?: boolean
          model_answer?: string | null
          statement: string
          status?: string
          topic_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          answer_key?: string
          course_id?: string
          created_at?: string
          discipline_id?: string
          display_order?: number
          id?: string
          is_active?: boolean
          model_answer?: string | null
          statement?: string
          status?: string
          topic_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dissertative_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissertative_questions_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissertative_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "dissertative_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertative_submissions: {
        Row: {
          ai_feedback: Json | null
          course_id: string
          created_at: string
          discipline_id: string
          id: string
          question_id: string
          score: number | null
          student_answer: string
          user_id: string
        }
        Insert: {
          ai_feedback?: Json | null
          course_id: string
          created_at?: string
          discipline_id: string
          id?: string
          question_id: string
          score?: number | null
          student_answer: string
          user_id: string
        }
        Update: {
          ai_feedback?: Json | null
          course_id?: string
          created_at?: string
          discipline_id?: string
          id?: string
          question_id?: string
          score?: number | null
          student_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dissertative_submissions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissertative_submissions_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissertative_submissions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "dissertative_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      dissertative_topics: {
        Row: {
          course_id: string
          created_at: string
          discipline_id: string
          display_order: number
          id: string
          is_active: boolean
          source_pdf_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          discipline_id: string
          display_order?: number
          id?: string
          is_active?: boolean
          source_pdf_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          discipline_id?: string
          display_order?: number
          id?: string
          is_active?: boolean
          source_pdf_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dissertative_topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "dissertative_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dissertative_topics_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_disciplines: {
        Row: {
          created_at: string | null
          discipline_id: string
          display_order: number | null
          edital_id: string
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
        }
        Insert: {
          created_at?: string | null
          discipline_id: string
          display_order?: number | null
          edital_id: string
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
        }
        Update: {
          created_at?: string | null
          discipline_id?: string
          display_order?: number | null
          edital_id?: string
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "edital_disciplines_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_disciplines_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editals"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_topic_bank_mappings: {
        Row: {
          confidence_score: number | null
          created_at: string
          edital_topic_id: string
          id: string
          is_ai_suggested: boolean | null
          is_confirmed: boolean | null
          study_topic_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          edital_topic_id: string
          id?: string
          is_ai_suggested?: boolean | null
          is_confirmed?: boolean | null
          study_topic_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          edital_topic_id?: string
          id?: string
          is_ai_suggested?: boolean | null
          is_confirmed?: boolean | null
          study_topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_topic_bank_mappings_edital_topic_id_fkey"
            columns: ["edital_topic_id"]
            isOneToOne: false
            referencedRelation: "edital_topic_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_topic_bank_mappings_study_topic_id_fkey"
            columns: ["study_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_topic_mappings: {
        Row: {
          created_at: string
          display_order: number | null
          edital_id: string | null
          edital_topic_name: string
          id: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          edital_id?: string | null
          edital_topic_name: string
          id?: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          edital_id?: string | null
          edital_topic_name?: string
          id?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_topic_mappings_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_topic_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      editals: {
        Row: {
          area_id: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "editals_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          available_variables: string | null
          body_html: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          product_id: string | null
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          available_variables?: string | null
          body_html: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          available_variables?: string | null
          body_html?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          product_id?: string | null
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          admin_only: boolean | null
          allowed_cronograma_ids: string[] | null
          description: string | null
          enabled: boolean
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_only?: boolean | null
          allowed_cronograma_ids?: string[] | null
          description?: string | null
          enabled?: boolean
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_only?: boolean | null
          allowed_cronograma_ids?: string[] | null
          description?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      gateway_card_user_access: {
        Row: {
          access_end: string | null
          access_start: string | null
          card_id: string
          created_at: string
          granted_by: string | null
          has_access: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_end?: string | null
          access_start?: string | null
          card_id: string
          created_at?: string
          granted_by?: string | null
          has_access?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_end?: string | null
          access_start?: string | null
          card_id?: string
          created_at?: string
          granted_by?: string | null
          has_access?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_card_user_access_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "gateway_cards_config"
            referencedColumns: ["card_id"]
          },
        ]
      }
      gateway_cards_config: {
        Row: {
          card_id: string
          created_at: string
          display_order: number
          is_active: boolean
          is_unlocked_default: boolean
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          display_order?: number
          is_active?: boolean
          is_unlocked_default?: boolean
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          display_order?: number
          is_active?: boolean
          is_unlocked_default?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      gravacao_modules: {
        Row: {
          created_at: string
          display_order: number
          duration_minutes: number | null
          id: string
          is_active: boolean
          module_type: string
          pdf_url: string | null
          section_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gravacao_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "gravacao_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      gravacao_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_position_seconds: number | null
          module_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gravacao_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "gravacao_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      gravacao_sections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          admin_user_id: string | null
          chunks_received: number | null
          chunks_total: number | null
          completed_at: string | null
          created_at: string
          discipline_id: string
          error_message: string | null
          id: string
          stats: Json | null
          status: string
          updated_at: string | null
          zip_filename: string | null
        }
        Insert: {
          admin_user_id?: string | null
          chunks_received?: number | null
          chunks_total?: number | null
          completed_at?: string | null
          created_at?: string
          discipline_id: string
          error_message?: string | null
          id?: string
          stats?: Json | null
          status?: string
          updated_at?: string | null
          zip_filename?: string | null
        }
        Update: {
          admin_user_id?: string | null
          chunks_received?: number | null
          chunks_total?: number | null
          completed_at?: string | null
          created_at?: string
          discipline_id?: string
          error_message?: string | null
          id?: string
          stats?: Json | null
          status?: string
          updated_at?: string | null
          zip_filename?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      live_meeting_recordings: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          meeting_date: string | null
          pdf_url: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          meeting_date?: string | null
          pdf_url?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          meeting_date?: string | null
          pdf_url?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      mentor_cronograma_changes: {
        Row: {
          change_description: string | null
          change_type: string
          created_at: string | null
          cronograma_id: string
          id: string
          mentor_id: string
          new_state: Json | null
          previous_state: Json | null
        }
        Insert: {
          change_description?: string | null
          change_type: string
          created_at?: string | null
          cronograma_id: string
          id?: string
          mentor_id: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Update: {
          change_description?: string | null
          change_type?: string
          created_at?: string | null
          cronograma_id?: string
          id?: string
          mentor_id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_cronograma_changes_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "user_cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_questions: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          notebook_id: string
          question_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          notebook_id: string
          question_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          notebook_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_questions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "study_notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_webhooks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      orgaos: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_material_folders: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          parent_folder_id: string | null
          section_id: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_folder_id?: string | null
          section_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_folder_id?: string | null
          section_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_material_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "pdf_material_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_material_folders_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "pdf_material_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_material_sections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_material_topic_links: {
        Row: {
          auto_created_goal_id: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          pdf_material_id: string
          school_id: string | null
          study_topic_id: string
          updated_at: string | null
        }
        Insert: {
          auto_created_goal_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          pdf_material_id: string
          school_id?: string | null
          study_topic_id: string
          updated_at?: string | null
        }
        Update: {
          auto_created_goal_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          pdf_material_id?: string
          school_id?: string | null
          study_topic_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_material_topic_links_auto_created_goal_id_fkey"
            columns: ["auto_created_goal_id"]
            isOneToOne: false
            referencedRelation: "topic_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_material_topic_links_pdf_material_id_fkey"
            columns: ["pdf_material_id"]
            isOneToOne: false
            referencedRelation: "pdf_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_material_topic_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdf_material_topic_links_study_topic_id_fkey"
            columns: ["study_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_material_versions: {
        Row: {
          change_notes: string | null
          created_at: string | null
          created_by: string | null
          file_url: string
          id: string
          pdf_material_id: string
          total_pages: number | null
          version_number: number
        }
        Insert: {
          change_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url: string
          id?: string
          pdf_material_id: string
          total_pages?: number | null
          version_number: number
        }
        Update: {
          change_notes?: string | null
          created_at?: string | null
          created_by?: string | null
          file_url?: string
          id?: string
          pdf_material_id?: string
          total_pages?: number | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdf_material_versions_pdf_material_id_fkey"
            columns: ["pdf_material_id"]
            isOneToOne: false
            referencedRelation: "pdf_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_materials: {
        Row: {
          created_at: string | null
          current_file_url: string
          current_version: number | null
          description: string | null
          display_order: number
          folder_id: string | null
          id: string
          is_active: boolean | null
          name: string
          total_pages: number | null
          total_study_minutes: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_file_url: string
          current_version?: number | null
          description?: string | null
          display_order?: number
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          total_pages?: number | null
          total_study_minutes?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_file_url?: string
          current_version?: number | null
          description?: string | null
          display_order?: number
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          total_pages?: number | null
          total_study_minutes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdf_materials_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "pdf_material_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          description: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_definitions: {
        Row: {
          card_ids: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          card_ids?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          card_ids?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_offer_tokens: {
        Row: {
          created_at: string
          duration_days: number | null
          id: string
          is_active: boolean
          notes: string | null
          offer_token: string
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          offer_token: string
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          offer_token?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_offer_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cpf: string | null
          created_at: string
          download_unlocked: boolean
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          last_access_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          download_unlocked?: boolean
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_access_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          download_unlocked?: boolean
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_access_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provas: {
        Row: {
          banca_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          orgao_id: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          banca_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          orgao_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          banca_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          orgao_id?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "provas_banca_id_fkey"
            columns: ["banca_id"]
            isOneToOne: false
            referencedRelation: "bancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provas_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos"
            referencedColumns: ["id"]
          },
        ]
      }
      provas_if: {
        Row: {
          ano: string | null
          area_id: string | null
          banca: string | null
          created_at: string | null
          group_id: string | null
          id: string
          instituicao: string | null
          is_active: boolean | null
          nivel: string | null
          nome_prova: string
          orgao: string | null
          pdf_type: string | null
          updated_at: string | null
          url_origem: string | null
          url_pdf: string
        }
        Insert: {
          ano?: string | null
          area_id?: string | null
          banca?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          instituicao?: string | null
          is_active?: boolean | null
          nivel?: string | null
          nome_prova: string
          orgao?: string | null
          pdf_type?: string | null
          updated_at?: string | null
          url_origem?: string | null
          url_pdf: string
        }
        Update: {
          ano?: string | null
          area_id?: string | null
          banca?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          instituicao?: string | null
          is_active?: boolean | null
          nivel?: string | null
          nome_prova?: string
          orgao?: string | null
          pdf_type?: string | null
          updated_at?: string | null
          url_origem?: string | null
          url_pdf?: string
        }
        Relationships: [
          {
            foreignKeyName: "provas_if_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      question_comment_reports: {
        Row: {
          admin_notes: string | null
          comment_id: string
          created_at: string
          id: string
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          comment_id: string
          created_at?: string
          id?: string
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "question_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_comment_votes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
          vote_type: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comment_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "question_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      question_comments: {
        Row: {
          content: string
          created_at: string
          downvotes: number | null
          id: string
          is_active: boolean | null
          question_id: string
          updated_at: string
          upvotes: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          downvotes?: number | null
          id?: string
          is_active?: boolean | null
          question_id: string
          updated_at?: string
          upvotes?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          downvotes?: number | null
          id?: string
          is_active?: boolean | null
          question_id?: string
          updated_at?: string
          upvotes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_comments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_comments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_comments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
        ]
      }
      question_disciplines: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          question_id: string
          study_discipline_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          question_id: string
          study_discipline_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          question_id?: string
          study_discipline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_disciplines_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_disciplines_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_disciplines_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_disciplines_study_discipline_id_fkey"
            columns: ["study_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      question_duplicates: {
        Row: {
          created_at: string
          duplicate_hash: string
          id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          duplicate_hash: string
          id?: string
          question_id: string
        }
        Update: {
          created_at?: string
          duplicate_hash?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_duplicates_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_duplicates_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_duplicates_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
        ]
      }
      question_error_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string
          error_type: string
          id: string
          question_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details: string
          error_type: string
          id?: string
          question_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string
          error_type?: string
          id?: string
          question_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_error_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_error_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_error_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
        ]
      }
      question_merge_history: {
        Row: {
          details: Json | null
          id: string
          kept_question_id: string
          merged_at: string
          merged_by: string | null
          questions_count: number
          removed_question_ids: string[]
        }
        Insert: {
          details?: Json | null
          id?: string
          kept_question_id: string
          merged_at?: string
          merged_by?: string | null
          questions_count: number
          removed_question_ids: string[]
        }
        Update: {
          details?: Json | null
          id?: string
          kept_question_id?: string
          merged_at?: string
          merged_by?: string | null
          questions_count?: number
          removed_question_ids?: string[]
        }
        Relationships: []
      }
      question_notes: {
        Row: {
          content: string
          created_at: string
          discipline_id: string | null
          discipline_name: string | null
          id: string
          question_id: string
          topic_id: string | null
          topic_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          discipline_id?: string | null
          discipline_name?: string | null
          id?: string
          question_id: string
          topic_id?: string | null
          topic_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          discipline_id?: string | null
          discipline_name?: string | null
          id?: string
          question_id?: string
          topic_id?: string | null
          topic_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_notes_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_notes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      question_topics: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          question_id: string
          study_topic_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          question_id: string
          study_topic_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          question_id?: string
          study_topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_topics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_topics_study_topic_id_fkey"
            columns: ["study_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer: string
          associated_text: string | null
          banca_id: string | null
          clean_text_len: number | null
          code: string
          created_at: string | null
          deactivated_at: string | null
          deactivated_by_error: boolean | null
          deactivated_by_report_id: string | null
          difficulty: string | null
          duplicate_of_question_id: string | null
          external_code: string | null
          hash_quality: string | null
          hash_version: string | null
          id: string
          images: Json | null
          import_batch_id: string | null
          is_active: boolean | null
          is_duplicate: boolean | null
          is_source_discipline: boolean
          keys: string | null
          match_hash: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          option_e: string | null
          orgao_id: string | null
          position_id: string | null
          prof_comment: string | null
          prof_comment_citations: string[] | null
          prof_comment_json: Json | null
          prof_comment_structured: Json | null
          prof_comment_videos: string[] | null
          prova_id: string | null
          question: string
          question_hash: string | null
          question_plain_text: string | null
          question_type: string | null
          related_contents: string | null
          source_references: Json | null
          study_discipline_id: string | null
          study_topic_id: string | null
          subject_id: string | null
          subtopic_id: string | null
          topic_id: string | null
          updated_at: string | null
          video_links: Json | null
          year: number | null
        }
        Insert: {
          answer: string
          associated_text?: string | null
          banca_id?: string | null
          clean_text_len?: number | null
          code?: string
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by_error?: boolean | null
          deactivated_by_report_id?: string | null
          difficulty?: string | null
          duplicate_of_question_id?: string | null
          external_code?: string | null
          hash_quality?: string | null
          hash_version?: string | null
          id?: string
          images?: Json | null
          import_batch_id?: string | null
          is_active?: boolean | null
          is_duplicate?: boolean | null
          is_source_discipline?: boolean
          keys?: string | null
          match_hash?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          orgao_id?: string | null
          position_id?: string | null
          prof_comment?: string | null
          prof_comment_citations?: string[] | null
          prof_comment_json?: Json | null
          prof_comment_structured?: Json | null
          prof_comment_videos?: string[] | null
          prova_id?: string | null
          question: string
          question_hash?: string | null
          question_plain_text?: string | null
          question_type?: string | null
          related_contents?: string | null
          source_references?: Json | null
          study_discipline_id?: string | null
          study_topic_id?: string | null
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
          year?: number | null
        }
        Update: {
          answer?: string
          associated_text?: string | null
          banca_id?: string | null
          clean_text_len?: number | null
          code?: string
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by_error?: boolean | null
          deactivated_by_report_id?: string | null
          difficulty?: string | null
          duplicate_of_question_id?: string | null
          external_code?: string | null
          hash_quality?: string | null
          hash_version?: string | null
          id?: string
          images?: Json | null
          import_batch_id?: string | null
          is_active?: boolean | null
          is_duplicate?: boolean | null
          is_source_discipline?: boolean
          keys?: string | null
          match_hash?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          orgao_id?: string | null
          position_id?: string | null
          prof_comment?: string | null
          prof_comment_citations?: string[] | null
          prof_comment_json?: Json | null
          prof_comment_structured?: Json | null
          prof_comment_videos?: string[] | null
          prova_id?: string | null
          question?: string
          question_hash?: string | null
          question_plain_text?: string | null
          question_type?: string | null
          related_contents?: string | null
          source_references?: Json | null
          study_discipline_id?: string | null
          study_topic_id?: string | null
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          video_links?: Json | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_banca_id_fkey"
            columns: ["banca_id"]
            isOneToOne: false
            referencedRelation: "bancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_deactivated_by_report_id_fkey"
            columns: ["deactivated_by_report_id"]
            isOneToOne: false
            referencedRelation: "question_error_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_duplicate_of_question_id_fkey"
            columns: ["duplicate_of_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_duplicate_of_question_id_fkey"
            columns: ["duplicate_of_question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_duplicate_of_question_id_fkey"
            columns: ["duplicate_of_question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_study_discipline_id_fkey"
            columns: ["study_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_study_topic_id_fkey"
            columns: ["study_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_areas: {
        Row: {
          area_id: string
          created_at: string | null
          id: string
          robot_id: string
        }
        Insert: {
          area_id: string
          created_at?: string | null
          id?: string
          robot_id: string
        }
        Update: {
          area_id?: string
          created_at?: string | null
          id?: string
          robot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "robot_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "robot_areas_robot_id_fkey"
            columns: ["robot_id"]
            isOneToOne: false
            referencedRelation: "robots"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_conversations: {
        Row: {
          created_at: string | null
          id: string
          robot_id: string
          thread_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          robot_id: string
          thread_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          robot_id?: string
          thread_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "robot_conversations_robot_id_fkey"
            columns: ["robot_id"]
            isOneToOne: false
            referencedRelation: "robots"
            referencedColumns: ["id"]
          },
        ]
      }
      robot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "robot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "robot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      robots: {
        Row: {
          assistant_id: string | null
          command_prompt: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          model: string | null
          name: string
          prompt: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          assistant_id?: string | null
          command_prompt?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          model?: string | null
          name: string
          prompt?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          assistant_id?: string | null
          command_prompt?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          model?: string | null
          name?: string
          prompt?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      school_discipline_pending_config: {
        Row: {
          created_at: string | null
          created_by: string | null
          discipline_id: string
          id: string
          pending_type: string
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          discipline_id: string
          id?: string
          pending_type: string
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          discipline_id?: string
          id?: string
          pending_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_discipline_pending_config_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_discipline_pending_config_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_disciplines: {
        Row: {
          created_at: string
          discipline_id: string
          display_order: number | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          school_id: string
        }
        Insert: {
          created_at?: string
          discipline_id: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          school_id: string
        }
        Update: {
          created_at?: string
          discipline_id?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_disciplines_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          area_id: string | null
          created_at: string
          description: string | null
          display_order: number | null
          edital_id: string | null
          has_banco_questoes: boolean | null
          has_flashcards: boolean | null
          has_materials: boolean | null
          has_robo_tutor: boolean | null
          has_videos: boolean | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          primary_discipline_id: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          edital_id?: string | null
          has_banco_questoes?: boolean | null
          has_flashcards?: boolean | null
          has_materials?: boolean | null
          has_robo_tutor?: boolean | null
          has_videos?: boolean | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          primary_discipline_id?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          edital_id?: string | null
          has_banco_questoes?: boolean | null
          has_flashcards?: boolean | null
          has_materials?: boolean | null
          has_robo_tutor?: boolean | null
          has_videos?: boolean | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          primary_discipline_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_primary_discipline_id_fkey"
            columns: ["primary_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      study_disciplines: {
        Row: {
          area_id: string | null
          created_at: string
          description: string | null
          display_order: number | null
          generation_type: string | null
          id: string
          is_active: boolean | null
          is_auto_generated: boolean | null
          is_source: boolean | null
          name: string
          questions_per_hour: number | null
          source_discipline_id: string | null
          source_notebook_folder_id: string | null
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          generation_type?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean | null
          is_source?: boolean | null
          name: string
          questions_per_hour?: number | null
          source_discipline_id?: string | null
          source_notebook_folder_id?: string | null
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          generation_type?: string | null
          id?: string
          is_active?: boolean | null
          is_auto_generated?: boolean | null
          is_source?: boolean | null
          name?: string
          questions_per_hour?: number | null
          source_discipline_id?: string | null
          source_notebook_folder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplines_source_notebook_folder_id_fkey"
            columns: ["source_notebook_folder_id"]
            isOneToOne: false
            referencedRelation: "admin_notebook_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_disciplines_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_disciplines_source_discipline_id_fkey"
            columns: ["source_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      study_notebooks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      study_topics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          generation_type: string | null
          id: string
          is_active: boolean | null
          is_source: boolean | null
          name: string
          replaced_at: string | null
          replaced_by: string | null
          replacement_batch_id: string | null
          source_notebook_id: string | null
          source_topic_id: string | null
          study_discipline_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          generation_type?: string | null
          id?: string
          is_active?: boolean | null
          is_source?: boolean | null
          name: string
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          source_notebook_id?: string | null
          source_topic_id?: string | null
          study_discipline_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          generation_type?: string | null
          id?: string
          is_active?: boolean | null
          is_source?: boolean | null
          name?: string
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          source_notebook_id?: string | null
          source_topic_id?: string | null
          study_discipline_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_topics_source_notebook_id_fkey"
            columns: ["source_notebook_id"]
            isOneToOne: false
            referencedRelation: "admin_question_notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_topics_discipline_id_fkey"
            columns: ["study_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_topics_replacement_batch_id_fkey"
            columns: ["replacement_batch_id"]
            isOneToOne: false
            referencedRelation: "discipline_replacement_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_topics_source_topic_id_fkey"
            columns: ["source_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subtopics: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      token_usage: {
        Row: {
          created_at: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          robot_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          robot_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          robot_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_robot_id_fkey"
            columns: ["robot_id"]
            isOneToOne: false
            referencedRelation: "robots"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_goals: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          duration_minutes: number | null
          flashcard_links: string[] | null
          goal_type: string | null
          id: string
          is_active: boolean | null
          name: string
          pdf_links: Json | null
          question_notebook_ids: string[] | null
          replaced_at: string | null
          replaced_by: string | null
          replacement_batch_id: string | null
          topic_id: string
          updated_at: string | null
          video_links: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          topic_id: string
          updated_at?: string | null
          video_links?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number | null
          flashcard_links?: string[] | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          pdf_links?: Json | null
          question_notebook_ids?: string[] | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          topic_id?: string
          updated_at?: string | null
          video_links?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_goals_replacement_batch_id_fkey"
            columns: ["replacement_batch_id"]
            isOneToOne: false
            referencedRelation: "discipline_replacement_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_goals_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_revisions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          replaced_at: string | null
          replaced_by: string | null
          replacement_batch_id: string | null
          revision_1_days: number | null
          revision_2_days: number | null
          revision_3_days: number | null
          revision_4_days: number | null
          revision_5_days: number | null
          revision_6_days: number | null
          topic_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          revision_1_days?: number | null
          revision_2_days?: number | null
          revision_3_days?: number | null
          revision_4_days?: number | null
          revision_5_days?: number | null
          revision_6_days?: number | null
          topic_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          replaced_at?: string | null
          replaced_by?: string | null
          replacement_batch_id?: string | null
          revision_1_days?: number | null
          revision_2_days?: number | null
          revision_3_days?: number | null
          revision_4_days?: number | null
          revision_5_days?: number | null
          revision_6_days?: number | null
          topic_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_revisions_replacement_batch_id_fkey"
            columns: ["replacement_batch_id"]
            isOneToOne: false
            referencedRelation: "discipline_replacement_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_revisions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          subject_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_registrations: {
        Row: {
          converted_to_user: boolean | null
          created_at: string
          email: string
          expires_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string
        }
        Insert: {
          converted_to_user?: boolean | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone: string
        }
        Update: {
          converted_to_user?: boolean | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string
        }
        Relationships: []
      }
      tutorial_modules: {
        Row: {
          created_at: string
          display_order: number
          duration_minutes: number | null
          id: string
          is_active: boolean
          module_type: string
          pdf_url: string | null
          section_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_type?: string
          pdf_url?: string | null
          section_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_modules_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tutorial_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_position_seconds: number | null
          module_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_position_seconds?: number | null
          module_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "tutorial_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_sections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          product_id: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          product_id?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          product_id?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_sections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_video_folders: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          module: string
          name: string
          parent_folder_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          module?: string
          name: string
          parent_folder_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          module?: string
          name?: string
          parent_folder_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_video_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "tutorial_video_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_videos: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          folder_id: string | null
          id: string
          is_active: boolean | null
          module: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          youtube_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          module?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          youtube_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          folder_id?: string | null
          id?: string
          is_active?: boolean | null
          module?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          youtube_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_videos_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "tutorial_video_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_answers: {
        Row: {
          answered_at: string | null
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          user_id: string
        }
        Insert: {
          answered_at?: string | null
          id?: string
          is_correct: boolean
          question_id: string
          selected_answer: string
          user_id: string
        }
        Update: {
          answered_at?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_edital_admin"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_for_students"
            referencedColumns: ["id"]
          },
        ]
      }
      user_areas: {
        Row: {
          area_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cronograma_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          cronograma_id: string
          duration_minutes: number
          goal_id: string | null
          id: string
          is_completed: boolean | null
          is_revision: boolean | null
          notes: string | null
          part_number: number | null
          revision_number: number | null
          scheduled_date: string
          source_topic_id: string | null
          start_time: string | null
          total_parts: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id: string
          duration_minutes: number
          goal_id?: string | null
          id?: string
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date: string
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          cronograma_id?: string
          duration_minutes?: number
          goal_id?: string | null
          id?: string
          is_completed?: boolean | null
          is_revision?: boolean | null
          notes?: string | null
          part_number?: number | null
          revision_number?: number | null
          scheduled_date?: string
          source_topic_id?: string | null
          start_time?: string | null
          total_parts?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cronograma_tasks_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "user_cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cronograma_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "topic_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cronograma_tasks_source_topic_id_fkey"
            columns: ["source_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cronogramas: {
        Row: {
          admin_changes_description: string | null
          available_days: string[] | null
          created_at: string | null
          cronograma_type: string
          discipline_order: string[] | null
          end_date: string | null
          hours_per_day: number | null
          hours_per_weekday: Json | null
          id: string
          is_active: boolean | null
          is_frozen: boolean
          name: string
          needs_recalc: boolean | null
          pending_admin_changes: boolean | null
          recalc_pending_since: string | null
          recalc_reason: string | null
          revision_source_id: string | null
          school_id: string
          selected_disciplines: string[] | null
          selected_topics: Json | null
          start_date: string
          topic_order: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_changes_description?: string | null
          available_days?: string[] | null
          created_at?: string | null
          cronograma_type?: string
          discipline_order?: string[] | null
          end_date?: string | null
          hours_per_day?: number | null
          hours_per_weekday?: Json | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean
          name: string
          needs_recalc?: boolean | null
          pending_admin_changes?: boolean | null
          recalc_pending_since?: string | null
          recalc_reason?: string | null
          revision_source_id?: string | null
          school_id: string
          selected_disciplines?: string[] | null
          selected_topics?: Json | null
          start_date: string
          topic_order?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_changes_description?: string | null
          available_days?: string[] | null
          created_at?: string | null
          cronograma_type?: string
          discipline_order?: string[] | null
          end_date?: string | null
          hours_per_day?: number | null
          hours_per_weekday?: Json | null
          id?: string
          is_active?: boolean | null
          is_frozen?: boolean
          name?: string
          needs_recalc?: boolean | null
          pending_admin_changes?: boolean | null
          recalc_pending_since?: string | null
          recalc_reason?: string | null
          revision_source_id?: string | null
          school_id?: string
          selected_disciplines?: string[] | null
          selected_topics?: Json | null
          start_date?: string
          topic_order?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cronogramas_revision_source_id_fkey"
            columns: ["revision_source_id"]
            isOneToOne: false
            referencedRelation: "user_cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_cronogramas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mentoring_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
          mentor_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          mentor_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          mentor_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_pdf_progress: {
        Row: {
          created_at: string | null
          id: string
          last_page_read: number | null
          last_read_at: string | null
          pdf_material_id: string
          percentage_complete: number | null
          task_id: string | null
          total_pages_read: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_page_read?: number | null
          last_read_at?: string | null
          pdf_material_id: string
          percentage_complete?: number | null
          task_id?: string | null
          total_pages_read?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_page_read?: number | null
          last_read_at?: string | null
          pdf_material_id?: string
          percentage_complete?: number | null
          task_id?: string | null
          total_pages_read?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pdf_progress_pdf_material_id_fkey"
            columns: ["pdf_material_id"]
            isOneToOne: false
            referencedRelation: "pdf_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pdf_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_cronograma_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_performance_reports: {
        Row: {
          created_at: string | null
          cronograma_id: string | null
          generated_by: string
          id: string
          period_end: string | null
          period_start: string | null
          report_data: Json
          report_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          cronograma_id?: string | null
          generated_by: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_data: Json
          report_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          cronograma_id?: string | null
          generated_by?: string
          id?: string
          period_end?: string | null
          period_start?: string | null
          report_data?: Json
          report_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_performance_reports_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "user_cronogramas"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      webhook_email_fields: {
        Row: {
          created_at: string | null
          display_order: number | null
          field_name: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          field_name: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          field_name?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          product_webhook_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          product_webhook_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          product_webhook_id?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      duplicate_questions_view: {
        Row: {
          discipline_name: string | null
          duplicate_count: number | null
          first_created: string | null
          last_created: string | null
          question_hash: string | null
          question_ids: string[] | null
          study_discipline_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_study_discipline_id_fkey"
            columns: ["study_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      low_quality_questions_view: {
        Row: {
          discipline_name: string | null
          low_quality_count: number | null
          question_ids: string[] | null
          study_discipline_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_study_discipline_id_fkey"
            columns: ["study_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_for_edital_admin: {
        Row: {
          answer: string | null
          banca_id: string | null
          banca_name: string | null
          code: string | null
          created_at: string | null
          difficulty: string | null
          discipline_name: string | null
          id: string | null
          is_active: boolean | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          option_e: string | null
          orgao_id: string | null
          orgao_name: string | null
          prof_comment: string | null
          prova_id: string | null
          prova_name: string | null
          question: string | null
          question_type: string | null
          school_id: string | null
          study_discipline_id: string | null
          study_topic_id: string | null
          topic_name: string | null
          updated_at: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edital_topic_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_banca_id_fkey"
            columns: ["banca_id"]
            isOneToOne: false
            referencedRelation: "bancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_study_discipline_id_fkey"
            columns: ["study_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_study_topic_id_fkey"
            columns: ["study_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_for_students: {
        Row: {
          associated_text: string | null
          banca_id: string | null
          code: string | null
          created_at: string | null
          difficulty: string | null
          id: string | null
          images: Json | null
          is_active: boolean | null
          keys: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          option_e: string | null
          orgao_id: string | null
          position_id: string | null
          prova_id: string | null
          question: string | null
          question_type: string | null
          related_contents: string | null
          study_discipline_id: string | null
          study_topic_id: string | null
          subject_id: string | null
          subtopic_id: string | null
          topic_id: string | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          associated_text?: string | null
          banca_id?: string | null
          code?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string | null
          images?: Json | null
          is_active?: boolean | null
          keys?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          orgao_id?: string | null
          position_id?: string | null
          prova_id?: string | null
          question?: string | null
          question_type?: string | null
          related_contents?: string | null
          study_discipline_id?: string | null
          study_topic_id?: string | null
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          associated_text?: string | null
          banca_id?: string | null
          code?: string | null
          created_at?: string | null
          difficulty?: string | null
          id?: string | null
          images?: Json | null
          is_active?: boolean | null
          keys?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          option_e?: string | null
          orgao_id?: string | null
          position_id?: string | null
          prova_id?: string | null
          question?: string | null
          question_type?: string | null
          related_contents?: string | null
          study_discipline_id?: string | null
          study_topic_id?: string | null
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_banca_id_fkey"
            columns: ["banca_id"]
            isOneToOne: false
            referencedRelation: "bancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_orgao_id_fkey"
            columns: ["orgao_id"]
            isOneToOne: false
            referencedRelation: "orgaos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_study_discipline_id_fkey"
            columns: ["study_discipline_id"]
            isOneToOne: false
            referencedRelation: "study_disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_study_topic_id_fkey"
            columns: ["study_topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_derived_topics_from_source: {
        Args: { p_derived_discipline_id: string; p_source_topic_ids: string[] }
        Returns: Json
      }
      add_source_disciplines_to_school: {
        Args: { p_discipline_ids: string[]; p_school_id: string }
        Returns: Json
      }
      auto_create_goal_and_revisions: {
        Args: { p_notebook_id?: string; p_topic_id: string }
        Returns: Json
      }
      backfill_match_hash_v4: {
        Args: { p_discipline_id: string }
        Returns: Json
      }
      backfill_question_hash: {
        Args: { p_batch_size?: number; p_discipline_id: string }
        Returns: Json
      }
      can_recalculate_cronograma: {
        Args: { p_cronograma_id: string }
        Returns: Json
      }
      canonicalize_text: { Args: { p_text: string }; Returns: string }
      canonicalize_v4: { Args: { p_text: string }; Returns: string }
      check_answer: {
        Args: { question_id: string; user_answer: string }
        Returns: Json
      }
      check_discipline_ready_for_recalc: {
        Args: { p_discipline_id: string }
        Returns: Json
      }
      check_pending_config: { Args: { p_school_id: string }; Returns: Json }
      check_sanitize_trigger_active: {
        Args: never
        Returns: {
          active: boolean
        }[]
      }
      clean_question_text: { Args: { raw_text: string }; Returns: string }
      clear_recalc_flag: { Args: { p_cronograma_id: string }; Returns: boolean }
      compute_is_source_discipline: {
        Args: { p_study_discipline_id: string }
        Returns: boolean
      }
      compute_question_hash_v4: {
        Args: {
          p_ano: number
          p_banca: string
          p_question_html: string
          p_question_type: string
        }
        Returns: string
      }
      copy_source_topic_to_derived: {
        Args: {
          p_dry_run?: boolean
          p_source_topic_id: string
          p_target_topic_id: string
        }
        Returns: Json
      }
      count_duplicate_groups: { Args: never; Returns: number }
      deactivate_all_pending_goals_for_school: {
        Args: { p_school_id: string }
        Returns: Json
      }
      deactivate_pending_goals_for_discipline: {
        Args: { p_discipline_id: string; p_school_id: string }
        Returns: Json
      }
      deduplicate_questions_by_hash: {
        Args: { p_discipline_id?: string }
        Returns: Json
      }
      delete_cronograma_cascade: {
        Args: { p_cronograma_id: string }
        Returns: undefined
      }
      delete_discipline_cascade: {
        Args: { discipline_id_param: string }
        Returns: Json
      }
      delete_discipline_from_edital: {
        Args: { p_discipline_id: string; p_edital_id: string }
        Returns: Json
      }
      delete_discipline_from_school: {
        Args: { p_discipline_id: string; p_school_id: string }
        Returns: Json
      }
      delete_school_cascade: { Args: { p_school_id: string }; Returns: Json }
      ensure_discipline_folder: {
        Args: { p_discipline_id: string }
        Returns: Json
      }
      export_ddl_column_comments: {
        Args: { p_schema?: string }
        Returns: {
          column_name: string
          comment_ddl: string
          table_name: string
        }[]
      }
      export_ddl_constraints: {
        Args: { p_schema?: string }
        Returns: {
          constraint_ddl: string
          constraint_name: string
          table_name: string
        }[]
      }
      export_ddl_enums: {
        Args: { p_schema?: string }
        Returns: {
          enum_labels: string[]
          type_name: string
        }[]
      }
      export_ddl_extensions: {
        Args: never
        Returns: {
          extname: string
          schema_name: string
        }[]
      }
      export_ddl_foreign_keys: {
        Args: { p_schema?: string }
        Returns: {
          constraint_name: string
          fk_ddl: string
          table_name: string
        }[]
      }
      export_ddl_functions: {
        Args: { p_schema?: string }
        Returns: {
          full_signature: string
          function_def: string
          function_signature: string
        }[]
      }
      export_ddl_grants: {
        Args: { p_schema?: string }
        Returns: {
          grant_ddl: string
          object_name: string
          object_type: string
        }[]
      }
      export_ddl_indexes: {
        Args: { p_schema?: string }
        Returns: {
          index_ddl: string
          index_name: string
        }[]
      }
      export_ddl_policies: {
        Args: { p_schema?: string }
        Returns: {
          policy_ddl: string
          policy_name: string
          table_name: string
        }[]
      }
      export_ddl_rls_enable: {
        Args: { p_schema?: string }
        Returns: {
          table_name: string
        }[]
      }
      export_ddl_sequences: {
        Args: { p_schema?: string }
        Returns: {
          sequence_ddl: string
          sequence_name: string
        }[]
      }
      export_ddl_tables: {
        Args: { p_schema?: string }
        Returns: {
          create_ddl: string
          table_comment: string
          table_name: string
        }[]
      }
      export_ddl_triggers: {
        Args: { p_schema?: string }
        Returns: {
          table_name: string
          trigger_ddl: string
          trigger_name: string
        }[]
      }
      export_ddl_views: {
        Args: { p_schema?: string }
        Returns: {
          view_comment: string
          view_def: string
          view_name: string
        }[]
      }
      export_functions_and_triggers_ddl: {
        Args: never
        Returns: {
          ddl_sql: string
          ddl_type: string
          object_name: string
        }[]
      }
      export_snapshot_metadata: {
        Args: never
        Returns: {
          snapshot_id: string
          snapshot_time: string
          transaction_id: number
        }[]
      }
      extract_clean_image_urls: { Args: { p_images: Json }; Returns: string }
      finalize_replacement_batch: {
        Args: { p_actor_id: string; p_batch_id: string }
        Returns: Json
      }
      gen_random_bytes: { Args: { n: number }; Returns: string }
      generate_question_hash:
        | {
            Args: { p_options?: Json; p_question_text: string }
            Returns: string
          }
        | { Args: { question_text: string }; Returns: string }
      generate_question_hash_from_id: {
        Args: { p_question_id: string }
        Returns: string
      }
      generate_question_hash_v3: {
        Args: {
          p_associated_text: string
          p_images: Json
          p_option_a: string
          p_option_b: string
          p_option_c: string
          p_option_d: string
          p_option_e: string
          p_question: string
          p_question_type: string
        }
        Returns: string
      }
      get_available_source_disciplines_for_school: {
        Args: { p_school_id: string }
        Returns: {
          id: string
          name: string
          question_count: number
          topic_count: number
        }[]
      }
      get_available_source_topics: {
        Args: { p_derived_discipline_id: string }
        Returns: {
          question_count: number
          source_notebook_id: string
          topic_id: string
          topic_name: string
        }[]
      }
      get_cronogramas_affected_by_discipline: {
        Args: { p_discipline_id: string }
        Returns: {
          completed_tasks_count: number
          cronograma_id: string
          pending_tasks_count: number
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_derived_topics_for_sync: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          id: string
          name: string
          source_notebook_id: string
        }[]
      }
      get_discipline_question_counts: {
        Args: { discipline_ids: string[] }
        Returns: {
          discipline_id: string
          question_count: number
        }[]
      }
      get_edital_question_counts: {
        Args: { edital_ids: string[] }
        Returns: {
          edital_id: string
          question_count: number
        }[]
      }
      get_feature_flag: { Args: { flag_id: string }; Returns: boolean }
      get_ghost_discipline_order_count: {
        Args: never
        Returns: {
          count: number
        }[]
      }
      get_pending_derived_sync_count: {
        Args: never
        Returns: {
          discipline_name: string
          pending_count: number
        }[]
      }
      get_phantom_goal_count: {
        Args: never
        Returns: {
          count: number
        }[]
      }
      get_public_tables: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      get_public_tables_with_counts: {
        Args: never
        Returns: {
          estimated_rows: number
          table_name: string
        }[]
      }
      get_question_hash_quality: {
        Args: { question_text: string }
        Returns: string
      }
      get_question_hash_quality_v3: {
        Args: {
          p_associated_text: string
          p_option_a: string
          p_option_b: string
          p_option_c: string
          p_option_d: string
          p_option_e: string
          p_question: string
        }
        Returns: string
      }
      get_questions_paginated: {
        Args: {
          p_banca_ids?: string[]
          p_keyword?: string
          p_orgao_ids?: string[]
          p_page?: number
          p_page_size?: number
          p_prova_ids?: string[]
          p_question_ids?: string[]
          p_question_types?: string[]
          p_status?: string
          p_user_id?: string
          p_years?: number[]
        }
        Returns: {
          banca_id: string
          banca_name: string
          code: string
          created_at: string
          difficulty: string
          discipline_name: string
          id: string
          is_active: boolean
          keys: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          option_e: string
          orgao_id: string
          orgao_name: string
          prova_id: string
          prova_name: string
          question: string
          question_type: string
          related_contents: string
          study_discipline_id: string
          study_topic_id: string
          topic_name: string
          total_count: number
          user_answered: boolean
          user_is_correct: boolean
          year: number
        }[]
      }
      get_replacement_preview: {
        Args: { p_discipline_id: string }
        Returns: Json
      }
      get_school_question_ids: {
        Args: {
          p_discipline_ids?: string[]
          p_school_id: string
          p_topic_ids?: string[]
        }
        Returns: {
          question_id: string
          total_count: number
        }[]
      }
      get_topic_goals_with_inheritance: {
        Args: { p_topic_ids: string[] }
        Returns: {
          discipline_id: string
          discipline_name: string
          display_order: number
          duration_minutes: number
          goal_id: string
          goal_name: string
          goal_type: string
          is_inherited: boolean
          source_topic_id: string
          topic_display_order: number
          topic_id: string
          topic_name: string
        }[]
      }
      get_topic_pdfs_with_inheritance: {
        Args: { p_topic_ids: string[] }
        Returns: {
          discipline_id: string
          discipline_name: string
          display_order: number
          file_url: string
          is_inherited: boolean
          pdf_description: string
          pdf_material_id: string
          pdf_name: string
          source_topic_id: string
          topic_id: string
          topic_name: string
          total_pages: number
          total_study_minutes: number
        }[]
      }
      get_topic_question_counts: {
        Args: { topic_ids: string[] }
        Returns: {
          question_count: number
          topic_id: string
        }[]
      }
      hard_delete_topic_questions: {
        Args: { p_topic_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_discipline_to_school: {
        Args: { p_source_discipline_id: string; p_target_school_id: string }
        Returns: Json
      }
      import_questions_to_derived_topic: {
        Args: { p_dry_run?: boolean; p_questions: Json; p_topic_id: string }
        Returns: Json
      }
      import_questions_to_topic_v3: {
        Args: { p_dry_run?: boolean; p_questions: Json; p_topic_id: string }
        Returns: Json
      }
      is_admin_email: { Args: { email_to_check: string }; Returns: boolean }
      log_cronograma_health_event: {
        Args: { p_context?: string; p_count?: number; p_event_type: string }
        Returns: undefined
      }
      mark_cronogramas_for_recalc: {
        Args: { p_reason?: string; p_school_id: string }
        Returns: Json
      }
      merge_all_duplicates: { Args: never; Returns: Json }
      merge_duplicate_questions: {
        Args: { keep_question_id: string; remove_question_ids: string[] }
        Returns: Json
      }
      normalize_question_text: { Args: { text_input: string }; Returns: string }
      normalize_topic_name_soft: {
        Args: { topic_name: string }
        Returns: string
      }
      overwrite_discipline_goals: {
        Args: {
          p_admin_id?: string
          p_discipline_id: string
          p_new_goals: Json
        }
        Returns: Json
      }
      overwrite_discipline_revisions: {
        Args: {
          p_admin_id?: string
          p_discipline_id: string
          p_new_revisions: Json
        }
        Returns: Json
      }
      prof_comment_jsonb_to_html: { Args: { p_comment: Json }; Returns: string }
      recalculate_notebook_counts: {
        Args: { p_discipline_id?: string }
        Returns: Json
      }
      replace_discipline_mapping_soft: {
        Args: {
          p_actor_id: string
          p_discipline_id: string
          p_new_topics: Json
        }
        Returns: Json
      }
      resolve_pending_config: {
        Args: {
          p_discipline_id: string
          p_pending_type?: string
          p_school_id: string
        }
        Returns: boolean
      }
      rollback_discipline_replacement: {
        Args: { p_actor_id: string; p_batch_id: string }
        Returns: Json
      }
      scan_all_duplicates: {
        Args: never
        Returns: {
          duplicate_hash: string
          question_count: number
          question_ids: string[]
        }[]
      }
      search_questions: {
        Args: { p_filters: Json; p_page: number; p_page_size: number }
        Returns: Json
      }
      sync_pending_config_with_reality: { Args: never; Returns: Json }
      sync_workload_question_goals: {
        Args: { p_edital_id?: string; p_school_id?: string }
        Returns: Json
      }
      upsert_import_batch:
        | {
            Args: {
              p_batch_id?: string
              p_chunk_index?: number
              p_discipline_id: string
              p_finalize?: boolean
              p_questions: Json
              p_total_chunks?: number
              p_zip_filename?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_batch_id?: string
              p_chunk_index?: number
              p_discipline_id: string
              p_finalize?: boolean
              p_mode?: string
              p_questions?: Json
              p_topics?: Json
              p_total_chunks?: number
              p_zip_filename?: string
            }
            Returns: Json
          }
    }
    Enums: {
      access_type: "manual" | "payment" | "period"
      app_role: "admin" | "moderator" | "user"
      resource_type:
        | "banco_questoes"
        | "cronograma"
        | "robos_dissecadores"
        | "materiais_pdf"
        | "videos"
        | "flashcards"
        | "comunidades"
        | "simulados"
        | "mentoria"
        | "comece_por_aqui"
      section_type: "preparatorios" | "cursos" | "ferramentas"
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
      access_type: ["manual", "payment", "period"],
      app_role: ["admin", "moderator", "user"],
      resource_type: [
        "banco_questoes",
        "cronograma",
        "robos_dissecadores",
        "materiais_pdf",
        "videos",
        "flashcards",
        "comunidades",
        "simulados",
        "mentoria",
        "comece_por_aqui",
      ],
      section_type: ["preparatorios", "cursos", "ferramentas"],
    },
  },
} as const
