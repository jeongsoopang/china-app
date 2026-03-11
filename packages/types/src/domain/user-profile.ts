import type { BaseEntity, EntityId } from "./common";

export type UserRole = "student" | "moderator" | "admin";
export type UserTier = "bronze" | "silver" | "gold" | "platinum";

export type UserProfile = BaseEntity & {
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  universityId: EntityId | null;
  role: UserRole;
  tier: UserTier;
  isSchoolVerified: boolean;
  points: number;
};
