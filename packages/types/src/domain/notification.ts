import type { BaseEntity, EntityId } from "./common";

export type NotificationType =
  | "post_liked"
  | "comment_replied"
  | "moderation_notice"
  | "announcement"
  | "system";

export type Notification = BaseEntity & {
  userId: EntityId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actorId: EntityId | null;
  postId: EntityId | null;
};
