"use server";

import { revalidatePath } from "next/cache";
import { upsertUniversityAlumniContent } from "./alumni.service";

function parseRequiredText(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function parseBooleanCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

export async function saveUniversityAlumniContentAction(formData: FormData) {
  const universityId = parseRequiredText(formData.get("universityId"), "universityId");
  const title = parseRequiredText(formData.get("title"), "title");
  const body = parseRequiredText(formData.get("body"), "body");
  const isVisible = parseBooleanCheckbox(formData.get("isVisible"));

  await upsertUniversityAlumniContent({
    universityId,
    title,
    body,
    isVisible
  });

  revalidatePath("/alumni");
}
