export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      collections: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_tags: {
        Row: {
          item_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          item_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          item_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_tags_item_id_user_id_fkey"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "item_tags_tag_id_user_id_fkey"
            columns: ["tag_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "item_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          author: string | null
          auto_metadata: Json
          canonical_url: string
          collection_id: string | null
          created_at: string
          deleted_at: string | null
          domain: string
          edited_fields: string[]
          excerpt: string | null
          extract_error: string | null
          extract_status: Database["public"]["Enums"]["extract_status"]
          extracted_at: string | null
          favicon_url: string | null
          id: string
          is_important: boolean
          lang: string | null
          media_type: Database["public"]["Enums"]["media_type"] | null
          note: string | null
          position: number
          published_at: string | null
          read_at: string | null
          read_state: Database["public"]["Enums"]["read_state"]
          reading_time_min: number | null
          site_name: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          author?: string | null
          auto_metadata?: Json
          canonical_url: string
          collection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          domain: string
          edited_fields?: string[]
          excerpt?: string | null
          extract_error?: string | null
          extract_status?: Database["public"]["Enums"]["extract_status"]
          extracted_at?: string | null
          favicon_url?: string | null
          id?: string
          is_important?: boolean
          lang?: string | null
          media_type?: Database["public"]["Enums"]["media_type"] | null
          note?: string | null
          position?: number
          published_at?: string | null
          read_at?: string | null
          read_state?: Database["public"]["Enums"]["read_state"]
          reading_time_min?: number | null
          site_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          author?: string | null
          auto_metadata?: Json
          canonical_url?: string
          collection_id?: string | null
          created_at?: string
          deleted_at?: string | null
          domain?: string
          edited_fields?: string[]
          excerpt?: string | null
          extract_error?: string | null
          extract_status?: Database["public"]["Enums"]["extract_status"]
          extracted_at?: string | null
          favicon_url?: string | null
          id?: string
          is_important?: boolean
          lang?: string | null
          media_type?: Database["public"]["Enums"]["media_type"] | null
          note?: string | null
          position?: number
          published_at?: string | null
          read_at?: string | null
          read_state?: Database["public"]["Enums"]["read_state"]
          reading_time_min?: number | null
          site_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_collection_id_user_id_fkey"
            columns: ["collection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
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
          default_sort_script_id: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_sort_script_id?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_sort_script_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_sort_script_fkey"
            columns: ["default_sort_script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          item_id: string
          remind_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          remind_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          remind_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_item_id_user_id_fkey"
            columns: ["item_id", "user_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          created_at: string
          forked_from: string | null
          id: string
          is_builtin: boolean
          kind: Database["public"]["Enums"]["script_kind"]
          name: string
          source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          forked_from?: string | null
          id?: string
          is_builtin?: boolean
          kind: Database["public"]["Enums"]["script_kind"]
          name: string
          source: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          forked_from?: string | null
          id?: string
          is_builtin?: boolean
          kind?: Database["public"]["Enums"]["script_kind"]
          name?: string
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scripts_forked_from_fkey"
            columns: ["forked_from"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      views: {
        Row: {
          collection_id: string | null
          created_at: string
          filter: Json
          group_script_id: string | null
          id: string
          layout: Database["public"]["Enums"]["view_layout"]
          name: string
          position: number
          sort_direction: Database["public"]["Enums"]["sort_direction"]
          sort_script_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          filter?: Json
          group_script_id?: string | null
          id?: string
          layout?: Database["public"]["Enums"]["view_layout"]
          name: string
          position?: number
          sort_direction?: Database["public"]["Enums"]["sort_direction"]
          sort_script_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          filter?: Json
          group_script_id?: string | null
          id?: string
          layout?: Database["public"]["Enums"]["view_layout"]
          name?: string
          position?: number
          sort_direction?: Database["public"]["Enums"]["sort_direction"]
          sort_script_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "views_collection_id_user_id_fkey"
            columns: ["collection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "views_group_script_id_fkey"
            columns: ["group_script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "views_sort_script_id_fkey"
            columns: ["sort_script_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "views_user_id_fkey"
            columns: ["user_id"]
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
      item_property_keys: { Args: never; Returns: string[] }
      merge_collection: {
        Args: { source_id: string; target_id: string }
        Returns: undefined
      }
    }
    Enums: {
      extract_status: "pending" | "ok" | "failed"
      media_type: "article" | "video" | "image" | "pdf" | "link"
      read_state: "unread" | "reading" | "read"
      reminder_status: "scheduled" | "sent" | "dismissed" | "cancelled"
      script_kind: "sort" | "group"
      sort_direction: "asc" | "desc"
      view_layout: "list" | "card" | "grid" | "headline"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      extract_status: ["pending", "ok", "failed"],
      media_type: ["article", "video", "image", "pdf", "link"],
      read_state: ["unread", "reading", "read"],
      reminder_status: ["scheduled", "sent", "dismissed", "cancelled"],
      script_kind: ["sort", "group"],
      sort_direction: ["asc", "desc"],
      view_layout: ["list", "card", "grid", "headline"],
    },
  },
} as const

