import { fetchCurrentUser, type CurrentUser } from "@foryou/supabase";
import { createAdminServerSupabaseClient } from "../supabase/server";

type FetchCurrentUserClient = Parameters<typeof fetchCurrentUser>[0];

function isRecoverableAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("auth session missing") ||
    message.includes("session missing") ||
    message.includes("authsessionmissingerror") ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token already used") ||
    message.includes("refresh_token_already_used")
  );
}

export async function getAdminCurrentUser(): Promise<CurrentUser | null> {
  const client = await createAdminServerSupabaseClient();

  try {
    return await fetchCurrentUser(client as unknown as FetchCurrentUserClient);
  } catch (error) {
    if (isRecoverableAuthError(error)) {
      return null;
    }
    throw error;
  }
}
