import type { UserProfileRow } from "@foryou/types";
import type { CurrentUser } from "@foryou/supabase";
import { supabase } from "../../lib/supabase/client";

export type AuthUser = CurrentUser["authUser"];

export type MobileSessionUser = {
  authUser: AuthUser;
  profile: UserProfileRow | null;
};

export type EmailPasswordCredentials = {
  email: string;
  password: string;
};

export type SignUpInput = EmailPasswordCredentials & {
  displayName?: string;
};

export type SignUpResult = {
  requiresEmailConfirmation: boolean;
  user: MobileSessionUser | null;
};

async function fetchProfileByUserId(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchSessionUser(): Promise<MobileSessionUser | null> {
  const authResult = await supabase.auth.getUser();

  if (authResult.error) {
    throw authResult.error;
  }

  const authUser = authResult.data.user;
  if (!authUser) {
    return null;
  }

  const profile = await fetchProfileByUserId(authUser.id);

  return {
    authUser,
    profile
  };
}

export async function signInWithEmailPassword(
  credentials: EmailPasswordCredentials
): Promise<MobileSessionUser> {
  const normalizedEmail = credentials.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: credentials.password
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Sign-in succeeded but user payload is missing.");
  }

  const profile = await fetchProfileByUserId(data.user.id);

  return {
    authUser: data.user,
    profile
  };
}

export async function signUpWithEmailPassword(input: SignUpInput): Promise<SignUpResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: displayName
      ? {
          data: {
            display_name: displayName
          }
        }
      : undefined
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Sign-up response did not include a user.");
  }

  if (!data.session) {
    return {
      requiresEmailConfirmation: true,
      user: null
    };
  }

  const profile = await fetchProfileByUserId(data.user.id);

  return {
    requiresEmailConfirmation: false,
    user: {
      authUser: data.user,
      profile
    }
  };
}

export async function signOutSession(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export function mapAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Authentication request failed.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }

  if (message.includes("password")) {
    return error.message;
  }

  if (message.includes("rate limit")) {
    return "Too many requests. Please try again shortly.";
  }

  return error.message || "Authentication request failed.";
}
