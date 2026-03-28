import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useAuthSession } from "../../../src/features/auth/auth-session";
import { supabase } from "../../../src/lib/supabase/client";
import { TierMarker, normalizeTierForDisplay } from "../../../src/ui/tier-marker";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

type PublicProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  profileBackgroundUrl: string | null;
  verifiedUniversityId: string | null;
  isPrivateProfile: boolean;
  points: number;
  tier: string | null;
};

type VerifiedUniversitySummary = {
  name: string;
  shortName: string | null;
};

type UserPostPreview = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
};

function getTierAccent(tierValue: string | null) {
  const normalized = (tierValue ?? "").trim().toLowerCase();

  if (normalized === "bronze") {
    return { borderColor: "#8a5a2b", labelColor: "#7a4d24", valueColor: "#5f3816" };
  }
  if (normalized === "silver") {
    return { borderColor: "#7b8794", labelColor: "#66707a", valueColor: "#4b5560" };
  }
  if (normalized === "gold") {
    return { borderColor: "#a87b12", labelColor: "#8f6810", valueColor: "#6f4f0c" };
  }
  if (normalized === "emerald") {
    return { borderColor: "#1f7a5a", labelColor: "#176148", valueColor: "#124d3a" };
  }
  if (normalized === "platinum" || normalized === "diamond") {
    return { borderColor: "#355c9a", labelColor: "#2f538a", valueColor: "#233f69" };
  }
  if (normalized === "master") {
    return { borderColor: "#5f3dc4", labelColor: "#5335ad", valueColor: "#41288a" };
  }
  if (normalized === "grandmaster") {
    return { borderColor: "#8f1f1f", labelColor: "#7a1a1a", valueColor: "#5f1414" };
  }
  if (normalized === "church_master") {
    return { borderColor: "#1f7a4f", labelColor: "#18623f", valueColor: "#124d31" };
  }

  return {
    borderColor: colors.border,
    labelColor: colors.textMuted,
    valueColor: colors.textPrimary
  };
}

function stripBodyPreview(body: string): string {
  if (!body) {
    return "";
  }

  return body
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function pickFirstString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function pickFirstBoolean(row: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

export default function UserProfileScreen() {
  const auth = useAuthSession();
  const { userId } = useLocalSearchParams<{ userId: string | string[] }>();

  const resolvedUserId = Array.isArray(userId) ? userId[0] : userId;
  const viewerId = auth.user?.authUser.id ?? null;
  const isOwnProfile = Boolean(viewerId && resolvedUserId && viewerId === resolvedUserId);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [verifiedUniversity, setVerifiedUniversity] = useState<VerifiedUniversitySummary | null>(null);
  const [posts, setPosts] = useState<UserPostPreview[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingFollow, setIsSavingFollow] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canViewProfile =
    profile !== null && (!profile.isPrivateProfile || isOwnProfile || isFollowing);
  const isLockedProfile = Boolean(profile?.isPrivateProfile && !canViewProfile);

  const avatarLetter = useMemo(() => {
    const base = profile?.displayName?.trim();
    if (!base) {
      return "U";
    }

    return base.charAt(0).toUpperCase();
  }, [profile?.displayName]);
  const displayTier = normalizeTierForDisplay(profile?.tier ?? null);

  const userProfileReturnTo = useMemo(() => {
    if (!resolvedUserId) {
      return "/(tabs)";
    }

    return `/users/${resolvedUserId}`;
  }, [resolvedUserId]);

  const loadFollowState = useCallback(async () => {
    if (!resolvedUserId) {
      return null;
    }

    const tableClient = supabase as unknown as {
      from: (table: string) => {
        select: (query: string, options?: Record<string, unknown>) => any;
      };
    };

    const [{ count: followerTotal, error: followerError }, followRow] = await Promise.all([
      tableClient
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", resolvedUserId),
      viewerId
        ? tableClient
            .from("follows")
            .select("follower_id")
            .eq("follower_id", viewerId)
            .eq("following_id", resolvedUserId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    if (followerError) {
      return null;
    }

    return {
      followerCount: typeof followerTotal === "number" ? followerTotal : 0,
      isFollowing: Boolean(followRow?.data)
    };
  }, [resolvedUserId, viewerId]);

  const loadUserProfile = useCallback(async () => {
    if (!resolvedUserId) {
      setErrorMessage("Invalid profile identifier.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const tableClient = supabase as unknown as {
      from: (table: string) => {
        select: (query: string, options?: Record<string, unknown>) => any;
      };
    };

    const { data: profileData, error: profileError } = await tableClient
      .from("user_profiles")
      .select("*")
      .eq("id", resolvedUserId)
      .maybeSingle();

    if (profileError) {
      setErrorMessage(profileError.message ?? "Failed to load user profile.");
      setIsLoading(false);
      return;
    }

    if (!profileData || typeof profileData !== "object") {
      setErrorMessage("User profile not found.");
      setIsLoading(false);
      return;
    }

    const profileRow = profileData as Record<string, unknown>;
    const isPrivateFromRow = pickFirstBoolean(profileRow, [
      "is_private_profile",
      "is_private",
      "private_profile"
    ]);

    const mappedProfile: PublicProfile = {
      id: String(profileRow.id ?? resolvedUserId),
      displayName:
        typeof profileRow.display_name === "string" && profileRow.display_name.trim().length > 0
          ? profileRow.display_name
          : "Unknown",
      avatarUrl: pickFirstString(profileRow, [
        "avatar_url",
        "profile_image_url",
        "avatar_image_url",
        "profile_avatar_url",
        "avatar",
        "image_url"
      ]),
      profileBackgroundUrl: pickFirstString(profileRow, [
        "profile_background_url",
        "profile_background_image_url",
        "background_image_url",
        "background_url",
        "profile_cover_url",
        "cover_url",
        "cover_image_url"
      ]),
      verifiedUniversityId:
        typeof profileRow.verified_university_id === "string" ||
        typeof profileRow.verified_university_id === "number"
          ? String(profileRow.verified_university_id)
          : null,
      isPrivateProfile: isPrivateFromRow === true,
      points:
        typeof profileRow.points === "number"
          ? profileRow.points
          : typeof profileRow.points_balance === "number"
            ? profileRow.points_balance
            : 0,
      tier:
        typeof profileRow.tier === "string"
          ? profileRow.tier
          : typeof profileRow.role === "string"
            ? profileRow.role
            : null
    };

    setProfile(mappedProfile);

    if (mappedProfile.verifiedUniversityId) {
      const { data: universityData } = await supabase
        .from("universities")
        .select("name:name_ko, short_name")
        .eq("id", mappedProfile.verifiedUniversityId)
        .maybeSingle();

      const universityRow = universityData as { name: string | null; short_name: string | null } | null;
      setVerifiedUniversity(
        universityRow
          ? {
              name: universityRow.name ?? "University",
              shortName: universityRow.short_name ?? null
            }
          : null
      );
    } else {
      setVerifiedUniversity(null);
    }

    const followState = await loadFollowState();
    if (followState) {
      setFollowerCount(followState.followerCount);
      setIsFollowing(followState.isFollowing);
    }

    const allowed =
      !mappedProfile.isPrivateProfile ||
      (viewerId !== null && viewerId === resolvedUserId) ||
      Boolean(followState?.isFollowing);

    if (!allowed) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select("id, title, body, created_at, like_count, comment_count")
      .eq("author_id", resolvedUserId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (postError) {
      setErrorMessage(postError.message);
      setPosts([]);
      setIsLoading(false);
      return;
    }

    const rows = (postData ?? []) as Array<{
      id: number;
      title: string;
      body: string;
      created_at: string;
      like_count: number | null;
      comment_count: number | null;
    }>;

    setPosts(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        likeCount: row.like_count ?? 0,
        commentCount: row.comment_count ?? 0
      }))
    );
    setIsLoading(false);
  }, [loadFollowState, resolvedUserId, viewerId]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  async function onToggleFollow() {
    if (!viewerId || !resolvedUserId || isOwnProfile || isSavingFollow) {
      return;
    }

    const wasFollowing = isFollowing;
    const nextIsFollowing = !wasFollowing;

    setErrorMessage(null);
    setIsFollowing(nextIsFollowing);
    setFollowerCount((current) =>
      nextIsFollowing ? current + 1 : Math.max(0, current - 1)
    );
    setIsSavingFollow(true);

    try {
      const tableClient = supabase as unknown as {
        from: (table: string) => {
          insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
          upsert?: (
            payload: Record<string, unknown>,
            options?: Record<string, unknown>
          ) => Promise<{ error: { message: string } | null }>;
          delete: () => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };
      };

      if (wasFollowing) {
        const { error } = await tableClient
          .from("follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("following_id", resolvedUserId);

        if (error) {
          throw new Error(error.message);
        }
      } else {
        const followsClient = tableClient.from("follows");
        const writeResult = followsClient.upsert
          ? await followsClient.upsert(
              { follower_id: viewerId, following_id: resolvedUserId },
              { onConflict: "follower_id,following_id", ignoreDuplicates: true }
            )
          : await followsClient.insert({ follower_id: viewerId, following_id: resolvedUserId });
        const error = writeResult.error;

        if (error) {
          if (/duplicate key|already exists|unique/i.test(error.message)) {
            // Keep optimistic state and reconcile below.
          } else {
            throw new Error(error.message);
          }
        }
      }

      const followState = await loadFollowState();
      if (followState) {
        setFollowerCount(followState.followerCount);
        setIsFollowing(followState.isFollowing);
      }
    } catch (error) {
      const followState = await loadFollowState();
      if (followState) {
        setFollowerCount(followState.followerCount);
        setIsFollowing(followState.isFollowing);
      } else {
        setIsFollowing(wasFollowing);
        setFollowerCount((current) =>
          wasFollowing ? current + 1 : Math.max(0, current - 1)
        );
      }
      const message = error instanceof Error ? error.message : "Follow request failed.";
      setErrorMessage(message);
    } finally {
      setIsSavingFollow(false);
    }
  }

  if (isLoading && !profile) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.helperText}>Loading profile...</Text>
      </View>
    );
  }

  if (!resolvedUserId) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>Invalid profile identifier.</Text>
      </View>
    );
  }

  if (isLockedProfile) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.privateLockCard}>
          <Ionicons name="lock-closed" size={44} color={colors.textMuted} />
          <Text style={styles.privateLockText}>비공개 유저입니다.</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {profile ? (
        <View style={styles.profileHeroStack}>
          <View style={styles.profileBackgroundCard} pointerEvents="none">
            {profile.profileBackgroundUrl ? (
              <Image
                source={{ uri: profile.profileBackgroundUrl }}
                style={styles.profileBackgroundImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.profileBackgroundFallback}>
                <View style={styles.profileBackgroundFallbackTone} />
              </View>
            )}
          </View>

          <View style={styles.profileOverlayContent}>
            <View style={styles.profileHeroTop}>
              <View style={styles.avatarCircle}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.avatarLabel}>{avatarLetter}</Text>
                )}
              </View>
              <View style={styles.profileHeroText}>
                <View style={styles.identityTextCard}>
                  <View style={styles.displayNameRow}>
                    <TierMarker value={displayTier} size={14} />
                    <Text style={styles.displayName} numberOfLines={1}>
                      {profile.displayName}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.profileSummaryPrimaryRow}>
              <TierSummaryCard value={displayTier} />
              <SummaryCard
                label="School"
                value={verifiedUniversity?.shortName ?? verifiedUniversity?.name ?? "-"}
              />
              <SummaryCard label="Followers" value={String(followerCount)} />
              {!isOwnProfile ? (
                <Pressable
                  style={[
                    styles.followActionCard,
                    isFollowing ? styles.followActionCardActive : null,
                    isSavingFollow ? styles.buttonDisabled : null
                  ]}
                  onPress={() => {
                    void onToggleFollow();
                  }}
                  disabled={isSavingFollow}
                >
                  <Ionicons
                    name={isFollowing ? "thumbs-up" : "thumbs-up-outline"}
                    size={12}
                    color={isFollowing ? "#f8fafc" : colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.followActionLabel,
                      isFollowing ? styles.followActionLabelActive : null
                    ]}
                  >
                    {isSavingFollow ? "..." : isFollowing ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>내가 쓴 글</Text>
        </View>

        {posts.length === 0 ? <Text style={styles.helperInlineText}>아직 작성한 글이 없습니다.</Text> : null}

        {posts.map((post) => {
          const preview = stripBodyPreview(post.body);
          return (
            <Link
              key={post.id}
              asChild
              href={{
                pathname: "/posts/[postId]",
                params: {
                  postId: String(post.id),
                  returnTo: userProfileReturnTo
                }
              }}
            >
              <Pressable style={styles.myPostCard}>
                <Text style={styles.myPostTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.myPostDate}>{formatDate(post.createdAt)}</Text>
                {preview ? (
                  <Text style={styles.myPostPreview} numberOfLines={2}>
                    {preview}
                  </Text>
                ) : null}
                <View style={styles.engagementRow}>
                  <View style={styles.engagementItem}>
                    <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.myPostDate}>{post.likeCount}</Text>
                  </View>
                  <View style={styles.engagementItem}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.myPostDate}>{post.commentCount}</Text>
                  </View>
                </View>
              </Pressable>
            </Link>
          );
        })}
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function TierSummaryCard({ value }: { value: string }) {
  const accent = getTierAccent(value);

  return (
    <View style={[styles.summaryPill, { borderColor: accent.borderColor }]}>
      <Text style={[styles.summaryLabel, { color: accent.labelColor }]}>Tier</Text>
      <Text style={[styles.summaryValue, { color: accent.valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  centeredContainer: {
    flex: 1,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background
  },
  helperText: {
    fontSize: typography.body,
    color: colors.textSecondary
  },
  helperInlineText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  },
  profileHeroStack: {
    position: "relative",
    minHeight: 340
  },
  profileBackgroundCard: {
    width: "100%",
    aspectRatio: 1.1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    shadowColor: "#0b1e38",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  profileBackgroundImage: {
    width: "100%",
    height: "100%"
  },
  profileBackgroundFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e9eef7"
  },
  profileBackgroundFallbackTone: {
    width: "84%",
    height: "72%",
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.35)"
  },
  profileOverlayContent: {
    position: "absolute",
    bottom: "14%",
    left: "8%",
    width: "70%",
    minWidth: 224,
    maxWidth: 260,
    gap: 6
  },
  profileHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 20
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent
  },
  profileHeroText: {
    flexShrink: 1,
    alignSelf: "flex-start"
  },
  identityTextCard: {
    alignSelf: "flex-start",
    maxWidth: 176,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.80)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  displayNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  displayName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary
  },
  profileSummaryPrimaryRow: {
    flexDirection: "row",
    gap: 3,
    alignSelf: "flex-start",
    marginTop: 3
  },
  profileSummarySecondaryRow: {
    flexDirection: "row",
    gap: 4,
    alignSelf: "flex-start"
  },
  summaryPill: {
    width: 48,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 2,
    justifyContent: "space-between"
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.textMuted
  },
  summaryValue: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPrimary
  },
  followActionCard: {
    minWidth: 68,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 3
  },
  followActionCardActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  followActionLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textPrimary
  },
  followActionLabelActive: {
    color: "#f8fafc"
  },
  privateLockCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm
  },
  privateLockText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textSecondary
  },
  infoCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  myPostCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    gap: 4
  },
  myPostTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  myPostDate: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  myPostPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8
  },
  engagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  buttonDisabled: {
    opacity: 0.65
  }
});
