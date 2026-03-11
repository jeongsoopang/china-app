import { fetchCurrentUser, type CurrentUser } from "@foryou/supabase";
import { createAdminServerSupabaseClient } from "../supabase/server";

type FetchCurrentUserClient = Parameters<typeof fetchCurrentUser>[0];

export async function getAdminCurrentUser(): Promise<CurrentUser | null> {
  const client = await createAdminServerSupabaseClient();
  return fetchCurrentUser(client as unknown as FetchCurrentUserClient);
}
