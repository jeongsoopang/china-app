import type { UserProfileRow } from "@foryou/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import {
  type AuthUser,
  fetchSessionUser,
  mapAuthError,
  signInWithEmailPassword,
  signOutSession,
  signUpWithEmailPassword,
  type EmailPasswordCredentials,
  type SignUpInput,
  type SignUpResult
} from "./auth.service";

type AuthSessionUser = {
  authUser: AuthUser;
  profile: UserProfileRow | null;
};

type AuthSessionStatus = "loading" | "ready";
type AuthAction = "idle" | "signing_in" | "signing_up" | "signing_out";

type AuthSessionContextValue = {
  status: AuthSessionStatus;
  action: AuthAction;
  user: AuthSessionUser | null;
  errorMessage: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
  refresh: () => Promise<void>;
  signIn: (credentials: EmailPasswordCredentials) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider(props: { children: React.ReactNode }) {
  const { children } = props;
  const [status, setStatus] = useState<AuthSessionStatus>("loading");
  const [action, setAction] = useState<AuthAction>("idle");
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);

    try {
      const currentUser = await fetchSessionUser();
      setUser(currentUser);
      setStatus("ready");
    } catch (error) {
      setUser(null);
      setStatus("ready");
      setErrorMessage(mapAuthError(error));
    }
  }, []);

  useEffect(() => {
    void refresh();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refresh]);

  const signIn = useCallback(async (credentials: EmailPasswordCredentials) => {
    setAction("signing_in");
    setErrorMessage(null);

    try {
      const currentUser = await signInWithEmailPassword(credentials);
      setUser(currentUser);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(mapAuthError(error));
      throw error;
    } finally {
      setAction("idle");
    }
  }, []);

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpResult> => {
    setAction("signing_up");
    setErrorMessage(null);

    try {
      const result = await signUpWithEmailPassword(input);

      if (result.user) {
        setUser(result.user);
        setStatus("ready");
      } else {
        setUser(null);
      }

      return result;
    } catch (error) {
      setErrorMessage(mapAuthError(error));
      throw error;
    } finally {
      setAction("idle");
    }
  }, []);

  const signOut = useCallback(async () => {
    setAction("signing_out");
    setErrorMessage(null);

    try {
      await signOutSession();
      setUser(null);
      setStatus("ready");
    } catch (error) {
      setErrorMessage(mapAuthError(error));
      throw error;
    } finally {
      setAction("idle");
    }
  }, []);

  const value = useMemo<AuthSessionContextValue>(() => {
    return {
      status,
      action,
      user,
      errorMessage,
      isLoading: status === "loading",
      isSignedIn: user !== null,
      refresh,
      signIn,
      signUp,
      signOut
    };
  }, [status, action, user, errorMessage, refresh, signIn, signUp, signOut]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }

  return context;
}
