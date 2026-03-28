import type { UserProfileRow } from "@foryou/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../lib/supabase/client";
import { TierMarker } from "../../ui/tier-marker";
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
const PROMOTION_ACK_TIER_STORAGE_KEY = "@lucl/promotion_ack_tier_v1";

type PromotionTier = "gold" | "emerald" | "diamond";
type RankableTier = "bronze" | "silver" | "gold" | "emerald" | "diamond";

const TIER_RANK: Record<RankableTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  emerald: 3,
  diamond: 4
};

const SPECIAL_ROLES = new Set(["campus_master", "church_master", "grandmaster"]);

function normalizeRankableTier(value: string | null | undefined): RankableTier | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (
    normalized === "bronze" ||
    normalized === "silver" ||
    normalized === "gold" ||
    normalized === "emerald" ||
    normalized === "diamond"
  ) {
    return normalized;
  }
  return null;
}

function getPromotableTierFromProfile(profile: UserProfileRow | null | undefined): PromotionTier | null {
  if (!profile) {
    return null;
  }

  const normalizedRole = profile.role?.trim().toLowerCase() ?? "";
  const normalizedTier = profile.tier?.trim().toLowerCase() ?? "";

  if (SPECIAL_ROLES.has(normalizedRole) || SPECIAL_ROLES.has(normalizedTier)) {
    return null;
  }

  const normalizedPointTier = normalizeRankableTier(profile.point_tier);
  if (normalizedPointTier === "gold" || normalizedPointTier === "emerald" || normalizedPointTier === "diamond") {
    return normalizedPointTier;
  }

  const points = typeof profile.points === "number" ? profile.points : 0;
  if (points >= 3000) {
    return "diamond";
  }
  if (points >= 1500) {
    return "emerald";
  }
  if (points >= 500) {
    return "gold";
  }

  return null;
}

function getPromotionTitle(tier: PromotionTier): string {
  if (tier === "gold") {
    return "Gold 축하합니다!";
  }
  if (tier === "emerald") {
    return "Emerald 축하합니다!";
  }
  return "Diamond 축하합니다!";
}

export function AuthSessionProvider(props: { children: React.ReactNode }) {
  const { children } = props;
  const [status, setStatus] = useState<AuthSessionStatus>("loading");
  const [action, setAction] = useState<AuthAction>("idle");
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPromotionModalVisible, setIsPromotionModalVisible] = useState(false);
  const [promotionTierToCelebrate, setPromotionTierToCelebrate] = useState<PromotionTier | null>(null);
  const [promotionAcknowledgedTier, setPromotionAcknowledgedTier] = useState<RankableTier>("bronze");
  const [promotionAckLoaded, setPromotionAckLoaded] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadPromotionAcknowledgedTier() {
      try {
        const stored = await AsyncStorage.getItem(PROMOTION_ACK_TIER_STORAGE_KEY);
        if (cancelled) {
          return;
        }
        const normalized = normalizeRankableTier(stored);
        setPromotionAcknowledgedTier(normalized ?? "bronze");
      } catch {
        if (!cancelled) {
          setPromotionAcknowledgedTier("bronze");
        }
      } finally {
        if (!cancelled) {
          setPromotionAckLoaded(true);
        }
      }
    }

    void loadPromotionAcknowledgedTier();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!promotionAckLoaded) {
      return;
    }

    const currentTier = getPromotableTierFromProfile(user?.profile);
    if (!currentTier) {
      return;
    }

    if (TIER_RANK[currentTier] > TIER_RANK[promotionAcknowledgedTier]) {
      setPromotionTierToCelebrate(currentTier);
      setIsPromotionModalVisible(true);
    }
  }, [promotionAckLoaded, promotionAcknowledgedTier, user?.profile]);

  const acknowledgePromotionTier = useCallback(async () => {
    if (!promotionTierToCelebrate) {
      setIsPromotionModalVisible(false);
      return;
    }

    const tierToSave = promotionTierToCelebrate;
    setPromotionAcknowledgedTier(tierToSave);
    setIsPromotionModalVisible(false);

    try {
      await AsyncStorage.setItem(PROMOTION_ACK_TIER_STORAGE_KEY, tierToSave);
    } catch {
      return;
    }
  }, [promotionTierToCelebrate]);

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

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
      <Modal
        visible={isPromotionModalVisible && promotionTierToCelebrate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => void acknowledgePromotionTier()}
      >
        <View style={styles.promotionBackdrop}>
          <View style={styles.promotionCard}>
            <View style={styles.promotionBadgeWrap}>
              <TierMarker value={promotionTierToCelebrate} size={96} />
            </View>
            <Text style={styles.promotionTitle}>
              {promotionTierToCelebrate ? getPromotionTitle(promotionTierToCelebrate) : ""}
            </Text>
            <Pressable style={styles.promotionCloseButton} onPress={() => void acknowledgePromotionTier()}>
              <Text style={styles.promotionCloseButtonLabel}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider.");
  }

  return context;
}

const styles = StyleSheet.create({
  promotionBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  promotionCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  promotionBadgeWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(248,250,252,0.94)",
    borderWidth: 1,
    borderColor: "rgba(203,213,225,0.86)"
  },
  promotionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center"
  },
  promotionCloseButton: {
    minWidth: 96,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: "center"
  },
  promotionCloseButtonLabel: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700"
  }
});
