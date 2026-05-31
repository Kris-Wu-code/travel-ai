export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      scenes: {
        Row: {
          id: string
          name: string
          scene_type: string
          city: string | null
          description: string | null
          center_lat: number | null
          center_lng: number | null
          cover_image_url: string | null
          available_transports: string[] | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          scene_type?: string
          city?: string | null
          description?: string | null
          center_lat?: number | null
          center_lng?: number | null
          cover_image_url?: string | null
          available_transports?: string[] | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          scene_type?: string
          city?: string | null
          description?: string | null
          center_lat?: number | null
          center_lng?: number | null
          cover_image_url?: string | null
          available_transports?: string[] | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      poi_items: {
        Row: {
          id: string
          name: string
          category: string | null
          scene_type: string | null
          scene_id: string | null
          city: string | null
          address: string | null
          latitude: number | null
          longitude: number | null
          price_level: number | null
          tags: string[] | null
          source: string | null
          source_id: string | null
          status: string
          avg_rating: number | null
          review_count: number | null
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          scene_type?: string | null
          scene_id?: string | null
          city?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          price_level?: number | null
          tags?: string[] | null
          source?: string | null
          source_id?: string | null
          status?: string
          avg_rating?: number | null
          review_count?: number | null
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          scene_type?: string | null
          scene_id?: string | null
          city?: string | null
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          price_level?: number | null
          tags?: string[] | null
          source?: string | null
          source_id?: string | null
          status?: string
          avg_rating?: number | null
          review_count?: number | null
        }
        Relationships: [
          { foreignKeyName: "poi_items_scene_id_fkey"; columns: ["scene_id"]; referencedRelation: "scenes"; referencedColumns: ["id"] },
        ]
      }
      scene_pois: {
        Row: {
          id: string
          scene_id: string
          name: string
          poi_type: string
          floor: number | null
          latitude: number
          longitude: number
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          name: string
          poi_type: string
          floor?: number | null
          latitude: number
          longitude: number
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          name?: string
          poi_type?: string
          floor?: number | null
          latitude?: number
          longitude?: number
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "scene_pois_scene_id_fkey"; columns: ["scene_id"]; referencedRelation: "scenes"; referencedColumns: ["id"] },
        ]
      }
      scene_routes: {
        Row: {
          id: string
          scene_id: string
          start_poi_id: string
          end_poi_id: string
          distance_meters: number
          ideal_time_seconds: number
          transport_type: string
          is_bidirectional: boolean
          floor: number | null
          requires_elevator: boolean
          requires_stairs: boolean
          congestion_factor: number
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          start_poi_id: string
          end_poi_id: string
          distance_meters: number
          ideal_time_seconds: number
          transport_type?: string
          is_bidirectional?: boolean
          floor?: number | null
          requires_elevator?: boolean
          requires_stairs?: boolean
          congestion_factor?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          start_poi_id?: string
          end_poi_id?: string
          distance_meters?: number
          ideal_time_seconds?: number
          transport_type?: string
          is_bidirectional?: boolean
          floor?: number | null
          requires_elevator?: boolean
          requires_stairs?: boolean
          congestion_factor?: number
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "scene_routes_scene_id_fkey"; columns: ["scene_id"]; referencedRelation: "scenes"; referencedColumns: ["id"] },
          { foreignKeyName: "scene_routes_start_poi_id_fkey"; columns: ["start_poi_id"]; referencedRelation: "scene_pois"; referencedColumns: ["id"] },
          { foreignKeyName: "scene_routes_end_poi_id_fkey"; columns: ["end_poi_id"]; referencedRelation: "scene_pois"; referencedColumns: ["id"] },
        ]
      }
      scene_floors: {
        Row: {
          id: string
          scene_id: string
          floor: number
          floor_name: string | null
          map_image_url: string | null
          map_width_px: number | null
          map_height_px: number | null
          scale_meters_per_px: number | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          scene_id: string
          floor: number
          floor_name?: string | null
          map_image_url?: string | null
          map_width_px?: number | null
          map_height_px?: number | null
          scale_meters_per_px?: number | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          scene_id?: string
          floor?: number
          floor_name?: string | null
          map_image_url?: string | null
          map_width_px?: number | null
          map_height_px?: number | null
          scale_meters_per_px?: number | null
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "scene_floors_scene_id_fkey"; columns: ["scene_id"]; referencedRelation: "scenes"; referencedColumns: ["id"] },
        ]
      }
      food_items: {
        Row: {
          id: string
          name: string
          scene_id: string | null
          cuisine_type: string | null
          canteen_name: string | null
          window_name: string | null
          price_range: string | null
          avg_rating: number | null
          hot_score: number | null
          status: string
        }
        Insert: {
          id?: string
          name: string
          scene_id?: string | null
          cuisine_type?: string | null
          canteen_name?: string | null
          window_name?: string | null
          price_range?: string | null
          avg_rating?: number | null
          hot_score?: number | null
          status?: string
        }
        Update: {
          id?: string
          name?: string
          scene_id?: string | null
          cuisine_type?: string | null
          canteen_name?: string | null
          window_name?: string | null
          price_range?: string | null
          avg_rating?: number | null
          hot_score?: number | null
          status?: string
        }
        Relationships: [
          { foreignKeyName: "food_items_scene_id_fkey"; columns: ["scene_id"]; referencedRelation: "scenes"; referencedColumns: ["id"] },
        ]
      }
      diaries: {
        Row: {
          id: string
          user_id: string
          scene_id: string | null
          title: string
          location_tag: string | null
          content_raw: string | null
          content_compressed: string | null
          compressed_size: number | null
          raw_size: number | null
          compression_algo: string | null
          huffman_layout: Json | null
          huffman_code_map: Json | null
          view_count: number
          score: number | null
          hot_score: number
          status: 'draft' | 'published' | 'archived'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          scene_id?: string | null
          title: string
          location_tag?: string | null
          content_raw?: string | null
          content_compressed?: string | null
          compressed_size?: number | null
          raw_size?: number | null
          compression_algo?: string | null
          huffman_layout?: Json | null
          huffman_code_map?: Json | null
          view_count?: number
          score?: number | null
          hot_score?: number
          status?: 'draft' | 'published' | 'archived'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          scene_id?: string | null
          title?: string
          location_tag?: string | null
          content_raw?: string | null
          content_compressed?: string | null
          compressed_size?: number | null
          raw_size?: number | null
          compression_algo?: string | null
          huffman_layout?: Json | null
          huffman_code_map?: Json | null
          view_count?: number
          score?: number | null
          hot_score?: number
          status?: 'draft' | 'published' | 'archived'
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "diaries_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "diaries_scene_id_fkey"; columns: ["scene_id"]; referencedRelation: "scenes"; referencedColumns: ["id"] },
        ]
      }
      diary_reviews: {
        Row: {
          id: string
          diary_id: string
          user_id: string
          rating: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          diary_id: string
          user_id: string
          rating: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          diary_id?: string
          user_id?: string
          rating?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "diary_reviews_diary_id_fkey"; columns: ["diary_id"]; referencedRelation: "diaries"; referencedColumns: ["id"] },
          { foreignKeyName: "diary_reviews_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: {
          user_id: string
          display_name: string | null
          questionnaire_done: boolean | null
          travel_style: string[] | null
          budget_level: number | null
          group_type: string | null
          preferences: {
            taboos?: string[]
            travel_pace?: string
            profile_avatar_url?: string
            profile_intro?: string
          } | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          display_name?: string | null
          questionnaire_done?: boolean | null
          travel_style?: string[] | null
          budget_level?: number | null
          group_type?: string | null
          preferences?: {
            taboos?: string[]
            travel_pace?: string
            profile_avatar_url?: string
            profile_intro?: string
          } | null
          updated_at?: string | null
        }
        Update: {
          user_id?: string
          display_name?: string | null
          questionnaire_done?: boolean | null
          travel_style?: string[] | null
          budget_level?: number | null
          group_type?: string | null
          preferences?: {
            taboos?: string[]
            travel_pace?: string
            profile_avatar_url?: string
            profile_intro?: string
          } | null
          updated_at?: string | null
        }
        Relationships: [
          { foreignKeyName: "profiles_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      bookmarks: {
        Row: {
          id: string
          user_id: string
          scene_id: string | null
          scene_name: string | null
          city: string | null
          target_type: 'diary' | 'scene' | 'wishlist'
          target_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          scene_id?: string | null
          scene_name?: string | null
          city?: string | null
          target_type: 'diary' | 'scene' | 'wishlist'
          target_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          scene_id?: string | null
          scene_name?: string | null
          city?: string | null
          target_type?: 'diary' | 'scene' | 'wishlist'
          target_id?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "bookmarks_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ]
      }
      sync_jobs: {
        Row: {
          id: string
          job_name: string
          status: 'success' | 'failed'
          started_at: string
          finished_at: string
          duration_ms: number
          scenes_count: number
          search_plan_count: number
          amap_request_count: number
          amap_rate_limited_count: number
          amap_failed_count: number
          poi_written_count: number
          poi_failed_count: number
          food_written_count: number
          food_failed_count: number
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_name: string
          status: 'success' | 'failed'
          started_at: string
          finished_at: string
          duration_ms?: number
          scenes_count?: number
          search_plan_count?: number
          amap_request_count?: number
          amap_rate_limited_count?: number
          amap_failed_count?: number
          poi_written_count?: number
          poi_failed_count?: number
          food_written_count?: number
          food_failed_count?: number
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_name?: string
          status?: 'success' | 'failed'
          started_at?: string
          finished_at?: string
          duration_ms?: number
          scenes_count?: number
          search_plan_count?: number
          amap_request_count?: number
          amap_rate_limited_count?: number
          amap_failed_count?: number
          poi_written_count?: number
          poi_failed_count?: number
          food_written_count?: number
          food_failed_count?: number
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      scene_visit_logs: {
        Row: {
          id: string
          user_id: string
          scene_id: string
          first_visited_at: string
          last_visited_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          scene_id: string
          first_visited_at?: string
          last_visited_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          scene_id?: string
          first_visited_at?: string
          last_visited_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "scene_visit_logs_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "scene_visit_logs_scene_id_fkey"; columns: ["scene_id"]; referencedRelation: "scenes"; referencedColumns: ["id"] },
        ]
      }
      search_events: {
        Row: {
          id: string
          keyword: string
          source: string
          has_suggestion_match: boolean
          created_at: string
        }
        Insert: {
          id?: string
          keyword: string
          source: string
          has_suggestion_match?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          keyword?: string
          source?: string
          has_suggestion_match?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
