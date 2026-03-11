"use client";

import { createPublicSupabaseClient } from "@foryou/supabase";
import { getAdminPublicEnv } from "../../config/env";

export const supabase = createPublicSupabaseClient(getAdminPublicEnv());
