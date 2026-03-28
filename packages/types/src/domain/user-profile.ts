import type { BaseEntity, EntityId } from "./common";

export type UserRole =
  | "student"
  | "moderator"
  | "admin"
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
export type UserTier =
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
