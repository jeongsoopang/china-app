"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAdminUser, updateAdminUser } from "./users.service";

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

export async function deleteUserAccountAction(formData: FormData): Promise<void> {
  const userId = parseRequiredText(formData.get("userId"), "userId");
  const confirmed = formData.get("confirmDelete");

  if (!uuidPattern.test(userId)) {
    redirect("/users?error=Invalid%20userId.");
  }

  if (confirmed !== "yes") {
    redirect("/users?error=Delete%20confirmation%20is%20required.");
  }

  try {
    await deleteAdminUser({ userId });
    revalidatePath("/users");
    redirect("/users?notice=User%20account%20deleted.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user account.";
    redirect(`/users?error=${encodeURIComponent(message)}`);
  }
}
