import { getPublicEnv } from "@foryou/supabase";

export function getMobilePublicEnv() {
  return getPublicEnv({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  });
}
