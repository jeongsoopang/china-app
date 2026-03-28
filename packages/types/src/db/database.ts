export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string;
          created_at: string;
          id: number;
          image_urls: string[];
          published_at: string | null;
          published_by: string | null;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: number;
          image_urls?: string[];
          published_at?: string | null;
          published_by?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: number;
          image_urls?: string[];
          published_at?: string | null;
          published_by?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      categories: {
        Row: {
          id: number;
          section_id: number;
          university_specific: boolean;
          name_ko: string;
          slug: string;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          section_id: number;
          university_specific?: boolean;
          name_ko: string;
          slug: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          section_id?: number;
          university_specific?: boolean;
          name_ko?: string;
          slug?: string;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "categories_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id"];
          }
        ];
      };
      church_page_content: {
        Row: {
          id: number;
          title: string;
          body: string;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: number;
          title?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: number;
          title?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "church_page_content_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: number;
          is_anonymous: boolean;
          is_best_answer: boolean | null;
          like_count: number;
          parent_comment_id: number | null;
          post_id: number;
          status: Database["public"]["Enums"]["comment_status"];
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: number;
          is_anonymous?: boolean;
          is_best_answer?: boolean | null;
          like_count?: number;
          parent_comment_id?: number | null;
          post_id: number;
          status?: Database["public"]["Enums"]["comment_status"];
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: number;
          is_anonymous?: boolean;
          is_best_answer?: boolean | null;
          like_count?: number;
          parent_comment_id?: number | null;
          post_id?: number;
          status?: Database["public"]["Enums"]["comment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey";
            columns: ["parent_comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          }
        ];
      };
      moderation_flags: {
        Row: {
          created_at: string;
          flag_source: string;
          id: number;
          reason_summary: string;
          reviewed_at: string | null;
          reviewer_id: string | null;
          risk_score: number;
          status: string;
          target_id: number;
          target_type: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          flag_source: string;
          id?: number;
          reason_summary: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          risk_score: number;
          status?: string;
          target_id: number;
          target_type: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          flag_source?: string;
          id?: number;
          reason_summary?: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          risk_score?: number;
          status?: string;
          target_id?: number;
          target_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_flags_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          post_id: number | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          post_id?: number | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          post_id?: number | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      point_ledger: {
        Row: {
          amount: number;
          available_at: string;
          balance_after: number;
          created_at: string;
          id: string;
          issued_at: string;
          note: string | null;
          reason: Database["public"]["Enums"]["point_ledger_reason"];
          reference_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          available_at?: string;
          balance_after?: number;
          created_at?: string;
          id?: string;
          issued_at?: string;
          note?: string | null;
          reason: Database["public"]["Enums"]["point_ledger_reason"];
          reference_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          available_at?: string;
          balance_after?: number;
          created_at?: string;
          id?: string;
          issued_at?: string;
          note?: string | null;
          reason?: Database["public"]["Enums"]["point_ledger_reason"];
          reference_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "point_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      post_point_awards: {
        Row: {
          awarded_points: number;
          body_text_length: number;
          created_at: string;
          id: number;
          image_count: number;
          is_qualified: boolean;
          post_id: number;
          section_code: Database["public"]["Enums"]["section_code"];
          tier_at_award: Database["public"]["Enums"]["point_tier"];
          user_id: string;
        };
        Insert: {
          awarded_points: number;
          body_text_length: number;
          created_at?: string;
          id?: number;
          image_count: number;
          is_qualified: boolean;
          post_id: number;
          section_code: Database["public"]["Enums"]["section_code"];
          tier_at_award: Database["public"]["Enums"]["point_tier"];
          user_id: string;
        };
        Update: {
          awarded_points?: number;
          body_text_length?: number;
          created_at?: string;
          id?: number;
          image_count?: number;
          is_qualified?: boolean;
          post_id?: number;
          section_code?: Database["public"]["Enums"]["section_code"];
          tier_at_award?: Database["public"]["Enums"]["point_tier"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_point_awards_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_point_awards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      reports: {
        Row: {
          action_taken: string | null;
          created_at: string;
          id: number;
          reason_code: string;
          reason_text: string | null;
          reporter_id: string;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: string;
          target_id: number;
          target_type: string;
          updated_at: string;
        };
        Insert: {
          action_taken?: string | null;
          created_at?: string;
          id?: number;
          reason_code: string;
          reason_text?: string | null;
          reporter_id: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          target_id: number;
          target_type: string;
          updated_at?: string;
        };
        Update: {
          action_taken?: string | null;
          created_at?: string;
          id?: number;
          reason_code?: string;
          reason_text?: string | null;
          reporter_id?: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          target_id?: number;
          target_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      posts: {
        Row: {
          accepted_answer_comment_id: number | null;
          abstract: string | null;
          author_id: string;
          body: string;
          category_id: string | null;
          comment_count: number;
          created_at: string;
          degree: string | null;
          id: number;
          is_anonymous: boolean;
          last_activity_at: string;
          like_count: number;
          section_id: string;
          status: Database["public"]["Enums"]["post_status"];
          tags: string[];
          thumbnail_image_url: string | null;
          thumbnail_storage_path: string | null;
          title: string;
          university_id: string;
          updated_at: string;
          view_count: number;
          visibility: Database["public"]["Enums"]["post_visibility"];
        };
        Insert: {
          accepted_answer_comment_id?: number | null;
          abstract?: string | null;
          author_id: string;
          body: string;
          category_id?: string | null;
          comment_count?: number;
          created_at?: string;
          degree?: string | null;
          id?: number;
          is_anonymous?: boolean;
          last_activity_at?: string;
          like_count?: number;
          section_id: string;
          status?: Database["public"]["Enums"]["post_status"];
          tags?: string[];
          thumbnail_image_url?: string | null;
          thumbnail_storage_path?: string | null;
          title: string;
          university_id: string;
          updated_at?: string;
          view_count?: number;
          visibility?: Database["public"]["Enums"]["post_visibility"];
        };
        Update: {
          accepted_answer_comment_id?: number | null;
          abstract?: string | null;
          author_id?: string;
          body?: string;
          category_id?: string | null;
          comment_count?: number;
          created_at?: string;
          degree?: string | null;
          id?: number;
          is_anonymous?: boolean;
          last_activity_at?: string;
          like_count?: number;
          section_id?: string;
          status?: Database["public"]["Enums"]["post_status"];
          tags?: string[];
          thumbnail_image_url?: string | null;
          thumbnail_storage_path?: string | null;
          title?: string;
          university_id?: string;
          updated_at?: string;
          view_count?: number;
          visibility?: Database["public"]["Enums"]["post_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "sections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          }
        ];
      };
      post_images: {
        Row: {
          created_at: string;
          id: number;
          image_url: string;
          post_id: number;
          sort_order: number;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          image_url: string;
          post_id: number;
          sort_order?: number;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          image_url?: string;
          post_id?: number;
          sort_order?: number;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          }
        ];
      };
      user_school_verifications: {
        Row: {
          code_expires_at: string | null;
          code_requested_at: string | null;
          created_at: string;
          id: number;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          school_email: string;
          status: Database["public"]["Enums"]["school_verification_status"];
          university_id: string | null;
          updated_at: string;
          user_id: string;
          verification_code_hash: string | null;
          verified_at: string | null;
        };
        Insert: {
          code_expires_at?: string | null;
          code_requested_at?: string | null;
          created_at?: string;
          id?: number;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          school_email: string;
          status?: Database["public"]["Enums"]["school_verification_status"];
          university_id?: string | null;
          updated_at?: string;
          user_id: string;
          verification_code_hash?: string | null;
          verified_at?: string | null;
        };
        Update: {
          code_expires_at?: string | null;
          code_requested_at?: string | null;
          created_at?: string;
          id?: number;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          school_email?: string;
          status?: Database["public"]["Enums"]["school_verification_status"];
          university_id?: string | null;
          updated_at?: string;
          user_id?: string;
          verification_code_hash?: string | null;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_school_verifications_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_school_verifications_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_school_verifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      sections: {
        Row: {
          id: number;
          code: Database["public"]["Enums"]["section_code"];
          name_ko: string;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          code: Database["public"]["Enums"]["section_code"];
          name_ko: string;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          code?: Database["public"]["Enums"]["section_code"];
          name_ko?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      universities: {
        Row: {
          city: string;
          country_code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          short_name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          city?: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          short_name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          city?: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          short_name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      university_domains: {
        Row: {
          created_at: string;
          domain: string;
          id: string;
          is_active: boolean;
          is_primary: boolean;
          university_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          domain: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          university_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          domain?: string;
          id?: string;
          is_active?: boolean;
          is_primary?: boolean;
          university_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "university_domains_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          }
        ];
      };
      user_profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_school_verified: boolean;
          point_tier: Database["public"]["Enums"]["point_tier"] | null;
          points: number;
          role: Database["public"]["Enums"]["user_role"];
          tier: Database["public"]["Enums"]["user_tier"];
          university_id: string | null;
          updated_at: string;
          verified_school_email: string | null;
          verified_university_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          is_school_verified?: boolean;
          point_tier?: Database["public"]["Enums"]["point_tier"] | null;
          points?: number;
          role?: Database["public"]["Enums"]["user_role"];
          tier?: Database["public"]["Enums"]["user_tier"];
          university_id?: string | null;
          updated_at?: string;
          verified_school_email?: string | null;
          verified_university_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_school_verified?: boolean;
          point_tier?: Database["public"]["Enums"]["point_tier"] | null;
          points?: number;
          role?: Database["public"]["Enums"]["user_role"];
          tier?: Database["public"]["Enums"]["user_tier"];
          university_id?: string | null;
          updated_at?: string;
          verified_school_email?: string | null;
          verified_university_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_university_id_fkey";
            columns: ["university_id"];
            isOneToOne: false;
            referencedRelation: "universities";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      attach_post_images: {
        Args: {
          p_image_urls: string[];
          p_post_id: number;
          p_storage_paths: string[];
        };
        Returns:
          | string
          | {
              attached_count?: number | null;
              message?: string | null;
            }
          | {
              attached_count?: number | null;
              message?: string | null;
            }[];
      };
      award_post_points: {
        Args: {
          p_post_id: number;
        };
        Returns: {
          awarded: boolean;
          awarded_points: number;
          body_text_length: number;
          image_count: number;
          is_qualified: boolean;
          message: string;
          next_point_tier: string | null;
          tier_at_award: string | null;
          total_points: number;
        }[];
      };
      accept_best_answer: {
        Args: {
          p_comment_id: number;
          p_post_id: number;
        };
        Returns:
          | string
          | {
              message?: string | null;
              success?: boolean | null;
            }
          | {
              message?: string | null;
              success?: boolean | null;
            }[];
      };
      create_post: {
        Args: {
          p_body: string;
          p_category_slug: string;
          p_location_text?: string | null;
          p_section_code: string;
          p_tags?: string[];
          p_title: string;
          p_university_slug?: string | null;
        };
        Returns:
          | string
          | {
              created_at?: string | null;
              id?: string | null;
              message?: string | null;
              post_id?: string | null;
            }
          | {
              created_at?: string | null;
              id?: string | null;
              message?: string | null;
              post_id?: string | null;
            }[];
      };
      create_comment: {
        Args: {
          p_body: string;
          p_parent_comment_id?: number | null;
          p_post_id: number;
        };
        Returns:
          | string
          | {
              comment_id?: number | null;
              id?: number | null;
              message?: string | null;
            }
          | {
              comment_id?: number | null;
              id?: number | null;
              message?: string | null;
            }[];
      };
      create_moderation_flag: {
        Args: {
          p_flag_source: string;
          p_reason_summary: string;
          p_risk_score: number;
          p_target_id: number;
          p_target_type: string;
        };
        Returns:
          | string
          | {
              flag_id?: number | null;
              message?: string | null;
            }
          | {
              flag_id?: number | null;
              message?: string | null;
            }[];
      };
      create_report: {
        Args: {
          p_reason_code: string;
          p_reason_text?: string | null;
          p_target_id: number;
          p_target_type: string;
        };
        Returns:
          | string
          | {
              message?: string | null;
              report_id?: number | null;
            }
          | {
              message?: string | null;
              report_id?: number | null;
            }[];
      };
      process_pending_points: {
        Args: Record<string, never>;
        Returns: {
          affected_users: number;
          processed_rows: number;
        }[];
      };
      publish_announcement: {
        Args: {
          p_announcement_id: number;
        };
        Returns:
          | string
          | {
              message?: string | null;
              published?: boolean | null;
            }
          | {
              message?: string | null;
              published?: boolean | null;
            }[];
      };
      reverse_post_reward: {
        Args: {
          p_post_id: number;
        };
        Returns: {
          cancelled_pending_rows: number;
          deducted_points: number;
          reversed_confirmed_rows: number;
        }[];
      };
      review_moderation_flag: {
        Args: {
          p_flag_id: number;
          p_next_status: string;
        };
        Returns:
          | string
          | {
              message?: string | null;
              success?: boolean | null;
            }
          | {
              message?: string | null;
              success?: boolean | null;
            }[];
      };
      review_report: {
        Args: {
          p_action?: string;
          p_next_status: string;
          p_report_id: number;
        };
        Returns:
          | string
          | {
              message?: string | null;
              success?: boolean | null;
            }
          | {
              message?: string | null;
              success?: boolean | null;
            }[];
      };
      toggle_comment_like: {
        Args: {
          p_comment_id: number;
        };
        Returns: {
          like_count: number;
          liked: boolean;
        }[];
      };
      toggle_post_like: {
        Args: {
          p_post_id: number;
        };
        Returns: {
          like_count: number;
          liked: boolean;
        }[];
      };
      increment_post_view_count: {
        Args: {
          p_post_id: number;
        };
        Returns: number;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns:
          | string
          | {
              marked_count?: number | null;
              message?: string | null;
            }
          | {
              marked_count?: number | null;
              message?: string | null;
            }[];
      };
      mark_notification_read: {
        Args: {
          p_notification_id: number | string;
        };
        Returns:
          | string
          | {
              marked?: boolean | null;
              message?: string | null;
            }
          | {
              marked?: boolean | null;
              message?: string | null;
            }[];
      };
      confirm_school_verification: {
        Args: {
          p_code: string;
          p_verification_id: number;
        };
        Returns: {
          message: string | null;
          status: Database["public"]["Enums"]["school_verification_status"] | null;
          success: boolean;
        }[];
      };
      request_school_verification: {
        Args: {
          p_school_email: string;
        };
        Returns: {
          code_expires_at: string | null;
          debug_code: string | null;
          school_email: string;
          university_id: string | null;
          university_name: string | null;
          university_short_name: string | null;
          verification_id: number;
        }[];
      };
    };
    Enums: {
      comment_status: "active" | "hidden" | "removed";
      notification_type:
        | "post_liked"
        | "comment_replied"
        | "moderation_notice"
        | "announcement"
        | "system";
      point_ledger_reason:
        | "post_created"
        | "comment_created"
        | "verification_approved"
        | "moderation_penalty"
        | "manual_adjustment";
      point_tier: "bronze" | "silver" | "gold" | "emerald" | "diamond";
      post_status: "active" | "hidden" | "removed";
      post_visibility: "public" | "university_only";
      school_verification_status:
        | "code_requested"
        | "pending_review"
        | "verified"
        | "rejected"
        | "expired";
      section_code: "life" | "study" | "qa" | "fun" | "vlog";
      user_role:
        | "bronze"
        | "silver"
        | "gold"
        | "emerald"
        | "diamond"
        | "platinum"
        | "master"
        | "grandmaster"
        | "church_master"
        | "campus_master"
        | "student"
        | "moderator"
        | "admin";
      user_tier:
        | "bronze"
        | "silver"
        | "gold"
        | "emerald"
        | "diamond"
        | "platinum"
        | "master"
        | "grandmaster"
        | "church_master"
        | "campus_master";
    };
    CompositeTypes: Record<string, never>;
  };
};
