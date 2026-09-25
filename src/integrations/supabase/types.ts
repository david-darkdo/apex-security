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
      ai_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          dependency_chain_id: string | null
          error_log: Json | null
          execution_time_ms: number | null
          id: string
          job_dependency: Database["public"]["Enums"]["ai_job_type"] | null
          job_type: Database["public"]["Enums"]["ai_job_type"]
          parent_job_id: string | null
          payload: Json | null
          product_id: string
          result: Json | null
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["ai_job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dependency_chain_id?: string | null
          error_log?: Json | null
          execution_time_ms?: number | null
          id?: string
          job_dependency?: Database["public"]["Enums"]["ai_job_type"] | null
          job_type: Database["public"]["Enums"]["ai_job_type"]
          parent_job_id?: string | null
          payload?: Json | null
          product_id: string
          result?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          dependency_chain_id?: string | null
          error_log?: Json | null
          execution_time_ms?: number | null
          id?: string
          job_dependency?: Database["public"]["Enums"]["ai_job_type"] | null
          job_type?: Database["public"]["Enums"]["ai_job_type"]
          parent_job_id?: string | null
          payload?: Json | null
          product_id?: string
          result?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
          updated_at?: string
        }
        Relationships: [
          {\n            foreignKeyName: "ai_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_templates: {
        Row: {
          brand_override: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description_prompt: string | null
          faq_prompt: string | null
          id: string
          installation_context_id: string | null
          installed_prompt: string | null
          is_active: boolean | null
          key: string | null
          name: string | null
          priority: number | null
          product_type_id: string | null
          prompt_text: string | null
          purpose: string | null
          seo_prompt: string | null
          studio_prompt: string | null
          subcategory_id: string | null
          understanding_prompt: string | null
          updated_at: string | null
          updated_by: string | null
          version: number | null
        }
        Insert: {
          brand_override?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_prompt?: string | null
          faq_prompt?: string | null
          id?: string
          installation_context_id?: string | null
          installed_prompt?: string | null
          is_active?: boolean | null
          key?: string | null
          name?: string | null
          priority?: number | null
          product_type_id?: string | null
          prompt_text?: string | null
          purpose?: string | null
          seo_prompt?: string | null
          studio_prompt?: string | null
          subcategory_id?: string | null
          understanding_prompt?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          brand_override?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_prompt?: string | null
          faq_prompt?: string | null
          id?: string
          installation_context_id?: string | null
          installed_prompt?: string | null
          is_active?: boolean | null
          key?: string | null
          name?: string | null
          priority?: number | null
          product_type_id?: string | null
          prompt_text?: string | null
          purpose?: string | null
          seo_prompt?: string | null
          studio_prompt?: string | null
          subcategory_id?: string | null
          understanding_prompt?: string | null
          updated_at?: string | null
          updated_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_templates_installation_context_id_fkey"
            columns: ["installation_context_id"]
            isOneToOne: false
            referencedRelation: "installation_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_templates_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_templates_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          active_ai_provider: string | null
          bing_site_verification: string | null
          company_address: string | null
          company_email: string | null
          created_at: string
          facebook_url: string | null
          gemini_image_model: string | null
          gemini_llm_model: string | null
          gemini_use_vertex: boolean | null
          google_site_verification: string | null
          id: string
          instagram_url: string | null
          last_provider_call_success: boolean | null
          last_provider_error: string | null
          map_url: string | null
          openai_image_model: string | null
          openai_image_size: string | null
          openai_llm_model: string | null
          sales_whatsapp: string | null
          support_whatsapp: string | null
          tiktok_url: string | null
          updated_at: string
        }
        Insert: {
          active_ai_provider?: string | null
          bing_site_verification?: string | null
          company_address?: string | null
          company_email?: string | null
          created_at?: string
          facebook_url?: string | null
          gemini_image_model?: string | null
          gemini_llm_model?: string | null
          gemini_use_vertex?: boolean | null
          google_site_verification?: string | null
          id?: string
          instagram_url?: string | null
          last_provider_call_success?: boolean | null
          last_provider_error?: string | null
          map_url?: string | null
          openai_image_model?: string | null
          openai_image_size?: string | null
          openai_llm_model?: string | null
          sales_whatsapp?: string | null
          support_whatsapp?: string | null
          tiktok_url?: string | null
          updated_at?: string
        }
        Update: {
          active_ai_provider?: string | null
          bing_site_verification?: string | null
          company_address?: string | null
          company_email?: string | null
          created_at?: string
          facebook_url?: string | null
          gemini_image_model?: string | null
          gemini_llm_model?: string | null
          gemini_use_vertex?: boolean | null
          google_site_verification?: string | null
          id?: string
          instagram_url?: string | null
          last_provider_call_success?: boolean | null
          last_provider_error?: string | null
          map_url?: string | null
          openai_image_model?: string | null
          openai_image_size?: string | null
          openai_llm_model?: string | null
          sales_whatsapp?: string | null
          support_whatsapp?: string | null
          tiktok_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
          slug: string
          sort_order: number
          type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          slug: string
          sort_order?: number
          type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          slug?: string
          sort_order?: number
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          code_prefix: string
          created_at: string
          id: string
          installation_context_id: string
          is_archived: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          code_prefix: string
          created_at?: string
          id?: string
          installation_context_id: string
          is_archived?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          code_prefix?: string
          created_at?: string
          id?: string
          installation_context_id?: string
          is_archived?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_types_installation_context_id_fkey"
            columns: ["installation_context_id"]
            isOneToOne: false
            referencedRelation: "installation_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          custom_ai_prompt_override: string | null
          id: string
          is_archived: boolean
          name: string
          slug: string
          sort_order: number
          subcategory_id: string
        }
        Insert: {
          created_at?: string
          custom_ai_prompt_override?: string | null
          id?: string
          is_archived?: boolean
          name: string
          slug: string
          sort_order?: number
          subcategory_id: string
        }
        Update: {
          created_at?: string
          custom_ai_prompt_override?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          slug?: string
          sort_order?: number
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_groups_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          ai_status: Database["public"]["Enums"]["ai_asset_status"]
          ai_understanding: Json | null
          alt_text: string | null
          app_keywords: string[] | null
          app_search_keywords: string[] | null
          brand: string | null
          canonical_slug: string | null
          category_id: string | null
          code: string
          color: string | null
          created_at: string
          deleted_at: string | null
          differentiator_note: string | null
          differentiator_type: string | null
          error_log: Json | null
          family_id: string | null
          faq: Json | null
          featured_feed: boolean
          featured_homepage: boolean
          finish: string | null
          finish_name: string | null
          generated_description: string | null
          generated_installed_image: string | null
          generated_studio_image: string | null
          generation_hash: string | null
          generation_version: number
          hidden: boolean
          id: string
          image_caption: string | null
          image_filename: string | null
          image_mode: Database["public"]["Enums"]["product_image_mode"]
          image_title: string | null
          image_url: string | null
          installation_context_id: string | null
          installation_images: string[] | null
          is_ai_processing: boolean
          is_published: boolean
          last_processed_at: string | null
          master_document: Json | null
          material: string | null
          name: string
          original_price: number | null
          price: number
          pricing_unit: string
          processing_state: Database["public"]["Enums"]["product_processing_state"]
          product_assets: Json
          production_name: string | null
          retry_count: number
          seo_description: string | null
          seo_description_manual: boolean | null
          seo_keywords: string[] | null
          seo_keywords_manual: boolean | null
          seo_title: string | null
          seo_title_manual: boolean | null
          short_description: string | null
          similar_product_ids: string[]
          size: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          structured_data: Json | null
          subcategory_id: string | null
          type_id: string | null
          updated_at: string
        }
        Insert: {
          ai_status?: Database["public"]["Enums"]["ai_asset_status"]
          ai_understanding?: Json | null
          alt_text?: string | null
          app_keywords?: string[] | null
          app_search_keywords?: string[] | null
          brand?: string | null
          canonical_slug?: string | null
          category_id?: string | null
          code: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          differentiator_note?: string | null
          differentiator_type?: string | null
          error_log?: Json | null
          family_id?: string | null
          faq?: Json | null
          featured_feed?: boolean
          featured_homepage?: boolean
          finish?: string | null
          finish_name?: string | null
          generated_description?: string | null
          generated_installed_image?: string | null
          generated_studio_image?: string | null
          generation_hash?: string | null
          generation_version?: number
          hidden?: boolean
          id?: string
          image_caption?: string | null
          image_filename?: string | null
          image_mode?: Database["public"]["Enums"]["product_image_mode"]
          image_title?: string | null
          image_url?: string | null
          installation_context_id?: string | null
          installation_images?: string[] | null
          is_ai_processing?: boolean
          is_published?: boolean
          last_processed_at?: string | null
          master_document?: Json | null
          material?: string | null
          name: string
          original_price?: number | null
          price?: number
          pricing_unit?: string
          processing_state?: Database["public"]["Enums"]["product_processing_state"]
          product_assets?: Json
          production_name?: string | null
          retry_count?: number
          seo_description?: string | null
          seo_description_manual?: boolean | null
          seo_keywords?: string[] | null
          seo_keywords_manual?: boolean | null
          seo_title?: string | null
          seo_title_manual?: boolean | null
          short_description?: string | null
          similar_product_ids?: string[]
          size?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          structured_data?: Json | null
          subcategory_id?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_status?: Database["public"]["Enums"]["ai_asset_status"]
          ai_understanding?: Json | null
          alt_text?: string | null
          app_keywords?: string[] | null
          app_search_keywords?: string[] | null
          brand?: string | null
          canonical_slug?: string | null
          category_id?: string | null
          code?: string
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          differentiator_note?: string | null
          differentiator_type?: string | null
          error_log?: Json | null
          family_id?: string | null
          faq?: Json | null
          featured_feed?: boolean
          featured_homepage?: boolean
          finish?: string | null
          finish_name?: string | null
          generated_description?: string | null
          generated_installed_image?: string | null
          generated_studio_image?: string | null
          generation_hash?: string | null
          generation_version?: number
          hidden?: boolean
          id?: string
          image_caption?: string | null
          image_filename?: string | null
          image_mode?: Database["public"]["Enums"]["product_image_mode"]
          image_title?: string | null
          image_url?: string | null
          installation_context_id?: string | null
          installation_images?: string[] | null
          is_ai_processing?: boolean
          is_published?: boolean
          last_processed_at?: string | null
          master_document?: Json | null
          material?: string | null
          name?: string
          original_price?: number | null
          price?: number
          pricing_unit?: string
          processing_state?: Database["public"]["Enums"]["product_processing_state"]
          product_assets?: Json
          production_name?: string | null
          retry_count?: number
          seo_description?: string | null
          seo_description_manual?: boolean | null
          seo_keywords?: string[] | null
          seo_keywords_manual?: boolean | null
          seo_title?: string | null
          seo_title_manual?: boolean | null
          short_description?: string | null
          similar_product_ids?: string[]
          size?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          structured_data?: Json | null
          subcategory_id?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_installation_context_id_fkey"
            columns: ["installation_context_id"]
            isOneToOne: false
            referencedRelation: "installation_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      search_index: {
        Row: {
          combined_search_text: string | null
          created_at: string
          master_document: Json | null
          normalized_size: string | null
          product_id: string
          search_aliases: string[] | null
          search_vector: unknown | null
          updated_at: string
        }
        Insert: {
          combined_search_text?: string | null
          created_at?: string
          master_document?: Json | null
          normalized_size?: string | null
          product_id: string
          search_aliases?: string[] | null
          search_vector?: unknown | null
          updated_at?: string
        }
        Update: {
          combined_search_text?: string | null
          created_at?: string
          master_document?: Json | null
          normalized_size?: string | null
          product_id?: string
          search_aliases?: string[] | null
          search_vector?: unknown | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_index_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
      ai_asset_status: "pending" | "processing" | "completed" | "failed"
      ai_job_status: "pending" | "running" | "completed" | "failed" | "skipped"
      ai_job_type:
        | "understanding"
        | "product_details"
        | "seo"
        | "lifestyle"
        | "search"
        | "recommendation"
        | "quality"
      communication_delivery_status: "pending" | "delivered" | "failed" | "opened"
      customer_note_type: "general" | "preference" | "followup" | "issue"
      email_campaign_status: "draft" | "scheduled" | "sent" | "failed"
      inquiry_pipeline_status:
        | "new"
        | "contacted"
        | "negotiating"
        | "closed_won"
        | "closed_lost"
      product_asset_type: "original" | "studio" | "installed" | "gallery"
      product_image_mode: "ai" | "manual"
      product_processing_state:
        | "pending"
        | "processing"
        | "completed"
        | "needs_review"
        | "error"
      product_status: "draft" | "review" | "published" | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
