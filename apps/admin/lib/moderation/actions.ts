"use server";

import { revalidatePath } from "next/cache";
import {
  publishAnnouncementById,
  reviewModerationFlagById,
  reviewReportById
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

export async function reviewReportAction(formData: FormData) {
  const reportId = parseRequiredPositiveInteger(formData.get("reportId"), "reportId");
  const nextStatus = parseRequiredText(formData.get("nextStatus"), "nextStatus");
  const actionRaw = formData.get("action");
  const action =
    typeof actionRaw === "string" && actionRaw.trim().length > 0 ? actionRaw.trim() : "none";

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

export async function publishAnnouncementAction(formData: FormData) {
  const announcementId = parseRequiredPositiveInteger(
    formData.get("announcementId"),
    "announcementId"
  );

  await publishAnnouncementById(announcementId);

  revalidatePath("/announcements");
}
