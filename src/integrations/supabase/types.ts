export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json;
          id: number;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: never;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [];
      };
      badges: {
        Row: {
          code: string;
          description_ar: string | null;
          description_en: string | null;
          position: number;
          title_ar: string;
          title_en: string;
          xp_bonus: number;
        };
        Insert: {
          code: string;
          description_ar?: string | null;
          description_en?: string | null;
          position?: number;
          title_ar: string;
          title_en: string;
          xp_bonus?: number;
        };
        Update: {
          code?: string;
          description_ar?: string | null;
          description_en?: string | null;
          position?: number;
          title_ar?: string;
          title_en?: string;
          xp_bonus?: number;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          body_fat_pct: number | null;
          created_at: string;
          id: string;
          measured_on: string;
          member_id: string;
          revision: number;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        Insert: {
          body_fat_pct?: number | null;
          created_at?: string;
          id?: string;
          measured_on?: string;
          member_id: string;
          revision?: number;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          body_fat_pct?: number | null;
          created_at?: string;
          id?: string;
          measured_on?: string;
          member_id?: string;
          revision?: number;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "body_measurements_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_assignments: {
        Row: {
          active: boolean;
          coach_id: string;
          created_at: string;
          id: string;
          member_id: string;
        };
        Insert: {
          active?: boolean;
          coach_id: string;
          created_at?: string;
          id?: string;
          member_id: string;
        };
        Update: {
          active?: boolean;
          coach_id?: string;
          created_at?: string;
          id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_assignments_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_assignments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_alternatives: {
        Row: {
          alternative_id: string;
          exercise_id: string;
          reason_ar: string;
          reason_en: string;
        };
        Insert: {
          alternative_id: string;
          exercise_id: string;
          reason_ar: string;
          reason_en: string;
        };
        Update: {
          alternative_id?: string;
          exercise_id?: string;
          reason_ar?: string;
          reason_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_alternatives_alternative_id_fkey";
            columns: ["alternative_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_alternatives_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          active: boolean;
          aliases: string[];
          created_at: string;
          created_by: string | null;
          editorial_status: string;
          equipment: string | null;
          equipment_tags: string[];
          guidance: Json;
          id: string;
          instructions: string | null;
          load_convention: string;
          logging_mode: string;
          media: Json | null;
          media_url: string | null;
          movement_pattern: string | null;
          muscle: string;
          name_ar: string | null;
          name_en: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          aliases?: string[];
          created_at?: string;
          created_by?: string | null;
          editorial_status?: string;
          equipment?: string | null;
          equipment_tags?: string[];
          guidance?: Json;
          id?: string;
          instructions?: string | null;
          load_convention?: string;
          logging_mode?: string;
          media?: Json | null;
          media_url?: string | null;
          movement_pattern?: string | null;
          muscle: string;
          name_ar?: string | null;
          name_en: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          aliases?: string[];
          created_at?: string;
          created_by?: string | null;
          editorial_status?: string;
          equipment?: string | null;
          equipment_tags?: string[];
          guidance?: Json;
          id?: string;
          instructions?: string | null;
          load_convention?: string;
          logging_mode?: string;
          media?: Json | null;
          media_url?: string | null;
          movement_pattern?: string | null;
          muscle?: string;
          name_ar?: string | null;
          name_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      food_logs: {
        Row: {
          calories: number;
          carbs_g: number;
          created_at: string;
          fat_g: number;
          id: string;
          log_date: string;
          meal: string;
          member_id: string;
          name: string;
          protein_g: number;
          revision: number;
        };
        Insert: {
          calories?: number;
          carbs_g?: number;
          created_at?: string;
          fat_g?: number;
          id?: string;
          log_date?: string;
          meal?: string;
          member_id: string;
          name: string;
          protein_g?: number;
          revision?: number;
        };
        Update: {
          calories?: number;
          carbs_g?: number;
          created_at?: string;
          fat_g?: number;
          id?: string;
          log_date?: string;
          meal?: string;
          member_id?: string;
          name?: string;
          protein_g?: number;
          revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "food_logs_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      foods: {
        Row: {
          active: boolean;
          calories: number;
          carbs_g: number;
          created_at: string;
          fat_g: number;
          id: string;
          name_ar: string | null;
          name_en: string;
          protein_g: number;
          serving: string;
        };
        Insert: {
          active?: boolean;
          calories: number;
          carbs_g?: number;
          created_at?: string;
          fat_g?: number;
          id?: string;
          name_ar?: string | null;
          name_en: string;
          protein_g?: number;
          serving: string;
        };
        Update: {
          active?: boolean;
          calories?: number;
          carbs_g?: number;
          created_at?: string;
          fat_g?: number;
          id?: string;
          name_ar?: string | null;
          name_en?: string;
          protein_g?: number;
          serving?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          created_at: string;
          id: string;
          member_id: string;
          parser_version: number;
          provider: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          member_id: string;
          parser_version?: number;
          provider: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          member_id?: string;
          parser_version?: number;
          provider?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      import_receipts: {
        Row: {
          batch_id: string;
          content_fingerprint: string;
          fingerprint: string;
          member_id: string;
          provider: string;
          session_id: string | null;
        };
        Insert: {
          batch_id: string;
          content_fingerprint: string;
          fingerprint: string;
          member_id: string;
          provider: string;
          session_id?: string | null;
        };
        Update: {
          batch_id?: string;
          content_fingerprint?: string;
          fingerprint?: string;
          member_id?: string;
          provider?: string;
          session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_receipts_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_receipts_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_receipts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          accepted_at: string | null;
          coach_id: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          pod_id: string | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          accepted_at?: string | null;
          coach_id?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          pod_id?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          accepted_at?: string | null;
          coach_id?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          pod_id?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [
          {
            foreignKeyName: "invites_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_pod_id_fkey";
            columns: ["pod_id"];
            isOneToOne: false;
            referencedRelation: "pod_leaderboard";
            referencedColumns: ["pod_id"];
          },
          {
            foreignKeyName: "invites_pod_id_fkey";
            columns: ["pod_id"];
            isOneToOne: false;
            referencedRelation: "pods";
            referencedColumns: ["id"];
          },
        ];
      };
      leaderboard_weekly: {
        Row: {
          display_name: string | null;
          member_id: string;
          opted_in: boolean;
          week_start: string;
          xp: number;
        };
        Insert: {
          display_name?: string | null;
          member_id: string;
          opted_in?: boolean;
          week_start: string;
          xp?: number;
        };
        Update: {
          display_name?: string | null;
          member_id?: string;
          opted_in?: boolean;
          week_start?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "leaderboard_weekly_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      level_thresholds: {
        Row: {
          level: number;
          provisional: boolean;
          xp_required: number;
        };
        Insert: {
          level: number;
          provisional?: boolean;
          xp_required: number;
        };
        Update: {
          level?: number;
          provisional?: boolean;
          xp_required?: number;
        };
        Relationships: [];
      };
      member_badges: {
        Row: {
          badge_code: string;
          member_id: string;
          unlocked_at: string;
        };
        Insert: {
          badge_code: string;
          member_id: string;
          unlocked_at?: string;
        };
        Update: {
          badge_code?: string;
          member_id?: string;
          unlocked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_badges_badge_code_fkey";
            columns: ["badge_code"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "member_badges_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          member_id: string;
          read_at: string | null;
          title_ar: string;
          title_en: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          member_id: string;
          read_at?: string | null;
          title_ar: string;
          title_en: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          member_id?: string;
          read_at?: string | null;
          title_ar?: string;
          title_en?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_targets: {
        Row: {
          calories: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          member_id: string;
          protein_g: number | null;
          set_by: string | null;
          updated_at: string;
          water_ml: number | null;
        };
        Insert: {
          calories?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          member_id: string;
          protein_g?: number | null;
          set_by?: string | null;
          updated_at?: string;
          water_ml?: number | null;
        };
        Update: {
          calories?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          member_id?: string;
          protein_g?: number | null;
          set_by?: string | null;
          updated_at?: string;
          water_ml?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_targets_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      photo_deletion_queue: {
        Row: {
          created_at: string;
          member_id: string;
          path: string;
          photo_id: string;
        };
        Insert: {
          created_at?: string;
          member_id: string;
          path: string;
          photo_id: string;
        };
        Update: {
          created_at?: string;
          member_id?: string;
          path?: string;
          photo_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photo_deletion_queue_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "photo_deletion_queue_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: true;
            referencedRelation: "progress_photos";
            referencedColumns: ["id"];
          },
        ];
      };
      pod_activity: {
        Row: {
          created_at: string;
          display_name: string;
          event_id: number;
          id: number;
          member_id: string;
          pod_id: string;
          title: string;
          xp: number;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          event_id: number;
          id?: never;
          member_id: string;
          pod_id: string;
          title: string;
          xp: number;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          event_id?: number;
          id?: never;
          member_id?: string;
          pod_id?: string;
          title?: string;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pod_activity_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "xp_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pod_activity_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pod_activity_pod_id_fkey";
            columns: ["pod_id"];
            isOneToOne: false;
            referencedRelation: "pod_leaderboard";
            referencedColumns: ["pod_id"];
          },
          {
            foreignKeyName: "pod_activity_pod_id_fkey";
            columns: ["pod_id"];
            isOneToOne: false;
            referencedRelation: "pods";
            referencedColumns: ["id"];
          },
        ];
      };
      pod_members: {
        Row: {
          created_at: string;
          member_id: string;
          pod_id: string;
        };
        Insert: {
          created_at?: string;
          member_id: string;
          pod_id: string;
        };
        Update: {
          created_at?: string;
          member_id?: string;
          pod_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pod_members_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pod_members_pod_id_fkey";
            columns: ["pod_id"];
            isOneToOne: false;
            referencedRelation: "pod_leaderboard";
            referencedColumns: ["pod_id"];
          },
          {
            foreignKeyName: "pod_members_pod_id_fkey";
            columns: ["pod_id"];
            isOneToOne: false;
            referencedRelation: "pods";
            referencedColumns: ["id"];
          },
        ];
      };
      pods: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          leader_id: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          leader_id?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          leader_id?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pods_leader_id_fkey";
            columns: ["leader_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          access_active: boolean;
          avatar_url: string | null;
          consent_at: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          leaderboard_opt_in: boolean;
          locale: string;
          onboarding_completed: boolean;
          pod_feed_opt_in: boolean;
          timezone: string;
          units: string;
          updated_at: string;
        };
        Insert: {
          access_active?: boolean;
          avatar_url?: string | null;
          consent_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          leaderboard_opt_in?: boolean;
          locale?: string;
          onboarding_completed?: boolean;
          pod_feed_opt_in?: boolean;
          timezone?: string;
          units?: string;
          updated_at?: string;
        };
        Update: {
          access_active?: boolean;
          avatar_url?: string | null;
          consent_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          leaderboard_opt_in?: boolean;
          locale?: string;
          onboarding_completed?: boolean;
          pod_feed_opt_in?: boolean;
          timezone?: string;
          units?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      program_assignments: {
        Row: {
          active: boolean;
          assigned_by: string | null;
          created_at: string;
          id: string;
          member_id: string;
          program_id: string;
          program_version_id: string;
          start_date: string;
        };
        Insert: {
          active?: boolean;
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          member_id: string;
          program_id: string;
          program_version_id: string;
          start_date?: string;
        };
        Update: {
          active?: boolean;
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          member_id?: string;
          program_id?: string;
          program_version_id?: string;
          start_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_assignments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_program_version_id_fkey";
            columns: ["program_version_id"];
            isOneToOne: false;
            referencedRelation: "program_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      program_items: {
        Row: {
          created_at: string;
          day: number;
          exercise_id: string;
          id: string;
          position: number;
          program_id: string;
          target_reps: string;
          target_sets: number;
          week: number;
        };
        Insert: {
          created_at?: string;
          day: number;
          exercise_id: string;
          id?: string;
          position?: number;
          program_id: string;
          target_reps?: string;
          target_sets?: number;
          week: number;
        };
        Update: {
          created_at?: string;
          day?: number;
          exercise_id?: string;
          id?: string;
          position?: number;
          program_id?: string;
          target_reps?: string;
          target_sets?: number;
          week?: number;
        };
        Relationships: [
          {
            foreignKeyName: "program_items_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_items_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      program_schedules: {
        Row: {
          assignment_id: string;
          member_id: string;
          mode: string;
          start_date: string;
        };
        Insert: {
          assignment_id: string;
          member_id: string;
          mode: string;
          start_date: string;
        };
        Update: {
          assignment_id?: string;
          member_id?: string;
          mode?: string;
          start_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_schedules_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: true;
            referencedRelation: "program_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_schedules_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      program_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          items: Json;
          name: string;
          program_id: string;
          version: number;
          weeks: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          items: Json;
          name: string;
          program_id: string;
          version: number;
          weeks: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          items?: Json;
          name?: string;
          program_id?: string;
          version?: number;
          weeks?: number;
        };
        Relationships: [
          {
            foreignKeyName: "program_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_versions_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          weeks: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          weeks?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          weeks?: number;
        };
        Relationships: [];
      };
      progress_photos: {
        Row: {
          created_at: string;
          id: string;
          member_id: string;
          path: string;
          pose: string;
          taken_on: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          member_id: string;
          path: string;
          pose?: string;
          taken_on?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          member_id?: string;
          path?: string;
          pose?: string;
          taken_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_photos_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pv_claims: {
        Row: {
          created_at: string;
          id: string;
          member_id: string;
          note: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          task_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          member_id: string;
          note?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          task_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          member_id?: string;
          note?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pv_claims_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pv_claims_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "pv_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      pv_ledger: {
        Row: {
          approved_by: string;
          claim_id: string | null;
          created_at: string;
          id: number;
          member_id: string;
          points: number;
          redemption_id: string | null;
          source: string;
        };
        Insert: {
          approved_by: string;
          claim_id?: string | null;
          created_at?: string;
          id?: never;
          member_id: string;
          points: number;
          redemption_id?: string | null;
          source: string;
        };
        Update: {
          approved_by?: string;
          claim_id?: string | null;
          created_at?: string;
          id?: never;
          member_id?: string;
          points?: number;
          redemption_id?: string | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pv_ledger_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: true;
            referencedRelation: "pv_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pv_ledger_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pv_ledger_redemption_id_fkey";
            columns: ["redemption_id"];
            isOneToOne: false;
            referencedRelation: "redemptions";
            referencedColumns: ["id"];
          },
        ];
      };
      pv_tasks: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          points: number;
          title_ar: string | null;
          title_en: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          points: number;
          title_ar?: string | null;
          title_en: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          points?: number;
          title_ar?: string | null;
          title_en?: string;
        };
        Relationships: [];
      };
      redemptions: {
        Row: {
          cost_pv: number;
          created_at: string;
          id: string;
          member_id: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          reward_id: string;
          status: string;
        };
        Insert: {
          cost_pv?: number;
          created_at?: string;
          id?: string;
          member_id: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reward_id: string;
          status?: string;
        };
        Update: {
          cost_pv?: number;
          created_at?: string;
          id?: string;
          member_id?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reward_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "redemptions_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "redemptions_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "rewards";
            referencedColumns: ["id"];
          },
        ];
      };
      rewards: {
        Row: {
          active: boolean;
          cost_pv: number;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          stock: number | null;
          title_ar: string | null;
          title_en: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          cost_pv: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          stock?: number | null;
          title_ar?: string | null;
          title_en: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          cost_pv?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          stock?: number | null;
          title_ar?: string | null;
          title_en?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_meals: {
        Row: {
          created_at: string;
          id: string;
          items: Json;
          kind: string;
          member_id: string;
          name: string;
          revision: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          items: Json;
          kind: string;
          member_id: string;
          name: string;
          revision?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          items?: Json;
          kind?: string;
          member_id?: string;
          name?: string;
          revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "saved_meals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      session_occurrences: {
        Row: {
          assignment_id: string;
          day: number;
          due_date: string | null;
          id: string;
          member_id: string;
          ordinal: number;
          program_version_id: string;
          status: string;
          week: number;
        };
        Insert: {
          assignment_id: string;
          day: number;
          due_date?: string | null;
          id?: string;
          member_id: string;
          ordinal: number;
          program_version_id: string;
          status?: string;
          week: number;
        };
        Update: {
          assignment_id?: string;
          day?: number;
          due_date?: string | null;
          id?: string;
          member_id?: string;
          ordinal?: number;
          program_version_id?: string;
          status?: string;
          week?: number;
        };
        Relationships: [
          {
            foreignKeyName: "session_occurrences_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "program_schedules";
            referencedColumns: ["assignment_id"];
          },
          {
            foreignKeyName: "session_occurrences_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_occurrences_program_version_id_fkey";
            columns: ["program_version_id"];
            isOneToOne: false;
            referencedRelation: "program_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      set_logs: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          exercise_id: string;
          id: string;
          load_convention: string;
          logging_mode: string;
          member_id: string;
          pair_id: string | null;
          reps: number | null;
          root_set_id: string | null;
          rpe: number | null;
          segment_index: number;
          session_id: string;
          set_number: number;
          set_role: string;
          side: string;
          slot_key: string;
          weight_kg: number | null;
          workout_exercise_id: string | null;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          exercise_id: string;
          id?: string;
          load_convention?: string;
          logging_mode?: string;
          member_id: string;
          pair_id?: string | null;
          reps?: number | null;
          root_set_id?: string | null;
          rpe?: number | null;
          segment_index?: number;
          session_id: string;
          set_number: number;
          set_role?: string;
          side?: string;
          slot_key?: string;
          weight_kg?: number | null;
          workout_exercise_id?: string | null;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          exercise_id?: string;
          id?: string;
          load_convention?: string;
          logging_mode?: string;
          member_id?: string;
          pair_id?: string | null;
          reps?: number | null;
          root_set_id?: string | null;
          rpe?: number | null;
          segment_index?: number;
          session_id?: string;
          set_number?: number;
          set_role?: string;
          side?: string;
          slot_key?: string;
          weight_kg?: number | null;
          workout_exercise_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_logs_root_set_id_fkey";
            columns: ["root_set_id"];
            isOneToOne: false;
            referencedRelation: "set_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_logs_session_member_fkey";
            columns: ["session_id", "member_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id", "member_id"];
          },
          {
            foreignKeyName: "set_logs_workout_exercise_id_fkey";
            columns: ["workout_exercise_id"];
            isOneToOne: false;
            referencedRelation: "workout_exercises";
            referencedColumns: ["id"];
          },
        ];
      };
      streak_shields: {
        Row: {
          created_at: string;
          member_id: string;
          shield_date: string;
        };
        Insert: {
          created_at?: string;
          member_id: string;
          shield_date: string;
        };
        Update: {
          created_at?: string;
          member_id?: string;
          shield_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "streak_shields_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_pilots: {
        Row: {
          member_id: string;
        };
        Insert: {
          member_id: string;
        };
        Update: {
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_pilots_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_policies: {
        Row: {
          allow_imported: boolean;
          duration_target: number | null;
          exercise_id: string;
          id: string;
          increment: number;
          member_id: string;
          override: Json | null;
          program_version_id: string;
          reps_max: number | null;
          reps_min: number | null;
          revision: number;
          rpe_ceiling: number;
          rule: string;
          slot_key: string;
          updated_at: string;
          updated_by: string | null;
          upper_limit: number | null;
          working_sets: number;
        };
        Insert: {
          allow_imported?: boolean;
          duration_target?: number | null;
          exercise_id: string;
          id?: string;
          increment: number;
          member_id: string;
          override?: Json | null;
          program_version_id: string;
          reps_max?: number | null;
          reps_min?: number | null;
          revision?: number;
          rpe_ceiling: number;
          rule?: string;
          slot_key: string;
          updated_at?: string;
          updated_by?: string | null;
          upper_limit?: number | null;
          working_sets: number;
        };
        Update: {
          allow_imported?: boolean;
          duration_target?: number | null;
          exercise_id?: string;
          id?: string;
          increment?: number;
          member_id?: string;
          override?: Json | null;
          program_version_id?: string;
          reps_max?: number | null;
          reps_min?: number | null;
          revision?: number;
          rpe_ceiling?: number;
          rule?: string;
          slot_key?: string;
          updated_at?: string;
          updated_by?: string | null;
          upper_limit?: number | null;
          working_sets?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_policies_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_policies_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_policies_program_version_id_fkey";
            columns: ["program_version_id"];
            isOneToOne: false;
            referencedRelation: "program_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_policies_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      training_rollout: {
        Row: {
          available: boolean;
          enabled: boolean;
          feature: string;
          staff_enabled: boolean;
        };
        Insert: {
          available?: boolean;
          enabled?: boolean;
          feature: string;
          staff_enabled?: boolean;
        };
        Update: {
          available?: boolean;
          enabled?: boolean;
          feature?: string;
          staff_enabled?: boolean;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      water_logs: {
        Row: {
          created_at: string;
          id: string;
          log_date: string;
          member_id: string;
          ml: number;
          revision: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          log_date?: string;
          member_id: string;
          ml: number;
          revision?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          log_date?: string;
          member_id?: string;
          ml?: number;
          revision?: number;
        };
        Relationships: [
          {
            foreignKeyName: "water_logs_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wellness_checkins: {
        Row: {
          created_at: string;
          energy: number | null;
          id: string;
          log_date: string;
          member_id: string;
          notes: string | null;
          revision: number;
          sleep_hours: number | null;
          soreness: number | null;
        };
        Insert: {
          created_at?: string;
          energy?: number | null;
          id?: string;
          log_date: string;
          member_id: string;
          notes?: string | null;
          revision?: number;
          sleep_hours?: number | null;
          soreness?: number | null;
        };
        Update: {
          created_at?: string;
          energy?: number | null;
          id?: string;
          log_date?: string;
          member_id?: string;
          notes?: string | null;
          revision?: number;
          sleep_hours?: number | null;
          soreness?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "wellness_checkins_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_exercises: {
        Row: {
          exercise_id: string;
          id: string;
          member_id: string;
          session_id: string;
          slot_key: string;
          snapshot: Json;
        };
        Insert: {
          exercise_id: string;
          id?: string;
          member_id: string;
          session_id: string;
          slot_key?: string;
          snapshot: Json;
        };
        Update: {
          exercise_id?: string;
          id?: string;
          member_id?: string;
          session_id?: string;
          slot_key?: string;
          snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_exercises_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_exercises_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "workout_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_sessions: {
        Row: {
          activity_date: string | null;
          created_at: string;
          finished_at: string | null;
          id: string;
          import_batch_id: string | null;
          import_edited: boolean;
          member_id: string;
          notes: string | null;
          occurrence_id: string | null;
          origin: string;
          started_at: string;
          time_precision: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          activity_date?: string | null;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          import_batch_id?: string | null;
          import_edited?: boolean;
          member_id: string;
          notes?: string | null;
          occurrence_id?: string | null;
          origin?: string;
          started_at?: string;
          time_precision?: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          activity_date?: string | null;
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          import_batch_id?: string | null;
          import_edited?: boolean;
          member_id?: string;
          notes?: string | null;
          occurrence_id?: string | null;
          origin?: string;
          started_at?: string;
          time_precision?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_sessions_import_batch_fk";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_sessions_occurrence_id_fkey";
            columns: ["occurrence_id"];
            isOneToOne: true;
            referencedRelation: "session_occurrences";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_events: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          member_id: string;
          source: string;
          source_ref: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: never;
          member_id: string;
          source: string;
          source_ref: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: never;
          member_id?: string;
          source?: string;
          source_ref?: string;
        };
        Relationships: [
          {
            foreignKeyName: "xp_events_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      member_activity_days: {
        Row: {
          activity_date: string | null;
          member_id: string | null;
        };
        Relationships: [];
      };
      member_pv_totals: {
        Row: {
          member_id: string | null;
          points: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "pv_ledger_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      member_xp_totals: {
        Row: {
          member_id: string | null;
          xp: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "xp_events_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pod_leaderboard: {
        Row: {
          display_name: string | null;
          member_id: string | null;
          opted_in: boolean | null;
          pod_id: string | null;
          week_start: string | null;
          xp: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "leaderboard_weekly_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      xp_rules: {
        Row: {
          body_week_xp: number | null;
          effective_from: string | null;
          level_100_xp: number | null;
          nutrition_day_xp: number | null;
          offline_grace_days: number | null;
          policy_version: string | null;
          workout_weekly_cap: number | null;
          workout_xp: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      review_program_draft: {
        Args: { _program: string; _action: string; _expected: Json };
        Returns: Json;
      };
      review_program_assignment: {
        Args: { _member: string; _version: string; _expected: string | null };
        Returns: string;
      };
      apply_member_mutations: { Args: { _mutations: Json }; Returns: Json };
      assign_program_version: {
        Args: { _member: string; _version: string };
        Returns: string;
      };
      award_xp: {
        Args: {
          _amount: number;
          _member: string;
          _ref: string;
          _source: string;
        };
        Returns: undefined;
      };
      commit_training_import: {
        Args: { _batch: string; _provider: string; _workouts: Json };
        Returns: Json;
      };
      configure_program_schedule: {
        Args: { _assignment: string; _mode: string; _start: string; _expected: Json };
        Returns: undefined;
      };
      copy_program_week_one: { Args: { _program: string }; Returns: undefined };
      export_personal_data: { Args: never; Returns: Json };
      get_admin_analytics: { Args: never; Returns: Json };
      get_import_batch_outcome: { Args: { _batch: string }; Returns: Json };
      get_training_context: {
        Args: { _member: string; _slot: string };
        Returns: Json;
      };
      get_training_features: { Args: never; Returns: Json };
      grant_badge: {
        Args: { _code: string; _member: string };
        Returns: undefined;
      };
      move_session_occurrence: {
        Args: { _date: string; _id: string };
        Returns: undefined;
      };
      notify: {
        Args: {
          _ar: string;
          _en: string;
          _kind: string;
          _link: string;
          _member: string;
        };
        Returns: undefined;
      };
      publish_program: { Args: { _program: string }; Returns: string };
      request_redemption: {
        Args: {
          _expected_cost: number;
          _member: string;
          _request: string;
          _reward: string;
        };
        Returns: Json;
      };
      restore_personal_data: {
        Args: { _data: Json; _preferences?: boolean };
        Returns: Json;
      };
      set_member_coach: {
        Args: { _coach?: string; _member: string };
        Returns: undefined;
      };
      start_session_occurrence: {
        Args: { _occurrence: string; _session: string; _started: string };
        Returns: Json;
      };
      undo_training_import: { Args: { _batch: string }; Returns: Json };
    };
    Enums: {
      app_role: "member" | "coach" | "pod_leader" | "admin" | "super_admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "coach", "pod_leader", "admin", "super_admin"],
    },
  },
} as const;
