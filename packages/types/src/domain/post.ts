import type { BaseEntity, EntityId, Timestamp } from "./common";

export type PostVisibility = "public" | "university_only";
export type PostStatus = "active" | "hidden" | "removed";

export type Post = BaseEntity & {
  authorId: EntityId;
  universityId: EntityId;
  sectionId: EntityId;
  categoryId: EntityId | null;
  title: string;
  body: string;
  tags: string[];
  visibility: PostVisibility;
  status: PostStatus;
  isAnonymous: boolean;
  commentCount: number;
  likeCount: number;
  lastActivityAt: Timestamp;
};
