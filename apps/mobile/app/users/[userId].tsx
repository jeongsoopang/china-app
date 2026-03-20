import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { supabase } from "../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  tier: string;
  points: number;
  is_private: boolean;
};

type ProfilePost = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  like_count: number;
  comment_count: number;
};

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const auth = useAuthSession();
  const viewerId = auth.user?.authUser.id ?? null;
  const resolvedUserId = Array.isArray(userId) ? userId[0] : userId;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSelf = Boolean(viewerId && resolvedUserId && viewerId === resolvedUserId);
  const isPrivateLocked = Boolean(profile?.is_private && !isSelf);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!resolvedUserId) {
        setErrorMessage("Invalid user id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const [{ data: profileData, error: profileError }, followerResult, followingResult] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("id, display_name, avatar_url, tier, points, is_private")
          .eq("id", resolvedUserId)
          .maybeSingle(),
        supabase
          .from("user_follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", resolvedUserId),
        supabase
          .from("user_follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", resolvedUserId)
      ]);

      if (cancelled) {
        return;
      }

      if (profileError) {
        setErrorMessage(profileError.message);
        setIsLoading(false);
        return;
      }

      const row = profileData as ProfileRow | null;
      setProfile(row);
      setFollowerCount(followerResult.count ?? 0);
      setFollowingCount(followingResult.count ?? 0);

      if (!row) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      if (viewerId && !isSelf) {
        const { data: relation } = await supabase
          .from("user_follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("following_id", resolvedUserId)
          .maybeSingle();

        if (!cancelled) {
          setIsFollowing(Boolean(relation));
        }
      } else {
        setIsFollowing(false);
      }

      if (row.is_private && !isSelf) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("id, title, body, created_at, like_count, comment_count")
        .eq("author_id", resolvedUserId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (cancelled) {
        return;
      }

      if (postsError) {
        setErrorMessage(postsError.message);
        setPosts([]);
        setIsLoading(false);
        return;
      }

      setPosts((postsData ?? []) as ProfilePost[]);
      setIsLoading(false);
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [isSelf, resolvedUserId, viewerId]);

  async function toggleFollow() {
    if (!viewerId || !resolvedUserId || isSelf || isTogglingFollow) {
      return;
    }

    setIsTogglingFollow(true);
    setErrorMessage(null);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("following_id", resolvedUserId);

        if (error) {
          throw error;
        }

        setIsFollowing(false);
        setFollowerCount((count) => Math.max(0, count - 1));
      } else {
        const { error } = await supabase.from("user_follows").insert({
          follower_id: viewerId,
          following_id: resolvedUserId
        });

        if (error) {
          throw error;
        }

        setIsFollowing(true);
        setFollowerCount((count) => count + 1);
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Follow request failed.");
      }
    } finally {
      setIsTogglingFollow(false);
    }
  }

  const avatarLetter = useMemo(() => {
    const base = profile?.display_name ?? "U";
    return base.trim().charAt(0).toUpperCase() || "U";
  }, [profile?.display_name]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.metaText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.errorText}>{errorMessage ?? "User not found."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLabel}>{avatarLetter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nameText}>{profile.display_name}</Text>
            <Text style={styles.metaText}>Tier · {profile.tier}</Text>
          </View>
          {!isSelf ? (
            <Pressable
              onPress={toggleFollow}
              disabled={isTogglingFollow}
              style={[styles.followButton, isFollowing && styles.followButtonActive]}
            >
              <Text style={[styles.followButtonLabel, isFollowing && styles.followButtonLabelActive]}>
                {isTogglingFollow ? "..." : isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.countRow}>
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>Followers</Text>
            <Text style={styles.countValue}>{followerCount}</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>Following</Text>
            <Text style={styles.countValue}>{followingCount}</Text>
          </View>
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>Points</Text>
            <Text style={styles.countValue}>{profile.points}</Text>
          </View>
        </View>
      </View>

      {isPrivateLocked ? (
        <View style={styles.lockCard}>
          <Ionicons name="lock-closed" size={30} color={colors.textMuted} />
          <Text style={styles.lockText}>비공개 유저입니다.</Text>
        </View>
      ) : (
        <View style={styles.postList}>
          <Text style={styles.sectionTitle}>Posts</Text>
          {posts.length === 0 ? <Text style={styles.metaText}>아직 작성한 글이 없습니다.</Text> : null}
          {posts.map((post) => (
            <Link
              key={post.id}
              asChild
              href={{
                pathname: "/posts/[postId]",
                params: {
                  postId: String(post.id),
                  returnTo: `/users/${resolvedUserId}`
                }
              }}
            >
              <Pressable style={styles.postCard}>
                <Text style={styles.postTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.metaText}>{formatDate(post.created_at)}</Text>
                <Text style={styles.postPreview} numberOfLines={2}>
                  {stripBody(post.body)}
                </Text>
                <View style={styles.engagementRow}>
                  <Text style={styles.metaText}>❤️ {post.like_count ?? 0}</Text>
                  <Text style={styles.metaText}>💬 {post.comment_count ?? 0}</Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </ScrollView>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

function stripBody(value: string): string {
  return value
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  heading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.textPrimary
  },
  profileCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong
  },
  avatarLabel: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.accent
  },
  nameText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  countRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  countPill: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  countLabel: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  countValue: {
    marginTop: 2,
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  followButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  followButtonActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted
  },
  followButtonLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.accent
  },
  followButtonLabelActive: {
    color: colors.textPrimary
  },
  lockCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 26,
    alignItems: "center",
    gap: 8
  },
  lockText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textSecondary
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postList: {
    gap: spacing.sm
  },
  postCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 4
  },
  postTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18
  },
  engagementRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  metaText: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  }
});
