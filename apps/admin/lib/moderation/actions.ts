"use server";

import { revalidatePath } from "next/cache";
import {
  createAnnouncementDraft,
  deleteAnnouncementById,
  isAnnouncementImageColumnAvailable,
  publishAnnouncementById,
  parseAnnouncementImageFiles,
  reviewModerationFlagById,
  reviewReportById,
  uploadAnnouncementImages,
  updateAnnouncementById
} from "./moderation.service";
import { createAdminServerSupabaseClient } from "../supabase/server";

function parseRequiredPositiveInteger(value: FormDataEntryValue | null, fieldName: string): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return Number(value);
}

function parseRequiredText(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

const allowedReportActions = new Set(["none", "request_revision", "hide", "delete"]);
const allowedAnnouncementPublishModes = new Set(["normal", "pinned"]);
const allowedAnnouncementPinStates = new Set(["unpinned", "pinned"]);

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function parseImageUrlValues(formData: FormData, fieldName: string): string[] {
  return formData
    .getAll(fieldName)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseAnnouncementPinState(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string" || !allowedAnnouncementPinStates.has(value)) {
    throw new Error("pinState must be one of: unpinned, pinned.");
  }

  return value === "pinned";
}

async function requireCurrentAdminUserId(): Promise<string> {
  const authClient = await createAdminServerSupabaseClient();
  const authResult = await authClient.auth.getUser();

  if (authResult.error) {
    throw authResult.error;
  }

  const currentUserId = authResult.data.user?.id;
  if (!currentUserId) {
    throw new Error("Authenticated admin user not found.");
  }

  return currentUserId;
}

export async function reviewReportAction(formData: FormData) {
  const reportId = parseRequiredPositiveInteger(formData.get("reportId"), "reportId");
  const nextStatus = parseRequiredText(formData.get("nextStatus"), "nextStatus");
  const actionRaw = formData.get("action");
  const action =
    typeof actionRaw === "string" && actionRaw.trim().length > 0 ? actionRaw.trim() : "none";

  if (!allowedReportActions.has(action)) {
    throw new Error("action must be one of: none, request_revision, hide, delete.");
  }

  await reviewReportById({
    reportId,
    nextStatus,
    action
  });

  revalidatePath("/reports");
}

export async function reviewModerationFlagAction(formData: FormData) {
  const flagId = parseRequiredPositiveInteger(formData.get("flagId"), "flagId");
  const nextStatus = parseRequiredText(formData.get("nextStatus"), "nextStatus");

  await reviewModerationFlagById({
    flagId,
    nextStatus
  });

  revalidatePath("/moderation");
}

export async function createAnnouncementAction(formData: FormData) {
  const title = parseRequiredText(formData.get("title"), "title");
  const outline = parseRequiredText(formData.get("outline"), "outline");
  const body = parseRequiredText(formData.get("body"), "body");
  const isHomePopup = parseCheckbox(formData.get("isHomePopup"));
  const imageFiles = parseAnnouncementImageFiles(formData, "images");
  if (imageFiles.length > 0 && !(await isAnnouncementImageColumnAvailable())) {
    throw new Error(
      "Announcement image attachments are temporarily unavailable until DB migration 0023 is applied."
    );
  }
  const imageUrls =
    imageFiles.length > 0
      ? await uploadAnnouncementImages({
          currentUserId: await requireCurrentAdminUserId(),
          files: imageFiles
        })
      : [];

  await createAnnouncementDraft({
    title,
    outline,
    body,
    isHomePopup,
    imageUrls
  });

  revalidatePath("/announcements");
}

export async function updateAnnouncementAction(formData: FormData) {
  const announcementId = parseRequiredPositiveInteger(
    formData.get("announcementId"),
    "announcementId"
  );
  const title = parseRequiredText(formData.get("title"), "title");
  const outline = parseRequiredText(formData.get("outline"), "outline");
  const body = parseRequiredText(formData.get("body"), "body");
  const isHomePopup = parseCheckbox(formData.get("isHomePopup"));
  const isPinned = parseAnnouncementPinState(formData.get("pinState"));
  const existingImageUrls = parseImageUrlValues(formData, "existingImageUrls");
  const imageFiles = parseAnnouncementImageFiles(formData, "images");
  if (imageFiles.length > 0 && !(await isAnnouncementImageColumnAvailable())) {
    throw new Error(
      "Announcement image attachments are temporarily unavailable until DB migration 0023 is applied."
    );
  }
  const uploadedImageUrls =
    imageFiles.length > 0
      ? await uploadAnnouncementImages({
          currentUserId: await requireCurrentAdminUserId(),
          files: imageFiles
        })
      : [];
  const imageUrls = [...existingImageUrls, ...uploadedImageUrls];

  await updateAnnouncementById({
    announcementId,
    title,
    outline,
    body,
    isHomePopup,
    isPinned,
    imageUrls
  });

  revalidatePath("/announcements");
}

export async function deleteAnnouncementAction(formData: FormData) {
  const announcementId = parseRequiredPositiveInteger(
    formData.get("announcementId"),
    "announcementId"
  );

  await deleteAnnouncementById(announcementId);

  revalidatePath("/announcements");
}

export async function publishAnnouncementAction(formData: FormData) {
  const announcementId = parseRequiredPositiveInteger(
    formData.get("announcementId"),
    "announcementId"
  );
  const modeRaw = formData.get("publishMode");
  const publishMode =
    typeof modeRaw === "string" && allowedAnnouncementPublishModes.has(modeRaw)
      ? modeRaw
      : "normal";

  await publishAnnouncementById(announcementId, {
    isPinned: publishMode === "pinned"
  });

  revalidatePath("/announcements");
}
