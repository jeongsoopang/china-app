"use server";

import { revalidatePath } from "next/cache";
import { upsertHomeGuideContent } from "./home-guide.service";

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

function parseBooleanCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

export async function saveHomeGuideContentAction(formData: FormData) {
  const title = parseRequiredText(formData.get("title"), "title");
  const body = parseRequiredText(formData.get("body"), "body");
  const imageUrl = parseOptionalText(formData.get("imageUrl"));
  const isVisible = parseBooleanCheckbox(formData.get("isVisible"));

  await upsertHomeGuideContent({
    title,
    body,
    imageUrl,
    isVisible
  });

  revalidatePath("/home-guide");
}
