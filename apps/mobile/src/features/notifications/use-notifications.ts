import { useCallback, useEffect, useMemo, useState } from "react";
import { getMobileCurrentUser } from "../auth/current-user";
import {
  fetchNotifications,
  mapNotificationsError,
  markAllNotificationsRead,
  markNotificationRead
} from "./notifications.service";
import type { NotificationListItem } from "./notifications.types";

type NotificationsAction = "loading" | "ready" | "marking_one" | "marking_all";

type NotificationsState = {
  action: NotificationsAction;
  notifications: NotificationListItem[];
  isSignedIn: boolean;
  processingNotificationId: string | null;
  infoMessage: string | null;
  errorMessage: string | null;
};

const INITIAL_STATE: NotificationsState = {
  action: "loading",
  notifications: [],
  isSignedIn: false,
  processingNotificationId: null,
  infoMessage: null,
  errorMessage: null
};

function markOneAsRead(
  notifications: NotificationListItem[],
  notificationId: string
): NotificationListItem[] {
  return notifications.map((notification) =>
    notification.id === notificationId ? { ...notification, is_read: true } : notification
  );
}

function markAllAsRead(notifications: NotificationListItem[]): NotificationListItem[] {
  return notifications.map((notification) =>
    notification.is_read ? notification : { ...notification, is_read: true }
  );
}

export function useNotifications() {
  const [state, setState] = useState<NotificationsState>(INITIAL_STATE);

  const loadNotifications = useCallback(async () => {
    setState((current) => ({
      ...current,
      action: "loading",
      errorMessage: null,
      infoMessage: null,
      processingNotificationId: null
    }));

    try {
      const currentUser = await getMobileCurrentUser();

      if (!currentUser) {
        setState((current) => ({
          ...current,
          action: "ready",
          notifications: [],
          isSignedIn: false,
          processingNotificationId: null
        }));
        return;
      }

      const notifications = await fetchNotifications();

      setState((current) => ({
        ...current,
        action: "ready",
        notifications,
        isSignedIn: true,
        processingNotificationId: null,
        errorMessage: null
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "ready",
        errorMessage: mapNotificationsError(error),
        processingNotificationId: null
      }));
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const isLoading = state.action === "loading";
  const isMarkingOne = state.action === "marking_one";
  const isMarkingAll = state.action === "marking_all";
  const unreadCount = useMemo(
    () => state.notifications.filter((notification) => !notification.is_read).length,
    [state.notifications]
  );
  const canMarkAllAsRead =
    state.isSignedIn && unreadCount > 0 && !isLoading && !isMarkingOne && !isMarkingAll;

  async function onPressNotification(notification: NotificationListItem): Promise<boolean> {
    if (!state.isSignedIn || isLoading || isMarkingOne || isMarkingAll) {
      return false;
    }

    if (notification.is_read) {
      return true;
    }

    setState((current) => ({
      ...current,
      action: "marking_one",
      processingNotificationId: notification.id,
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await markNotificationRead(notification.id);

      setState((current) => ({
        ...current,
        action: "ready",
        processingNotificationId: null,
        notifications: result.marked
          ? markOneAsRead(current.notifications, notification.id)
          : current.notifications,
        infoMessage: result.message
      }));

      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "ready",
        processingNotificationId: null,
        errorMessage: mapNotificationsError(error)
      }));

      return false;
    }
  }

  async function onMarkAllAsRead() {
    if (!canMarkAllAsRead) {
      return;
    }

    setState((current) => ({
      ...current,
      action: "marking_all",
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await markAllNotificationsRead();

      setState((current) => {
        const fallbackMarkedCount = current.notifications.filter(
          (item) => !item.is_read
        ).length;
        const markedCount =
          result.markedCount > 0 ? result.markedCount : fallbackMarkedCount;

        return {
          ...current,
          action: "ready",
          notifications: markAllAsRead(current.notifications),
          infoMessage:
            result.message ??
            (markedCount > 0 ? `Marked ${markedCount} notification(s) as read.` : null),
          errorMessage: null
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "ready",
        errorMessage: mapNotificationsError(error)
      }));
    }
  }

  return {
    state,
    isLoading,
    isMarkingOne,
    isMarkingAll,
    unreadCount,
    canMarkAllAsRead,
    onPressNotification,
    onMarkAllAsRead,
    refresh: loadNotifications
  };
}
