import type { Database } from "@foryou/types";
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions
} from "@supabase/supabase-js";
import type { SupabasePublicEnv, SupabaseServiceEnv } from "./types";

export type AppSupabaseClient = SupabaseClient<Database>;

export type SupabaseAuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

function getDefaultOptions(): SupabaseClientOptions<"public"> {
  return {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  };
}

export function createPublicSupabaseClient(
  env: SupabasePublicEnv,
  options?: SupabaseClientOptions<"public">
): AppSupabaseClient {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    ...getDefaultOptions(),
    ...options
  });
}

export function createReactNativeSupabaseClient(
  env: SupabasePublicEnv,
  storage: SupabaseAuthStorage,
  options?: SupabaseClientOptions<"public">
): AppSupabaseClient {
  return createPublicSupabaseClient(env, {
    ...options,
    auth: {
      ...getDefaultOptions().auth,
      ...options?.auth,
      storage
    }
  });
}

export function createServiceSupabaseClient(
  env: SupabaseServiceEnv,
  options?: SupabaseClientOptions<"public">
): AppSupabaseClient {
  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    ...options
  });
}
