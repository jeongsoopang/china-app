"use server";

import { revalidatePath } from "next/cache";
import { updateAdminUser } from "./users.service";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRequiredText(value: FormDataEntryValue | null, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }
  return value.trim();
}

export async function updateUserProfileAction(formData: FormData): Promise<void> {
  const userId = parseRequiredText(formData.get("userId"), "userId");
  const role = parseRequiredText(formData.get("role"), "role");

  if (!uuidPattern.test(userId)) {
    throw new Error("userId must be a valid UUID.");
  }

  await updateAdminUser({
    userId,
    role
  });

  revalidatePath("/users");
}
