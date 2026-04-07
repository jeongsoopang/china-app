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
  image_urls: string[];
  is_home_popup: boolean;
  is_pinned: boolean;
  is_published: boolean;
  pinned_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type RawAdminAnnouncementRow = Omit<AdminAnnouncementRow, "image_urls"> & {
  image_urls?: unknown;
};

const ANNOUNCEMENT_IMAGES_BUCKET = "post-images";
const ANNOUNCEMENT_IMAGE_MAX_COUNT = 8;
const ANNOUNCEMENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ANNOUNCEMENT_IMAGE_CACHE_CONTROL = "31536000";
const ANNOUNCEMENT_SELECT_WITH_IMAGES =
  "id, author_user_id, title, outline, body, image_urls, is_home_popup, is_pinned, is_published, pinned_at, published_at, created_at, updated_at";
const ANNOUNCEMENT_SELECT_NO_IMAGES =
  "id, author_user_id, title, outline, body, is_home_popup, is_pinned, is_published, pinned_at, published_at, created_at, updated_at";

function sanitizeStorageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function inferImageExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }

  const fromType = file.type.split("/").pop()?.toLowerCase();
  if (fromType && /^[a-z0-9]{1,5}$/.test(fromType)) {
    return fromType === "jpeg" ? "jpg" : fromType;
  }

  return "jpg";
}

function createAnnouncementImageStoragePath(userId: string, index: number, file: File): string {
  const safeUserId = sanitizeStorageSegment(userId);
  const extension = inferImageExtension(file);
  return `announcements/${safeUserId}/${Date.now()}-${index}-${crypto.randomUUID()}.${extension}`;
}

function normalizeImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function toAdminAnnouncementRow(row: RawAdminAnnouncementRow): AdminAnnouncementRow {
  return {
    ...row,
    image_urls: normalizeImageUrls(row.image_urls)
  };
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? (error as { code?: unknown }).code : null;
  const message = "message" in error ? (error as { message?: unknown }).message : null;
  const messageText = typeof message === "string" ? message.toLowerCase() : "";
  const missingByCode = code === "42703";
  const missingByMessage =
    messageText.includes(columnName.toLowerCase()) && messageText.includes("does not exist");

  return missingByCode || missingByMessage;
}

function isMissingAnnouncementImageUrlsColumnError(error: unknown): boolean {
  return isMissingColumnError(error, "image_urls");
}

function announcementImageColumnMigrationMessage(): string {
  return "Announcement image attachments require DB migration 0023_add_announcement_image_urls.sql.";
}

function normalizeFile(value: FormDataEntryValue): File | null {
  if (typeof value === "string") {
    return null;
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return value.size > 0 ? value : null;
  }

  return null;
}

export function parseAnnouncementImageFiles(formData: FormData, fieldName: string): File[] {
  const files = formData
    .getAll(fieldName)
    .map(normalizeFile)
    .filter((file): file is File => Boolean(file));

  if (files.length > ANNOUNCEMENT_IMAGE_MAX_COUNT) {
    throw new Error(
      `You can attach up to ${ANNOUNCEMENT_IMAGE_MAX_COUNT} announcement images at once.`
    );
  }

  for (const file of files) {
    if (!file.type.toLowerCase().startsWith("image/")) {
      throw new Error("Only image files can be attached to announcements.");
    }

    if (file.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
      throw new Error("Each announcement image must be 10MB or smaller.");
    }
  }

  return files;
}

export async function uploadAnnouncementImages(params: {
  currentUserId: string;
  files: File[];
}): Promise<string[]> {
  const { currentUserId, files } = params;
  if (files.length === 0) {
    return [];
  }

  const client = createAdminServiceClient();
  const uploadedUrls: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file) {
      continue;
    }

    const storagePath = createAnnouncementImageStoragePath(currentUserId, index, file);
    const contentType = file.type || "image/jpeg";

    const uploadResult = await client.storage
      .from(ANNOUNCEMENT_IMAGES_BUCKET)
      .upload(storagePath, file, {
        contentType,
        cacheControl: ANNOUNCEMENT_IMAGE_CACHE_CONTROL,
        upsert: false
      });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const publicUrlResult = client.storage
      .from(ANNOUNCEMENT_IMAGES_BUCKET)
      .getPublicUrl(storagePath);

    uploadedUrls.push(publicUrlResult.data.publicUrl);
  }

  return uploadedUrls;
}

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
  const withImages = await (client
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT_WITH_IMAGES)
    .order("created_at", { ascending: false })
    .limit(limit) as PromiseLike<{
    data: RawAdminAnnouncementRow[] | null;
    error: unknown;
  }>);

  if (!withImages.error) {
    return (withImages.data ?? []).map(toAdminAnnouncementRow);
  }

  if (!isMissingAnnouncementImageUrlsColumnError(withImages.error)) {
    throw withImages.error;
  }

  const withoutImages = await (client
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT_NO_IMAGES)
    .order("created_at", { ascending: false })
    .limit(limit) as PromiseLike<{
    data: RawAdminAnnouncementRow[] | null;
    error: unknown;
  }>);

  if (withoutImages.error) {
    throw withoutImages.error;
  }

  return (withoutImages.data ?? []).map(toAdminAnnouncementRow);
}

export async function isAnnouncementImageColumnAvailable(): Promise<boolean> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();
  const result = await (client
    .from("announcements")
    .select("image_urls")
    .limit(1) as PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>);

  if (!result.error) {
    return true;
  }

  if (isMissingAnnouncementImageUrlsColumnError(result.error)) {
    return false;
  }

  throw result.error;
}

export async function createAnnouncementDraft(input: {
  title: string;
  outline: string;
  body: string;
  isHomePopup: boolean;
  imageUrls: string[];
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
  const withImages = await (client
    .from("announcements")
    .insert({
      author_user_id: currentUserId,
      title: input.title,
      outline: input.outline,
      body: input.body,
      image_urls: input.imageUrls,
      is_home_popup: input.isHomePopup
    })
    .select(ANNOUNCEMENT_SELECT_WITH_IMAGES)
    .single() as PromiseLike<{
    data: RawAdminAnnouncementRow | null;
    error: unknown;
  }>);

  if (!withImages.error) {
    if (!withImages.data) {
      throw new Error("Failed to create announcement draft.");
    }

    return toAdminAnnouncementRow(withImages.data);
  }

  if (!isMissingAnnouncementImageUrlsColumnError(withImages.error)) {
    throw withImages.error;
  }

  if (input.imageUrls.length > 0) {
    throw new Error(announcementImageColumnMigrationMessage());
  }

  const withoutImages = await (client
    .from("announcements")
    .insert({
      author_user_id: currentUserId,
      title: input.title,
      outline: input.outline,
      body: input.body,
      is_home_popup: input.isHomePopup
    })
    .select(ANNOUNCEMENT_SELECT_NO_IMAGES)
    .single() as PromiseLike<{
    data: RawAdminAnnouncementRow | null;
    error: unknown;
  }>);

  if (withoutImages.error) {
    throw withoutImages.error;
  }

  if (!withoutImages.data) {
    throw new Error("Failed to create announcement draft.");
  }

  return toAdminAnnouncementRow(withoutImages.data);
}

export async function updateAnnouncementById(params: {
  announcementId: number;
  title: string;
  outline: string;
  body: string;
  isHomePopup: boolean;
  imageUrls: string[];
}) {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();

  const withImages = await (client
    .from("announcements")
    .update({
      title: params.title,
      outline: params.outline,
      body: params.body,
      image_urls: params.imageUrls,
      is_home_popup: params.isHomePopup,
      updated_at: new Date().toISOString()
    })
    .eq("id", params.announcementId)
    .select(ANNOUNCEMENT_SELECT_WITH_IMAGES)
    .single() as PromiseLike<{
    data: RawAdminAnnouncementRow | null;
    error: unknown;
  }>);

  let updatedRow: RawAdminAnnouncementRow | null = null;

  if (!withImages.error) {
    updatedRow = withImages.data;
  } else if (isMissingAnnouncementImageUrlsColumnError(withImages.error)) {
    if (params.imageUrls.length > 0) {
      throw new Error(announcementImageColumnMigrationMessage());
    }

    const withoutImages = await (client
      .from("announcements")
      .update({
        title: params.title,
        outline: params.outline,
        body: params.body,
        is_home_popup: params.isHomePopup,
        updated_at: new Date().toISOString()
      })
      .eq("id", params.announcementId)
      .select(ANNOUNCEMENT_SELECT_NO_IMAGES)
      .single() as PromiseLike<{
      data: RawAdminAnnouncementRow | null;
      error: unknown;
    }>);

    if (withoutImages.error) {
      throw withoutImages.error;
    }

    updatedRow = withoutImages.data;
  } else {
    throw withImages.error;
  }

  if (!updatedRow) {
    throw new Error("Announcement not found.");
  }

  if (updatedRow.is_published) {
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

  return toAdminAnnouncementRow(updatedRow);
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

export async function publishAnnouncementById(
  announcementId: number,
  options?: {
    isPinned?: boolean;
  }
) {
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
  const result = await publishAnnouncement(rpcClient, announcementId, currentUserId, {
    isPinned: options?.isPinned === true
  });

  if (!result.published) {
    throw new Error(result.message ?? "Failed to publish announcement.");
  }

  const verifyClient = createAdminServiceClient();
  const withImages = await (verifyClient
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT_WITH_IMAGES)
    .eq("id", announcementId)
    .single() as PromiseLike<{
    data: RawAdminAnnouncementRow | null;
    error: unknown;
  }>);

  let data: RawAdminAnnouncementRow | null = null;

  if (!withImages.error) {
    data = withImages.data;
  } else if (isMissingAnnouncementImageUrlsColumnError(withImages.error)) {
    const withoutImages = await (verifyClient
      .from("announcements")
      .select(ANNOUNCEMENT_SELECT_NO_IMAGES)
      .eq("id", announcementId)
      .single() as PromiseLike<{
      data: RawAdminAnnouncementRow | null;
      error: unknown;
    }>);

    if (withoutImages.error) {
      throw withoutImages.error;
    }

    data = withoutImages.data;
  } else {
    throw withImages.error;
  }

  if (!data) {
    throw new Error("Announcement row not found after publish.");
  }

  if (!data.is_published || !data.published_at) {
    throw new Error("Publish RPC returned success, but announcement row was not updated.");
  }

  return result;
}
