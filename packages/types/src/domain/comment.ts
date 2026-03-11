import type { BaseEntity, EntityId } from "./common";

export type CommentStatus = "active" | "hidden" | "removed";

export type Comment = BaseEntity & {
  postId: EntityId;
  authorId: EntityId;
  parentCommentId: EntityId | null;
  body: string;
  isAnonymous: boolean;
  status: CommentStatus;
  likeCount: number;
};
