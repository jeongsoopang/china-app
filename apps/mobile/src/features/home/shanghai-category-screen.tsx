import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase/client";
import { CityHeroHeader } from "../../ui/city-hero-header";
import { colors, radius, spacing, typography } from "../../ui/theme";

type CategoryPost = {
  id: number;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  abstract: string | null;
  createdAt: string;
  thumbnailImageUrl: string | null;
  images: { imageUrl: string; sortOrder: number | null }[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
};

type ShanghaiCategoryScreenProps = {
  title: string;
  eyebrow?: string;
  withRankedPosts: boolean;
  returnFallback: string;
  sectionCode?: "life" | "study" | "qa" | "fun" | "vlog";
  categorySlugs?: string[];
};

const EMPTY_CATEGORY_SLUGS: string[] = [];

export function ShanghaiCategoryScreen({
  title,
  eyebrow,
  withRankedPosts,
  returnFallback,
  sectionCode = "fun",
  categorySlugs = EMPTY_CATEGORY_SLUGS
}: ShanghaiCategoryScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const [posts, setPosts] = useState<CategoryPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(withRankedPosts && categorySlugs.length > 0);
  const [postsError, setPostsError] = useState<string | null>(null);
  const categorySlugKey = categorySlugs.join("|");
  const stableCategorySlugs = useMemo(() => categorySlugs, [categorySlugKey]);

  const loadPosts = useCallback(async () => {
    if (!withRankedPosts || stableCategorySlugs.length === 0) {
      setPosts([]);
      setIsLoadingPosts(false);
      setPostsError(null);
      return;
    }

    setIsLoadingPosts(true);
    setPostsError(null);

    const attemptWithMetadata = async () => {
      return supabase
        .from("posts")
        .select(
          `
          id,
          author_id,
          title,
          body,
          abstract,
          thumbnail_image_url,
          like_count,
          comment_count,
          view_count,
          created_at,
          sections!inner ( code ),
          categories!inner ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("sections.code", sectionCode)
        .in("categories.slug", stableCategorySlugs)
        .order("created_at", { ascending: false })
        .limit(120);
    };

    const attemptWithoutMetadata = async () => {
      return supabase
        .from("posts")
        .select(
          `
          id,
          author_id,
          title,
          body,
          like_count,
          comment_count,
          view_count,
          created_at,
          sections!inner ( code ),
          categories!inner ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("sections.code", sectionCode)
        .in("categories.slug", stableCategorySlugs)
        .order("created_at", { ascending: false })
        .limit(120);
    };

    let data: unknown = null;
    let error: { message: string } | null = null;

    const withMetadata = await attemptWithMetadata();
    data = withMetadata.data;
    error = withMetadata.error ? { message: withMetadata.error.message } : null;

    if (error && /column/i.test(error.message) && /abstract|thumbnail_image_url/i.test(error.message)) {
      const withoutMetadata = await attemptWithoutMetadata();
      data = withoutMetadata.data;
      error = withoutMetadata.error ? { message: withoutMetadata.error.message } : null;
    }

    if (error) {
      setPosts([]);
      setPostsError(error.message);
      setIsLoadingPosts(false);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: number;
      author_id: string;
      title: string;
      body: string;
      abstract?: string | null;
      thumbnail_image_url?: string | null;
      like_count: number | null;
      comment_count: number | null;
      view_count: number | null;
      created_at: string;
      post_images: Array<{ image_url: string; sort_order: number | null }> | null;
    }>;

    const mapped: CategoryPost[] = rows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: null,
      title: row.title,
      body: row.body,
      abstract: typeof row.abstract === "string" ? row.abstract : null,
      thumbnailImageUrl:
        typeof row.thumbnail_image_url === "string" ? row.thumbnail_image_url : null,
      createdAt: row.created_at,
      likeCount: row.like_count ?? 0,
      commentCount: row.comment_count ?? 0,
      viewCount: row.view_count ?? 0,
      images: (row.post_images ?? []).map((image) => ({
        imageUrl: image.image_url,
        sortOrder: image.sort_order ?? null
      }))
    }));

    setPosts(mapped);
    setIsLoadingPosts(false);

    const authorIds = Array.from(new Set(mapped.map((post) => post.authorId)));
    if (authorIds.length === 0) {
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", authorIds);

    if (profileError) {
      return;
    }

    const displayNameMap = new Map<string, string | null>();
    (profileRows ?? []).forEach((profile) => {
      displayNameMap.set(profile.id, profile.display_name ?? null);
    });

    setPosts((current) =>
      current.map((post) => ({
        ...post,
        authorName: displayNameMap.get(post.authorId) ?? post.authorName
      }))
    );
  }, [categorySlugKey, sectionCode, stableCategorySlugs, withRankedPosts]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts])
  );

  const rankedPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => {
        const aScore = a.likeCount * 3 + a.commentCount * 2;
        const bScore = b.likeCount * 3 + b.commentCount * 2;
        if (bScore !== aScore) {
          return bScore - aScore;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 5);
  }, [posts]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroWrap}>
        <CityHeroHeader
          eyebrow={eyebrow}
          title={title}
          height={164}
          imageOffsetY={-10}
          contentOffsetY={8}
          style={styles.heroFullBleed}
          contentStyle={styles.heroContentCentered}
        />
        <Pressable
          onPress={() => {
            if (returnTo) {
              router.replace(returnTo as never);
              return;
            }

            if (router.canGoBack()) {
              router.back();
              return;
            }

            router.replace(returnFallback as never);
          }}
          style={[styles.heroBackButton, { top: Math.max(insets.top + 6, spacing.md) }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="#f8fafc" />
          <Text style={styles.heroBackButtonLabel}>Back</Text>
        </Pressable>
      </View>

      {withRankedPosts ? (
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Ranked Posts</Text>
          {isLoadingPosts ? <Text style={styles.metaText}>Loading ranked posts...</Text> : null}
          {postsError ? <Text style={styles.errorText}>{postsError}</Text> : null}
          {!isLoadingPosts && rankedPosts.length === 0 && !postsError ? (
            <Text style={styles.metaText}>No ranked posts yet.</Text>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rankedSlider}
          >
            {(rankedPosts.length > 0 ? rankedPosts : PLACEHOLDER_RANKS).map((post, index) => {
              const thumbnailUrl = "id" in post ? getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images) : null;
              const preview = "id" in post ? getPreviewText(post.abstract, post.body) : "Ranked post preview will appear here.";
              const createdLabel = "id" in post ? formatDate(post.createdAt) : "Date";
              const authorLabel = "id" in post ? post.authorName ?? "Unknown" : "Author";

              const card = (
                <Pressable key={`rank-${index + 1}`} style={styles.rankedCard}>
                  <View style={styles.rankBadgeWrap}>
                    <Text style={styles.rankBadge}>#{index + 1}</Text>
                  </View>
                  {thumbnailUrl ? (
                    <Image source={{ uri: thumbnailUrl }} style={styles.rankedThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.rankedThumbPlaceholder}>
                      <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.rankedMeta} numberOfLines={1}>
                    {authorLabel}
                  </Text>
                  <Text style={styles.rankedMeta} numberOfLines={1}>
                    {createdLabel}
                  </Text>
                  {"id" in post ? (
                    <View style={styles.metaInline}>
                      <Ionicons name="eye-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.rankedMeta}>Views {post.viewCount}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.rankedPreview} numberOfLines={3}>
                    {preview}
                  </Text>
                </Pressable>
              );

              if ("id" in post) {
                return (
                  <Link
                    key={`rank-link-${index + 1}`}
                    asChild
                    href={{
                      pathname: "/posts/[postId]",
                      params: { postId: String(post.id), returnTo: returnFallback }
                    }}
                  >
                    {card}
                  </Link>
                );
              }

              return card;
            })}
          </ScrollView>

          <Text style={styles.sectionTitle}>Posts</Text>
          {isLoadingPosts ? <Text style={styles.metaText}>Loading posts...</Text> : null}
          {!isLoadingPosts && posts.length === 0 && !postsError ? (
            <Text style={styles.metaText}>No posts yet for this category.</Text>
          ) : null}

          <View style={styles.listWrap}>
            {posts.map((post) => {
              const previewText = getPreviewText(post.abstract, post.body);
              const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);

              return (
                <Link
                  key={`post-${post.id}`}
                  asChild
                  href={{
                    pathname: "/posts/[postId]",
                    params: { postId: String(post.id), returnTo: returnFallback }
                  }}
                >
                  <Pressable style={styles.postCard}>
                    {thumbnailUrl ? (
                      <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} resizeMode="cover" />
                    ) : (
                      <View style={styles.postThumbnailPlaceholder}>
                        <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.postContent}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {post.title}
                      </Text>
                      <Text style={styles.postMeta} numberOfLines={1}>
                        {formatDate(post.createdAt)} · {post.authorName ?? "Unknown"}
                      </Text>
                      {previewText ? (
                        <Text style={styles.postPreview} numberOfLines={3}>
                          {previewText}
                        </Text>
                      ) : null}
                      <View style={styles.postEngagementRow}>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="heart-outline" size={13} color={colors.textMuted} />
                          <Text style={styles.postMeta}>{post.likeCount}</Text>
                        </View>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
                          <Text style={styles.postMeta}>{post.commentCount}</Text>
                        </View>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="eye-outline" size={13} color={colors.textMuted} />
                          <Text style={styles.postMeta}>Views {post.viewCount}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>교회</Text>
          <Text style={styles.metaText}>
            Church category content is being prepared. This page now follows the same hero and navigation system.
          </Text>
          <View style={styles.churchPlaceholderCard}>
            <Ionicons name="business-outline" size={28} color={colors.accent} />
            <Text style={styles.churchPlaceholderLabel}>Community church guide will appear here.</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const PLACEHOLDER_RANKS = [{}, {}, {}, {}, {}] as const;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

function getPreviewText(abstract: string | null, body: string): string {
  if (abstract && abstract.trim().length > 0) {
    return abstract.trim().length > 140 ? `${abstract.trim().slice(0, 137)}...` : abstract.trim();
  }

  const text = body
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function getThumbnailUrl(
  thumbnailImageUrl: string | null,
  body: string,
  images: { imageUrl: string; sortOrder: number | null }[]
): string | null {
  if (thumbnailImageUrl) {
    return thumbnailImageUrl;
  }

  if (images.length > 0) {
    const sorted = [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return sorted[0]?.imageUrl ?? null;
  }

  const match = /<img\s+[^>]*src=["']([^"']+)["']/i.exec(body);
  return match?.[1] ?? null;
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.md
  },
  heroWrap: {
    position: "relative"
  },
  heroFullBleed: {
    marginHorizontal: 0
  },
  heroContentCentered: {
    justifyContent: "center",
    alignItems: "center"
  },
  heroBackButton: {
    position: "absolute",
    left: spacing.md,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(15,31,54,0.56)",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.36)"
  },
  heroBackButtonLabel: {
    fontSize: typography.body,
    fontWeight: "700",
    color: "#f8fafc"
  },
  sectionWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  rankedSlider: {
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  rankedCard: {
    width: 238,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.64)",
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: spacing.sm,
    gap: 6,
    shadowColor: "#0f1f36",
    shadowOpacity: 0.11,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  rankBadgeWrap: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  rankBadge: {
    fontSize: typography.caption,
    fontWeight: "800",
    color: "#f8fafc"
  },
  rankedThumb: {
    width: "100%",
    height: 122,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  rankedThumbPlaceholder: {
    width: "100%",
    height: 122,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  rankedMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  rankedPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  metaInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  listWrap: {
    gap: spacing.sm
  },
  postCard: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  postThumbnail: {
    width: 88,
    height: 88,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted
  },
  postThumbnailPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  postContent: {
    flex: 1,
    gap: 4
  },
  postTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  postPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  postEngagementRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center"
  },
  postEngagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  churchPlaceholderCard: {
    marginTop: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.58)",
    backgroundColor: "rgba(255,255,255,0.96)",
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  churchPlaceholderLabel: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.lg
  },
  metaText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  }
});
