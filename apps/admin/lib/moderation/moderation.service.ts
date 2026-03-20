import type { ModerationFlagRow } from "@foryou/types";
import {
  createModerationFlag,
  publishAnnouncement,
  reviewModerationFlag,
  reviewReport,
  type AppSupabaseClient,
  type CreateModerationFlagInput
} from "@foryou/supabase";
import { requireGrandMasterAccess } from "../auth/grandmaster";
import { createAdminServerSupabaseClient, createAdminServiceClient } from "../supabase/server";

type ReporterProfileRow = {
  id: string;
  display_name: string | null;
};

type RawReportRow = {
  id: number;
  reporter_user_id: string;
  target_type: string;
  target_id: number;
  reason_code: string;
  reason_text: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  action_taken?: string | null;
};

type PostLookupRow = {
  id: number;
  author_id: string | null;
  title: string | null;
  body: string | null;
  status: string | null;
};

type ReportWithDetails = RawReportRow & {
  reporter_display_name: string | null;
  reporter_email: string | null;
  target_author_id: string | null;
  target_author_display_name: string | null;
  target_author_email: string | null;
  target_post_title: string | null;
  target_post_body: string | null;
  target_post_status: string | null;
};

export type AdminAnnouncementRow = {
  id: number;
  author_user_id: string;
  title: string;
  outline: string;
  body: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function errorMessageFromUnknown(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export async function fetchReports(limit = 100): Promise<ReportWithDetails[]> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();
  const { data, error } = await client
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const reports = (data ?? []) as unknown as RawReportRow[];
  if (reports.length === 0) {
    return [];
  }

  const reporterIds = Array.from(
    new Set(reports.map((report) => report.reporter_user_id).filter(Boolean))
  );

  const reporterProfileMap = new Map<string, ReporterProfileRow>();
  if (reporterIds.length > 0) {
    const reporterProfilesResult = await client
      .from("user_profiles")
      .select("id, display_name")
      .in("id", reporterIds);

    if (reporterProfilesResult.error) {
      throw new Error(
        errorMessageFromUnknown(reporterProfilesResult.error, "Failed to load reporter profiles.")
      );
    }

    for (const row of (reporterProfilesResult.data ?? []) as ReporterProfileRow[]) {
      reporterProfileMap.set(row.id, row);
    }
  }

  const postIds = Array.from(
    new Set(
      reports
        .filter((report) => report.target_type === "post")
        .map((report) => report.target_id)
        .filter((value): value is number => typeof value === "number")
    )
  );

  const postMap = new Map<number, PostLookupRow>();
  if (postIds.length > 0) {
    const postsResult = await client
      .from("posts")
      .select("id, author_id, title, body, status")
      .in("id", postIds);

    if (postsResult.error) {
      throw new Error(errorMessageFromUnknown(postsResult.error, "Failed to load posts."));
    }

    for (const post of (postsResult.data ?? []) as PostLookupRow[]) {
      postMap.set(post.id, post);
    }
  }

  const targetAuthorIds = Array.from(
    new Set(
      Array.from(postMap.values())
        .map((post) => post.author_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const targetAuthorProfileMap = new Map<string, ReporterProfileRow>();
  if (targetAuthorIds.length > 0) {
    const targetAuthorProfilesResult = await client
      .from("user_profiles")
      .select("id, display_name")
      .in("id", targetAuthorIds);

    if (targetAuthorProfilesResult.error) {
      throw new Error(
        errorMessageFromUnknown(
          targetAuthorProfilesResult.error,
          "Failed to load target author profiles."
        )
      );
    }

    for (const row of (targetAuthorProfilesResult.data ?? []) as ReporterProfileRow[]) {
      targetAuthorProfileMap.set(row.id, row);
    }
  }

  const authUsersResult = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (authUsersResult.error) {
    throw new Error(errorMessageFromUnknown(authUsersResult.error, "Failed to load auth users."));
  }

  const authEmailMap = new Map<string, string | null>();
  for (const user of authUsersResult.data.users) {
    authEmailMap.set(user.id, user.email ?? null);
  }

  return reports.map((report) => {
    const reporterProfile = reporterProfileMap.get(report.reporter_user_id);
    const targetPost =
      report.target_type === "post" && typeof report.target_id === "number"
        ? postMap.get(report.target_id)
        : null;
    const targetAuthorProfile = targetPost?.author_id
      ? targetAuthorProfileMap.get(targetPost.author_id)
      : null;

    return {
      ...report,
      reporter_display_name: reporterProfile?.display_name ?? null,
      reporter_email: authEmailMap.get(report.reporter_user_id) ?? null,
      target_author_id: targetPost?.author_id ?? null,
      target_author_display_name: targetAuthorProfile?.display_name ?? null,
      target_author_email:
        targetPost?.author_id ? authEmailMap.get(targetPost.author_id) ?? null : null,
      target_post_title: targetPost?.title ?? null,
      target_post_body: targetPost?.body ?? null,
      target_post_status: targetPost?.status ?? null
    };
  });
}

export async function reviewReportById(params: {
  reportId: number;
  nextStatus: string;
  action?: string;
}) {
  await requireGrandMasterAccess();

  const client = (await createAdminServerSupabaseClient()) as unknown as AppSupabaseClient;
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
  await requireGrandMasterAccess();

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
  await requireGrandMasterAccess();

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
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();
  return createModerationFlag(client, input);
}

export async function fetchAnnouncements(limit = 100): Promise<AdminAnnouncementRow[]> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();
  const { data, error } = await (client
    .from("announcements")
    .select(
      "id, author_user_id, title, outline, body, is_published, published_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit) as PromiseLike<{
    data: AdminAnnouncementRow[] | null;
    error: unknown;
  }>);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createAnnouncementDraft(input: {
  title: string;
  outline: string;
  body: string;
}) {
  await requireGrandMasterAccess();

  const authClient = await createAdminServerSupabaseClient();
  const authResult = await authClient.auth.getUser();

  if (authResult.error) {
    throw authResult.error;
  }

  const currentUserId = authResult.data.user?.id;
  if (!currentUserId) {
    throw new Error("Authenticated admin user not found.");
  }

  const client = createAdminServiceClient();
  const { data, error } = await (client
    .from("announcements")
    .insert({
      author_user_id: currentUserId,
      title: input.title,
      outline: input.outline,
      body: input.body
    })
    .select(
      "id, author_user_id, title, outline, body, is_published, published_at, created_at, updated_at"
    )
    .single() as PromiseLike<{
    data: AdminAnnouncementRow | null;
    error: unknown;
  }>);

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Failed to create announcement draft.");
  }

  return data;
}

export async function updateAnnouncementById(params: {
  announcementId: number;
  title: string;
  outline: string;
  body: string;
}) {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();

  const { data, error } = await (client
    .from("announcements")
    .update({
      title: params.title,
      outline: params.outline,
      body: params.body,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.announcementId)
    .select(
      "id, author_user_id, title, outline, body, is_published, published_at, created_at, updated_at"
    )
    .single() as PromiseLike<{
    data: AdminAnnouncementRow | null;
    error: unknown;
  }>);

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Announcement not found.");
  }

  if (data.is_published) {
    const notificationsUpdate = await client
      .from("notifications")
      .update({
        title: params.title,
        body: params.outline
      })
      .eq("type", "announcement")
      .eq("ref_type", "announcement")
      .eq("ref_id", params.announcementId);

    if (notificationsUpdate.error) {
      throw notificationsUpdate.error;
    }
  }

  return data;
}

export async function deleteAnnouncementById(announcementId: number) {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();

  const notificationsDelete = await client
    .from("notifications")
    .delete()
    .eq("type", "announcement")
    .eq("ref_type", "announcement")
    .eq("ref_id", announcementId);

  if (notificationsDelete.error) {
    throw notificationsDelete.error;
  }

  const announcementDelete = await client
    .from("announcements")
    .delete()
    .eq("id", announcementId);

  if (announcementDelete.error) {
    throw announcementDelete.error;
  }
}

export async function publishAnnouncementById(announcementId: number) {
  await requireGrandMasterAccess();

  const authClient = await createAdminServerSupabaseClient();
  const authResult = await authClient.auth.getUser();

  if (authResult.error) {
    throw authResult.error;
  }

  const currentUserId = authResult.data.user?.id;
  if (!currentUserId) {
    throw new Error("Authenticated admin user not found.");
  }

  const rpcClient = (await createAdminServerSupabaseClient()) as unknown as AppSupabaseClient;
  const result = await publishAnnouncement(rpcClient, announcementId, currentUserId);

  if (!result.published) {
    throw new Error(result.message ?? "Failed to publish announcement.");
  }

  const verifyClient = createAdminServiceClient();
  const { data, error } = await (verifyClient
    .from("announcements")
    .select(
      "id, author_user_id, title, outline, body, is_published, published_at, created_at, updated_at"
    )
    .eq("id", announcementId)
    .single() as PromiseLike<{
    data: AdminAnnouncementRow | null;
    error: unknown;
  }>);

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Announcement row not found after publish.");
  }

  if (!data.is_published || !data.published_at) {
    throw new Error("Publish RPC returned success, but announcement row was not updated.");
  }

  return result;
}
