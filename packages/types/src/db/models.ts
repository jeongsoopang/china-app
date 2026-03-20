import type { Database } from "./database";

export type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
export type UniversityRow = Database["public"]["Tables"]["universities"]["Row"];
export type UniversityDomainRow = Database["public"]["Tables"]["university_domains"]["Row"];
export type UserFollowRow = Database["public"]["Tables"]["user_follows"]["Row"];
export type SchoolVerificationRow =
  Database["public"]["Tables"]["user_school_verifications"]["Row"];
export type SectionRow = Database["public"]["Tables"]["sections"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type PostRow = Database["public"]["Tables"]["posts"]["Row"];
export type PostImageRow = Database["public"]["Tables"]["post_images"]["Row"];
export type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type PointLedgerRow = Database["public"]["Tables"]["point_ledger"]["Row"];
export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type ModerationFlagRow = Database["public"]["Tables"]["moderation_flags"]["Row"];
export type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];

export type DbUserRole = Database["public"]["Enums"]["user_role"];
export type DbUserTier = Database["public"]["Enums"]["user_tier"];
export type DbPostVisibility = Database["public"]["Enums"]["post_visibility"];
export type DbPostStatus = Database["public"]["Enums"]["post_status"];
export type DbCommentStatus = Database["public"]["Enums"]["comment_status"];
export type DbSchoolVerificationStatus =
  Database["public"]["Enums"]["school_verification_status"];
export type DbNotificationType = Database["public"]["Enums"]["notification_type"];
export type DbPointLedgerReason = Database["public"]["Enums"]["point_ledger_reason"];
