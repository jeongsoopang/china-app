import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase/client";
import { CityHeroHeader } from "../../src/ui/city-hero-header";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

type LifeCategorySlug = "fun-travel" | "fun-restaurants" | "fun-church";

type LifePost = {
  id: number;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  abstract: string | null;
  thumbnailImageUrl: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  categorySlug: string | null;
  images: { imageUrl: string; sortOrder: number | null }[];
};

const LIFE_CATEGORY_TABS: Array<{ slug: LifeCategorySlug; label: string }> = [
  { slug: "fun-travel", label: "여행" },
  { slug: "fun-restaurants", label: "맛집" },
  { slug: "fun-church", label: "일상" }
];

export default function FunScreen() {
  const [selectedCategory, setSelectedCategory] = useState<LifeCategorySlug>("fun-travel");
  const [posts, setPosts] = useState<LifePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLifePosts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

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
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("sections.code", "fun")
        .in(
          "categories.slug",
          LIFE_CATEGORY_TABS.map((tab) => tab.slug)
        )
        .order("created_at", { ascending: false })
        .limit(60);
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
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("sections.code", "fun")
        .in(
          "categories.slug",
          LIFE_CATEGORY_TABS.map((tab) => tab.slug)
        )
        .order("created_at", { ascending: false })
        .limit(60);
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
      setErrorMessage(error.message);
      setPosts([]);
      setIsLoading(false);
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
      categories: { slug: string | null } | null;
      post_images: Array<{ image_url: string; sort_order: number | null }> | null;
    }>;

    const basePosts: LifePost[] = rows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: null,
      title: row.title,
      body: row.body,
      abstract: typeof row.abstract === "string" ? row.abstract : null,
      thumbnailImageUrl:
        typeof row.thumbnail_image_url === "string" ? row.thumbnail_image_url : null,
      likeCount: row.like_count ?? 0,
      commentCount: row.comment_count ?? 0,
      viewCount: row.view_count ?? 0,
      createdAt: row.created_at,
      categorySlug: row.categories?.slug ?? null,
      images: (row.post_images ?? []).map((image) => ({
        imageUrl: image.image_url,
        sortOrder: image.sort_order ?? null
      }))
    }));

    setPosts(basePosts);
    setIsLoading(false);

    const authorIds = Array.from(new Set(basePosts.map((post) => post.authorId)));
    if (authorIds.length === 0) {
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", authorIds);

    if (profileError) {
      return;
    }

    const displayNameMap = new Map<string, string | null>();
    (profileData ?? []).forEach((profile) => {
      displayNameMap.set(profile.id, profile.display_name ?? null);
    });

    setPosts((current) =>
      current.map((post) => ({
        ...post,
        authorName: displayNameMap.get(post.authorId) ?? post.authorName
      }))
    );
  }, []);

  useEffect(() => {
    void loadLifePosts();
  }, [loadLifePosts]);

  useFocusEffect(
    useCallback(() => {
      void loadLifePosts();
    }, [loadLifePosts])
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => post.categorySlug === selectedCategory);
  }, [posts, selectedCategory]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <CityHeroHeader
        title="Life"
        subtitle="여행, 맛집, 일상의 중국 생활 이야기를 확인하세요."
        height={158}
        style={styles.heroFullBleed}
      />

      <View style={styles.categoryRow}>
        {LIFE_CATEGORY_TABS.map((tab) => {
          const isActive = tab.slug === selectedCategory;
          return (
            <Pressable
              key={tab.slug}
              onPress={() => setSelectedCategory(tab.slug)}
              style={[styles.categoryChip, isActive ? styles.categoryChipActive : null]}
            >
              <Text style={[styles.categoryChipLabel, isActive ? styles.categoryChipLabelActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {!isLoading && filteredPosts.length === 0 && !errorMessage ? (
        <Text style={styles.metaText}>아직 게시글이 없습니다.</Text>
      ) : null}

      <View style={styles.listWrap}>
        {filteredPosts.map((post) => {
          const previewText = getPreviewText(post.abstract, post.body);
          const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
          return (
            <Link key={post.id} asChild href={`/posts/${post.id}`}>
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
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  heroFullBleed: {
    marginHorizontal: -spacing.lg
  },
  categoryRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  categoryChip: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    alignItems: "center",
    shadowColor: "#0b1e38",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  categoryChipLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  categoryChipLabelActive: {
    color: "#f8fafc"
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
    color: colors.textSecondary,
    lineHeight: 19
  },
  postEngagementRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginTop: 2
  },
  postEngagementItem: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center"
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
