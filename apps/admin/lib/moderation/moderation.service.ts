import type { AnnouncementRow, ModerationFlagRow, ReportRow } from "@foryou/types";
import {
  createModerationFlag,
  publishAnnouncement,
  reviewModerationFlag,
  reviewReport,
  type CreateModerationFlagInput
} from "@foryou/supabase";
import { getAdminCurrentUser } from "../auth/current-user";
import { createAdminServiceClient } from "../supabase/server";

async function requireAdminRole() {
  const currentUser = await getAdminCurrentUser();
  const role = currentUser?.profile.role;

  if (role !== "admin" && role !== "moderator") {
    throw new Error("Admin session with moderator privileges is required.");
  }
}

export async function fetchReports(limit = 100): Promise<ReportRow[]> {
  await requireAdminRole();

  const client = createAdminServiceClient();
  const { data, error } = await client
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function reviewReportById(params: {
  reportId: number;
  nextStatus: string;
  action?: string;
}) {
  await requireAdminRole();

  const client = createAdminServiceClient();
  const result = await reviewReport(client, {
    reportId: params.reportId,
    nextStatus: params.nextStatus,
    action: params.action ?? "none"
  });

  if (!result.success) {
    throw new Error(result.message ?? "Failed to review report.");
  }

  return result;
}

export async function fetchModerationFlags(limit = 100): Promise<ModerationFlagRow[]> {
  await requireAdminRole();

  const client = createAdminServiceClient();
  const { data, error } = await client
    .from("moderation_flags")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function reviewModerationFlagById(params: {
  flagId: number;
  nextStatus: string;
}) {
  await requireAdminRole();

  const client = createAdminServiceClient();
  const result = await reviewModerationFlag(client, {
    flagId: params.flagId,
    nextStatus: params.nextStatus
  });

  if (!result.success) {
    throw new Error(result.message ?? "Failed to review moderation flag.");
  }

  return result;
}

export async function createModerationFlagManual(input: CreateModerationFlagInput) {
  await requireAdminRole();

  const client = createAdminServiceClient();
  return createModerationFlag(client, input);
}

export async function fetchAnnouncements(limit = 100): Promise<AnnouncementRow[]> {
  await requireAdminRole();

  const client = createAdminServiceClient();
  const { data, error } = await client
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function publishAnnouncementById(announcementId: number) {
  await requireAdminRole();

  const client = createAdminServiceClient();
  const result = await publishAnnouncement(client, announcementId);

  if (!result.published) {
    throw new Error(result.message ?? "Failed to publish announcement.");
  }

  return result;
}
