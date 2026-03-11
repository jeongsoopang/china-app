import type { AppSupabaseClient } from "./client";
import { fetchCurrentUser, type CurrentUser } from "./current-user";

export type PasswordSignInInput = {
  email: string;
  password: string;
};

export async function signInAndFetchCurrentUser(
  client: AppSupabaseClient,
  credentials: PasswordSignInInput
): Promise<CurrentUser> {
  const signInResult = await client.auth.signInWithPassword(credentials);

  if (signInResult.error) {
    throw signInResult.error;
  }

  const currentUser = await fetchCurrentUser(client);

  if (!currentUser) {
    throw new Error("User session is missing after sign-in.");
  }

  return currentUser;
}
