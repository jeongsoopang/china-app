import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguageMode = "system" | "ko" | "en";
export type ResolvedAppLanguage = "ko" | "en";

type AppLanguageContextValue = {
  languageMode: AppLanguageMode;
  resolvedLanguage: ResolvedAppLanguage;
  setLanguageMode: (nextMode: AppLanguageMode) => Promise<void>;
};

const APP_LANGUAGE_STORAGE_KEY = "@lucl/app_language_mode_v1";
const AppLanguageContext = createContext<AppLanguageContextValue | null>(null);

function resolveSystemLanguage(): ResolvedAppLanguage {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (locale.startsWith("ko")) {
      return "ko";
    }
    return "en";
  } catch {
    return "ko";
  }
}

export function AppLanguageProvider(props: { children: React.ReactNode }) {
  const { children } = props;
  const [languageMode, setLanguageModeState] = useState<AppLanguageMode>("system");
  const systemLanguage = useMemo<ResolvedAppLanguage>(() => resolveSystemLanguage(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadStoredMode() {
      try {
        const stored = await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
        if (cancelled) {
          return;
        }

        if (stored === "system" || stored === "ko" || stored === "en") {
          setLanguageModeState(stored);
          return;
        }

        setLanguageModeState("system");
      } catch {
        if (!cancelled) {
          setLanguageModeState("system");
        }
      }
    }

    void loadStoredMode();

    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedLanguage = useMemo<ResolvedAppLanguage>(() => {
    if (languageMode === "ko") {
      return "ko";
    }

    if (languageMode === "en") {
      return "en";
    }

    return systemLanguage;
  }, [languageMode, systemLanguage]);

  async function setLanguageMode(nextMode: AppLanguageMode) {
    setLanguageModeState(nextMode);
    await AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, nextMode);
  }

  const value = useMemo<AppLanguageContextValue>(() => {
    return {
      languageMode,
      resolvedLanguage,
      setLanguageMode
    };
  }, [languageMode, resolvedLanguage]);

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage(): AppLanguageContextValue {
  const context = useContext(AppLanguageContext);

  if (!context) {
    throw new Error("useAppLanguage must be used within AppLanguageProvider.");
  }

  return context;
}
