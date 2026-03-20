export type NotificationListItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  ref_type: string | null;
  ref_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type MarkNotificationReadResult = {
  marked: boolean;
  message: string | null;
};

export type MarkAllNotificationsReadResult = {
  markedCount: number;
  message: string | null;
};
