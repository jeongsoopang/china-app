import AsyncStorage from "@react-native-async-storage/async-storage";
import { createReactNativeSupabaseClient } from "@foryou/supabase";
import { getMobilePublicEnv } from "../../config/env";

const safeAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      return;
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      return;
    }
  }
};

export const supabase = createReactNativeSupabaseClient(getMobilePublicEnv(), safeAuthStorage);
