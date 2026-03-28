"use server";

import { revalidatePath } from "next/cache";
import {
  createEventPageBanner,
  createEventPageSponsor,
  deleteEventPageBanner,
  deleteEventPageSponsor,
  moveEventPageBanner,
  moveEventPageSponsor,
  updateEventPageBanner,
  updateEventPageSponsor
} from "./sponsor.service";

function parseRequiredText(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseRequiredInteger(value: FormDataEntryValue | null, fieldName: string): number {
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) {
    throw new Error(`${fieldName} must be an integer.`);
  }
  return Number(value);
}

function parseRequiredPositiveInteger(value: FormDataEntryValue | null, fieldName: string): number {
  const parsed = parseRequiredInteger(value, fieldName);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
}

function parseBooleanCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

function parseMoveDirection(value: FormDataEntryValue | null): "up" | "down" {
  if (value === "up" || value === "down") {
    return value;
  }
  throw new Error("direction must be 'up' or 'down'.");
}

function revalidateSponsorPage() {
  revalidatePath("/sponsor-page");
  revalidatePath("/dashboard");
}

export async function createEventBannerAction(formData: FormData) {
  const title = parseOptionalText(formData.get("title")) ?? "";
  const imageUrl = parseRequiredText(formData.get("imageUrl"), "imageUrl");
  const sortOrder = parseRequiredInteger(formData.get("sortOrder"), "sortOrder");
  const isActive = parseBooleanCheckbox(formData.get("isActive"));

  await createEventPageBanner({
    title,
    imageUrl,
    sortOrder,
    isActive
  });

  revalidateSponsorPage();
}

export async function updateEventBannerAction(formData: FormData) {
  const id = parseRequiredPositiveInteger(formData.get("id"), "id");
  const title = parseOptionalText(formData.get("title")) ?? "";
  const imageUrl = parseRequiredText(formData.get("imageUrl"), "imageUrl");
  const sortOrder = parseRequiredInteger(formData.get("sortOrder"), "sortOrder");
  const isActive = parseBooleanCheckbox(formData.get("isActive"));

  await updateEventPageBanner({
    id,
    title,
    imageUrl,
    sortOrder,
    isActive
  });

  revalidateSponsorPage();
}

export async function deleteEventBannerAction(formData: FormData) {
  const id = parseRequiredPositiveInteger(formData.get("id"), "id");
  await deleteEventPageBanner(id);
  revalidateSponsorPage();
}

export async function moveEventBannerAction(formData: FormData) {
  const id = parseRequiredPositiveInteger(formData.get("id"), "id");
  const direction = parseMoveDirection(formData.get("direction"));
  await moveEventPageBanner(id, direction);
  revalidateSponsorPage();
}

export async function createEventSponsorAction(formData: FormData) {
  const name = parseRequiredText(formData.get("name"), "name");
  const imageUrl = parseRequiredText(formData.get("imageUrl"), "imageUrl");
  const linkUrl = parseOptionalText(formData.get("linkUrl"));
  const sortOrder = parseRequiredInteger(formData.get("sortOrder"), "sortOrder");
  const isActive = parseBooleanCheckbox(formData.get("isActive"));

  await createEventPageSponsor({
    name,
    imageUrl,
    linkUrl,
    sortOrder,
    isActive
  });

  revalidateSponsorPage();
}

export async function updateEventSponsorAction(formData: FormData) {
  const id = parseRequiredPositiveInteger(formData.get("id"), "id");
  const name = parseRequiredText(formData.get("name"), "name");
  const imageUrl = parseRequiredText(formData.get("imageUrl"), "imageUrl");
  const linkUrl = parseOptionalText(formData.get("linkUrl"));
  const sortOrder = parseRequiredInteger(formData.get("sortOrder"), "sortOrder");
  const isActive = parseBooleanCheckbox(formData.get("isActive"));

  await updateEventPageSponsor({
    id,
    name,
    imageUrl,
    linkUrl,
    sortOrder,
    isActive
  });

  revalidateSponsorPage();
}

export async function deleteEventSponsorAction(formData: FormData) {
  const id = parseRequiredPositiveInteger(formData.get("id"), "id");
  await deleteEventPageSponsor(id);
  revalidateSponsorPage();
}

export async function moveEventSponsorAction(formData: FormData) {
  const id = parseRequiredPositiveInteger(formData.get("id"), "id");
  const direction = parseMoveDirection(formData.get("direction"));
  await moveEventPageSponsor(id, direction);
  revalidateSponsorPage();
}
