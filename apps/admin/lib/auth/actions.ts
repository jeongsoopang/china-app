"use server";

import { redirect } from "next/navigation";
import { createAdminServerSupabaseClient } from "../supabase/server";

function toLoginErrorRedirect(message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/login?${params.toString()}`);
}

function parseRequiredText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function mapSignInErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Sign-in failed. Please try again.";
  }

  const normalized = error.message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "Sign-in failed. Check your email and password and try again.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Sign-in failed. Please confirm this email account first.";
  }

  return `Sign-in failed: ${error.message}`;
}

export async function signInAdminAction(formData: FormData) {
  const email = parseRequiredText(formData.get("email"));
  const password = parseRequiredText(formData.get("password"));

  if (!email || !password) {
    toLoginErrorRedirect("Email and password are required.");
  }

  const client = await createAdminServerSupabaseClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    toLoginErrorRedirect(mapSignInErrorMessage(error));
  }

  redirect("/dashboard");
}

export async function signOutAdminAction() {
  const client = await createAdminServerSupabaseClient();
  await client.auth.signOut();
  redirect("/login");
}
