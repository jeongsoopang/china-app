import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mapAuthError } from "../../src/features/auth/auth.service";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { supabase } from "../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

type UniversitySummary = {
  slug: string | null;
  shortName: string | null;
};

function getUniversityBadge(university: UniversitySummary | null): string | null {
  const value = university?.shortName ?? university?.slug;
  if (!value) {
    return null;
  }

  return value.trim().toUpperCase().slice(0, 6);
}

export default function MeScreen() {
  const auth = useAuthSession();
  const [localError, setLocalError] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [isPrivateOverride, setIsPrivateOverride] = useState<boolean | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [university, setUniversity] = useState<UniversitySummary | null>(null);

  const isSigningOut = auth.action === "signing_out";
  const authUserId = auth.user?.authUser.id ?? null;

  const displayName =
    auth.user?.profile?.display_name ??
    (typeof auth.user?.authUser.user_metadata?.display_name === "string"
      ? auth.user.authUser.user_metadata.display_name
      : null) ??
    "-";

  const role = auth.user?.profile?.role ?? "-";
  const tier = auth.user?.profile?.tier ?? null;
  const points = typeof auth.user?.profile?.points === "number" ? auth.user.profile.points : 0;
  const verifiedSchoolEmail = auth.user?.profile?.verified_school_email ?? null;
  const verifiedUniversityId = auth.user?.profile?.verified_university_id ?? null;
  const isSchoolVerified = Boolean(verifiedSchoolEmail && verifiedUniversityId);

  const isPrivateProfile =
    isPrivateOverride ??
    (typeof auth.user?.profile?.is_private === "boolean" ? auth.user.profile.is_private : false);

  const universityBadge = useMemo(() => getUniversityBadge(university), [university]);

  useEffect(() => {
    setIsPrivateOverride(
      typeof auth.user?.profile?.is_private === "boolean" ? auth.user.profile.is_private : false
    );
  }, [auth.user?.profile?.is_private]);

  useEffect(() => {
    let cancelled = false;

    async function loadUniversity() {
      setUniversity(null);

      if (!verifiedUniversityId) {
        return;
      }

      const { data, error } = await supabase
        .from("universities")
        .select("slug, short_name")
        .eq("id", verifiedUniversityId)
        .maybeSingle();

      if (cancelled || error || !data) {
        return;
      }

      const row = data as { slug: string | null; short_name: string | null };
      setUniversity({
        slug: row.slug,
        shortName: row.short_name
      });
    }

    void loadUniversity();

    return () => {
      cancelled = true;
    };
  }, [verifiedUniversityId]);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowCounts() {
      if (!authUserId) {
        setFollowerCount(0);
        setFollowingCount(0);
        return;
      }

      const [{ count: follower }, { count: following }] = await Promise.all([
        supabase
          .from("user_follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", authUserId),
        supabase
          .from("user_follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", authUserId)
      ]);

      if (cancelled) {
        return;
      }

      setFollowerCount(follower ?? 0);
      setFollowingCount(following ?? 0);
    }

    void loadFollowCounts();

    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  async function onSignOut() {
    if (isSigningOut) {
      return;
    }

    setLocalError(null);

    try {
      await auth.signOut();
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  }

  async function setPrivacy(nextIsPrivate: boolean) {
    if (!authUserId || isSavingPrivacy) {
      return;
    }

    setPrivacyError(null);
    setIsSavingPrivacy(true);

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ is_private: nextIsPrivate })
        .eq("id", authUserId);

      if (error) {
        throw error;
      }

      setIsPrivateOverride(nextIsPrivate);
    } catch (error) {
      setPrivacyError(mapAuthError(error));
    } finally {
      setIsSavingPrivacy(false);
    }
  }

  if (auth.isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Me</Text>
        <Text style={styles.text}>Loading account state...</Text>
      </View>
    );
  }

  if (!auth.isSignedIn || !auth.user) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Me</Text>
        <Text style={styles.text}>Sign in to view your account and access school verification.</Text>
        <Link
          asChild
          href={{
            pathname: "/auth/sign-in",
            params: { redirectTo: "/(tabs)/me" }
          }}
        >
          <Pressable style={styles.button}>
            <Text style={styles.buttonLabel}>Sign In</Text>
          </Pressable>
        </Link>
        <Link
          asChild
          href={{
            pathname: "/auth/sign-up",
            params: { redirectTo: "/(tabs)/me" }
          }}
        >
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonLabel}>Sign Up</Text>
          </Pressable>
        </Link>
        {auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Me</Text>
        <View style={styles.settingsGhostButton}>
          <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
        </View>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.identityRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLabel}>{displayName.trim().charAt(0).toUpperCase() || "U"}</Text>
          </View>
          <View style={styles.identityCard}>
            <View style={styles.nameRow}>
              {universityBadge ? <Text style={styles.universityBadge}>{universityBadge}</Text> : null}
              <Text style={styles.nameText}>{displayName}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Tier</Text>
            <Text style={styles.metaValue}>{tier ?? role}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Points</Text>
            <Text style={styles.metaValue}>{points}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Followers</Text>
            <Text style={styles.metaValue}>{followerCount}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Following</Text>
            <Text style={styles.metaValue}>{followingCount}</Text>
          </View>
        </View>

        <Text style={styles.profileLabel}>School Verified</Text>
        <Text style={styles.profileValue}>{isSchoolVerified ? "Yes" : "No"}</Text>
        <Text style={styles.profileLabel}>Verified University</Text>
        <Text style={styles.profileValue}>{university?.shortName ?? verifiedUniversityId ?? "-"}</Text>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsTitle}>Settings</Text>
        <Text style={styles.profileLabel}>Profile Privacy</Text>
        <View style={styles.privacySegmentRow}>
          <Pressable
            disabled={isSavingPrivacy}
            onPress={() => setPrivacy(false)}
            style={[styles.privacySegment, !isPrivateProfile && styles.privacySegmentActive]}
          >
            <Text style={[styles.privacySegmentLabel, !isPrivateProfile && styles.privacySegmentLabelActive]}>
              Public
            </Text>
          </Pressable>
          <Pressable
            disabled={isSavingPrivacy}
            onPress={() => setPrivacy(true)}
            style={[styles.privacySegment, isPrivateProfile && styles.privacySegmentActive]}
          >
            <Text style={[styles.privacySegmentLabel, isPrivateProfile && styles.privacySegmentLabelActive]}>
              Private
            </Text>
          </Pressable>
        </View>
        <Text style={styles.helperText}>
          {isPrivateProfile
            ? "Private profile: 팔로워가 아니면 프로필 내용을 볼 수 없습니다."
            : "Public profile: 다른 사용자가 프로필을 볼 수 있습니다."}
        </Text>
      </View>

      <Link asChild href="/verification/school">
        <Pressable style={styles.button}>
          <Text style={styles.buttonLabel}>School Verification</Text>
        </Pressable>
      </Link>
      <Pressable
        disabled={isSigningOut}
        onPress={onSignOut}
        style={[styles.secondaryButton, isSigningOut && styles.buttonDisabled]}
      >
        <Text style={styles.secondaryButtonLabel}>{isSigningOut ? "Signing Out..." : "Sign Out"}</Text>
      </Pressable>
      {privacyError ? <Text style={styles.errorText}>{privacyError}</Text> : null}
      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
      {!localError && auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
    backgroundColor: colors.background
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary
  },
  settingsGhostButton: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.34)",
    borderWidth: 1,
    borderColor: "rgba(176,196,220,0.34)"
  },
  text: {
    fontSize: 15,
    color: colors.textSecondary
  },
  profileCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 8,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent
  },
  identityCard: {
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(176,196,220,0.66)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start"
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  universityBadge: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  nameText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaPill: {
    minWidth: 86,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2
  },
  metaLabel: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  metaValue: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  profileLabel: {
    fontSize: 12,
    color: colors.textMuted
  },
  profileValue: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 4
  },
  settingsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 8
  },
  settingsTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  privacySegmentRow: {
    flexDirection: "row",
    gap: 8
  },
  privacySegment: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    alignItems: "center"
  },
  privacySegmentActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  privacySegmentLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  privacySegmentLabelActive: {
    color: "#f8fafc"
  },
  helperText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18
  },
  button: {
    marginTop: 8,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  secondaryButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: colors.surface
  },
  secondaryButtonLabel: {
    color: colors.accent,
    fontWeight: "600"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonLabel: {
    color: "#f8fafc",
    fontWeight: "600"
  },
  errorText: {
    fontSize: 14,
    color: colors.error
  }
});
