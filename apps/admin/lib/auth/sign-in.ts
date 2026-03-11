"use client";

import {
  signInAndFetchCurrentUser,
  type CurrentUser,
  type PasswordSignInInput
} from "@foryou/supabase";
import { supabase } from "../supabase/client";

export async function signInAdminUser(
  credentials: PasswordSignInInput
): Promise<CurrentUser> {
  return signInAndFetchCurrentUser(supabase, credentials);
}
