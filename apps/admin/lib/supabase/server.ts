import type { Database } from "@foryou/types";
import { createServiceSupabaseClient } from "@foryou/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { getAdminPublicEnv, getAdminServiceEnv } from "../../config/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
};

export async function createAdminServerSupabaseClient() {
  const cookieStore = await cookies();
  const env = getAdminPublicEnv();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            if (options) {
              cookieStore.set(name, value, options);
            } else {
              cookieStore.set(name, value);
            }
          });
        } catch {
          // Cookie writes can be skipped in Server Components.
        }
      }
    }
  });
}

export function createAdminServiceClient() {
  return createServiceSupabaseClient(getAdminServiceEnv());
}
