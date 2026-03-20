"use server";

import { revalidatePath } from "next/cache";
import {
  createAnnouncementDraft,
  deleteAnnouncementById,
  publishAnnouncementById,
  reviewModerationFlagById,
  reviewReportById,
  updateAnnouncementById
} from "./moderation.service";

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

  await createAnnouncementDraft({
    title,
    outline,
    body
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

  await updateAnnouncementById({
    announcementId,
    title,
    outline,
    body
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

  await publishAnnouncementById(announcementId);

  revalidatePath("/announcements");
}
