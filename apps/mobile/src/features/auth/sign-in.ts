import {
  signInAndFetchCurrentUser,
  type CurrentUser,
  type PasswordSignInInput
} from "@foryou/supabase";
import { supabase } from "../../lib/supabase/client";

export async function signInMobileUser(
  credentials: PasswordSignInInput
): Promise<CurrentUser> {
  return signInAndFetchCurrentUser(supabase, credentials);
}
