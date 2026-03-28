import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CityHeroHeader } from "../../ui/city-hero-header";
import { colors, radius, spacing, typography } from "../../ui/theme";
import {
  fetchShanghaiPosts,
  formatDate,
  getPreviewText,
  getThumbnailUrl,
  type ShanghaiPost
} from "./shanghai-posts";

type SubcategoryOption = {
  slug: string;
  label: string;
};

type ShanghaiPostListScreenProps = {
  title: string;
  returnFallback: string;
  baseCategorySlugs?: string[];
  subcategories?: SubcategoryOption[];
};

const EMPTY_SUBCATEGORIES: SubcategoryOption[] = [];

export function ShanghaiPostListScreen({
  title,
  returnFallback,
  baseCategorySlugs,
  subcategories = EMPTY_SUBCATEGORIES
}: ShanghaiPostListScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState(
    subcategories[0]?.slug ?? null
  );
  const [searchText, setSearchText] = useState("");
  const [posts, setPosts] = useState<ShanghaiPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveCategorySlugs = useMemo(() => {
    if (subcategories.length > 0) {
      return selectedSubcategorySlug ? [selectedSubcategorySlug] : [];
    }

    return baseCategorySlugs ?? [];
  }, [baseCategorySlugs, selectedSubcategorySlug, subcategories.length]);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextPosts = await fetchShanghaiPosts({
        categorySlugs: effectiveCategorySlugs,
        searchText,
        limit: 160
      });
      setPosts(nextPosts);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load Shanghai posts for this category.";
      setPosts([]);
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveCategorySlugs, searchText]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts])
  );

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroWrap}>
        <CityHeroHeader
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

      <View style={styles.bodyWrap}>
        {subcategories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {subcategories.map((category) => {
              const isActive = category.slug === selectedSubcategorySlug;
              return (
                <Pressable
                  key={category.slug}
                  onPress={() => setSelectedSubcategorySlug(category.slug)}
                  style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipLabel, isActive ? styles.filterChipLabelActive : null]}>
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="검색어를 입력하세요"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => {
              void loadPosts();
            }}
          />
          <Pressable onPress={() => void loadPosts()} style={styles.searchButton}>
            <Text style={styles.searchButtonLabel}>검색</Text>
          </Pressable>
        </View>

        {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {!isLoading && !errorMessage && posts.length === 0 ? (
          <Text style={styles.metaText}>No posts matched your filter.</Text>
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
    </ScrollView>
  );
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
  bodyWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  filterRow: {
    gap: spacing.xs,
    paddingBottom: spacing.xs
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  filterChipLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    color: colors.textSecondary
  },
  filterChipLabelActive: {
    color: "#f8fafc"
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.64)",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: spacing.md,
    paddingVertical: 10
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    color: colors.textPrimary,
    paddingVertical: 0
  },
  searchButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  searchButtonLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: "#f8fafc"
  },
  listWrap: {
    gap: spacing.sm,
    marginTop: spacing.xs
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
  metaText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  }
});
