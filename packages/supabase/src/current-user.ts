import type { UserProfileRow } from "@foryou/types";
import type { User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "./client";

export type CurrentUser = {
  authUser: User;
  profile: UserProfileRow;
};

export class MissingUserProfileError extends Error {
  constructor(userId: string) {
    super(`Expected user_profiles row to exist for auth user ${userId}.`);
    this.name = "MissingUserProfileError";
  }
}

export async function fetchCurrentUser(
  client: AppSupabaseClient,
  options?: { accessToken?: string }
): Promise<CurrentUser | null> {
  const authResult = options?.accessToken
    ? await client.auth.getUser(options.accessToken)
    : await client.auth.getUser();

  if (authResult.error) {
    throw authResult.error;
  }

  const authUser = authResult.data.user;
  if (!authUser) {
    return null;
  }

  const profileResult = await client
    .from("user_profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (!profileResult.data) {
    throw new MissingUserProfileError(authUser.id);
  }

  return {
    authUser,
    profile: profileResult.data
  };
}
