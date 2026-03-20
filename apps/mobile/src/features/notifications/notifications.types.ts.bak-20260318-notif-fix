import type { NotificationRow } from "@foryou/types";

export type NotificationListItem = Pick<
  NotificationRow,
  "id" | "title" | "message" | "type" | "post_id" | "is_read" | "created_at"
>;

export type MarkNotificationReadResult = {
  marked: boolean;
  message: string | null;
};

export type MarkAllNotificationsReadResult = {
  markedCount: number;
  message: string | null;
};
