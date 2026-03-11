import type { SupabasePublicEnv, SupabaseServiceEnv } from "./types";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicEnv(values: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}): SupabasePublicEnv {
  return {
    supabaseUrl: requireEnv("SUPABASE_URL", values.supabaseUrl),
    supabaseAnonKey: requireEnv("SUPABASE_ANON_KEY", values.supabaseAnonKey)
  };
}

export function getServiceEnv(values: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
}): SupabaseServiceEnv {
  return {
    ...getPublicEnv(values),
    supabaseServiceRoleKey: requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      values.supabaseServiceRoleKey
    )
  };
}
