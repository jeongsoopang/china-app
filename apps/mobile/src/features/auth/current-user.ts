import { fetchCurrentUser, type CurrentUser } from "@foryou/supabase";
import { supabase } from "../../lib/supabase/client";

export async function getMobileCurrentUser(): Promise<CurrentUser | null> {
  return fetchCurrentUser(supabase);
}
