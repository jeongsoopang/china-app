import type { Database } from "@foryou/types";
import { supabase } from "../../lib/supabase/client";
import type {
  MarkAllNotificationsReadResult,
  MarkNotificationReadResult,
  NotificationListItem
} from "./notifications.types";

type MarkNotificationReadRpcReturn =
  Database["public"]["Functions"]["mark_notification_read"]["Returns"];
type MarkAllNotificationsReadRpcReturn =
  Database["public"]["Functions"]["mark_all_notifications_read"]["Returns"];

type RawNotificationRow = {
  id: string | number;
  title: string | null;
  body: string | null;
  type: string | null;
  ref_type: string | null;
  ref_id: string | number | null;
  is_read: boolean | null;
  created_at: string | null;
};

type RawAnnouncementRow = {
  id: number;
  title: string | null;
  outline: string | null;
  body: string | null;
  image_urls?: string[] | null;
  is_home_popup?: boolean | null;
  published_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
  is_published: boolean | null;
};

export type AnnouncementDetail = {
  id: string;
  title: string;
  outline: string;
  body: string;
  image_urls: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  is_home_popup: boolean;
};

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return fallback;
}

function parseMarkNotificationReadResult(
  data: MarkNotificationReadRpcReturn
): MarkNotificationReadResult {
  if (typeof data === "string") {
    return {
      marked: true,
      message: data
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      marked: true,
      message: null
    };
  }

  return {
    marked: typeof row.marked === "boolean" ? row.marked : true,
    message: typeof row.message === "string" ? row.message : null
  };
}

function parseMarkAllNotificationsReadResult(
  data: MarkAllNotificationsReadRpcReturn
): MarkAllNotificationsReadResult {
  if (typeof data === "string") {
    return {
      markedCount: 0,
      message: data
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      markedCount: 0,
      message: null
    };
  }

  return {
    markedCount: normalizeNumber(row.marked_count, 0),
    message: typeof row.message === "string" ? row.message : null
  };
}

function mapNotificationRow(row: RawNotificationRow): NotificationListItem {
  return {
    id: String(row.id),
    title: row.title ?? "",
    body: row.body ?? "",
    type: row.type ?? "notification",
    ref_type: row.ref_type ?? null,
    ref_id: row.ref_id === null || row.ref_id === undefined ? null : String(row.ref_id),
    is_read: Boolean(row.is_read),
    created_at: row.created_at ?? ""
  };
}

function mapAnnouncementRow(row: RawAnnouncementRow): AnnouncementDetail {
  return {
    id: String(row.id),
    title: row.title ?? "",
    outline: row.outline ?? "",
    body: row.body ?? "",
    image_urls: Array.isArray(row.image_urls)
      ? row.image_urls.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [],
    published_at: row.published_at,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? null,
    is_home_popup: Boolean(row.is_home_popup)
  };
}

export async function fetchNotifications(limit = 50): Promise<NotificationListItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, type, ref_type, ref_id, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as RawNotificationRow[];
  return rows.map(mapNotificationRow);
}

export async function fetchAnnouncementDetailById(
  announcementId: string
): Promise<AnnouncementDetail> {
  const numericId = normalizeNumber(announcementId, 0);

  if (numericId <= 0) {
    throw new Error("Invalid announcement id.");
  }

  const announcementsClient = (supabase as unknown as {
    from: (table: string) => any;
  }).from("announcements");

  const { data, error } = await announcementsClient
    .select(
      "id, title, outline, body, image_urls, is_home_popup, published_at, created_at, updated_at, is_published"
    )
    .eq("id", numericId)
    .eq("is_published", true)
    .single();

  if (error) {
    throw error;
  }

  return mapAnnouncementRow(data as unknown as RawAnnouncementRow);
}

export async function fetchLatestHomePopupAnnouncement(): Promise<AnnouncementDetail | null> {
  const announcementsClient = (supabase as unknown as {
    from: (table: string) => any;
  }).from("announcements");

  const { data, error } = await announcementsClient
    .select(
      "id, title, outline, body, image_urls, is_home_popup, published_at, created_at, updated_at, is_published"
    )
    .eq("is_published", true)
    .eq("is_home_popup", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapAnnouncementRow(data as unknown as RawAnnouncementRow);
}

export async function markNotificationRead(
  notificationId: string
): Promise<MarkNotificationReadResult> {
  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId
  });

  if (error) {
    throw error;
  }

  return parseMarkNotificationReadResult(data);
}

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResult> {
  const { data, error } = await supabase.rpc("mark_all_notifications_read");

  if (error) {
    throw error;
  }

  return parseMarkAllNotificationsReadResult(data);
}

export function mapNotificationsError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : null;

  if (!message) {
    return "Unable to complete notification request right now.";
  }

  if (message.toLowerCase().includes("permission")) {
    return "You do not have permission to read or update these notifications.";
  }

  return message;
}
