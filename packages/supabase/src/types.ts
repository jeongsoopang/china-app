export type SupabasePublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type SupabaseServiceEnv = SupabasePublicEnv & {
  supabaseServiceRoleKey: string;
};
