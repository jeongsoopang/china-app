import AsyncStorage from "@react-native-async-storage/async-storage";
import { createReactNativeSupabaseClient } from "@foryou/supabase";
import { getMobilePublicEnv } from "../../config/env";

export const supabase = createReactNativeSupabaseClient(getMobilePublicEnv(), AsyncStorage);
