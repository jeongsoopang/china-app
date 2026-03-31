"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveManualPostTranslation } from "./post-translations.service";

function parseRequiredText(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

function parseRequiredPostId(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    throw new Error("postId must be a positive integer.");
  }

  return Number(value.trim());
}

function parseTargetLanguage(value: FormDataEntryValue | null): "ko" | "en" {
  const normalized = parseRequiredText(value, "targetLanguage");
  if (normalized !== "ko" && normalized !== "en") {
    throw new Error("targetLanguage must be ko or en.");
  }
  return normalized;
}

export async function saveManualPostTranslationAction(formData: FormData): Promise<void> {
  const postId = parseRequiredPostId(formData.get("postId"));
  const targetLanguage = parseTargetLanguage(formData.get("targetLanguage"));
  const translatedTitle = parseRequiredText(formData.get("translatedTitle"), "translatedTitle");
  const translatedBody = parseRequiredText(formData.get("translatedBody"), "translatedBody");

  try {
    await saveManualPostTranslation({
      postId,
      targetLanguage,
      translatedTitle,
      translatedBody
    });
    revalidatePath("/post-translations");
    redirect(
      `/post-translations?postId=${postId}&notice=${encodeURIComponent("Translation saved.")}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save translation.";
    redirect(
      `/post-translations?postId=${postId}&error=${encodeURIComponent(message)}`
    );
  }
}
