import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchShanghaiPosts,
  formatDate,
  getCardThumbnailUrl,
  getPreviewText,
  rankShanghaiPosts,
  type ShanghaiPost
} from "../../../src/features/home/shanghai-posts";
import { CityHeroHeader } from "../../../src/ui/city-hero-header";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

type ShanghaiMainCategory = {
  key: "food" | "place" | "church";
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageSource: ImageSourcePropType;
  route: string;
  categorySlugs: string[];
};

const SHANGHAI_CATEGORIES: ShanghaiMainCategory[] = [
  {
    key: "place",
    label: "Place",
    subtitle: "Shanghai spots and landmarks",
    icon: "compass-outline",
    imageSource: require("../../../assets/home/cards/shanghai-place-card.jpg"),
    route: "/home/shanghai-place",
    categorySlugs: ["fun-place"]
  },
  {
    key: "food",
    label: "Food",
    subtitle: "카페·중식·양식·한식·일식·기타",
    icon: "restaurant-outline",
    imageSource: require("../../../assets/home/cards/shanghai-food-card.jpg"),
    route: "/home/shanghai-food",
    categorySlugs: [
      "fun-food-cafe",
      "fun-food-chinese",
      "fun-food-western",
      "fun-food-korean",
      "fun-food-japanese",
      "fun-food-other"
    ]
  },
  {
    key: "church",
    label: "Church",
    subtitle: "소개 and 공지",
    icon: "business-outline",
    imageSource: require("../../../assets/home/cards/shanghai-church-card.jpg"),
    route: "/home/shanghai-church",
    categorySlugs: ["fun-church-notice"]
  }
];

export default function ShanghaiExploreScreen() {
  const router = useRouter();
  const cardScrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;

  const [selectedCategoryKey, setSelectedCategoryKey] = useState<ShanghaiMainCategory["key"]>("food");
  const [rankedPosts, setRankedPosts] = useState<ShanghaiPost[]>([]);
  const [isLoadingRanked, setIsLoadingRanked] = useState(true);
  const [rankedError, setRankedError] = useState<string | null>(null);

  const selectedCategory = useMemo(() => {
    return SHANGHAI_CATEGORIES.find((item) => item.key === selectedCategoryKey) ?? SHANGHAI_CATEGORIES[0];
  }, [selectedCategoryKey]);

  const sliderCardWidth = Math.min(Math.max(width - 122, 236), 282);
  const sliderGap = spacing.sm;
  const sliderSnap = sliderCardWidth + sliderGap;
  const sliderSidePadding = Math.max((width - sliderCardWidth) / 2, spacing.lg);

  useEffect(() => {
    const centerIndex = SHANGHAI_CATEGORIES.findIndex((item) => item.key === "food");
    if (centerIndex < 0) {
      return;
    }

    const timeout = setTimeout(() => {
      cardScrollRef.current?.scrollTo({
        x: sliderSnap * centerIndex,
        y: 0,
        animated: false
      });
    }, 10);

    return () => clearTimeout(timeout);
  }, [sliderSnap]);

  const loadRankedPosts = useCallback(async () => {
    setIsLoadingRanked(true);
    setRankedError(null);

    try {
      const posts = await fetchShanghaiPosts({
        categorySlugs: selectedCategory.categorySlugs,
        limit: 24
      });
      setRankedPosts(
        selectedCategory.key === "church"
          ? posts.slice(0, 3)
          : rankShanghaiPosts(posts, 3)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load ranked posts.";
      setRankedError(message);
      setRankedPosts([]);
    } finally {
      setIsLoadingRanked(false);
    }
  }, [selectedCategory.categorySlugs]);

  useFocusEffect(
    useCallback(() => {
      void loadRankedPosts();
    }, [loadRankedPosts])
  );

  useEffect(() => {
    rankedPosts.slice(0, 3).forEach((post) => {
      const thumbnailUrl = getCardThumbnailUrl(post.thumbnailImageUrl);
      if (thumbnailUrl) {
        void Image.prefetch(thumbnailUrl);
      }
    });
  }, [rankedPosts]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroWrap}>
        <CityHeroHeader
          eyebrow="Everything About"
          title="Shanghai"
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

            router.replace("/(tabs)" as never);
          }}
          style={[styles.heroBackButton, { top: Math.max(insets.top + 6, spacing.md) }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="#f8fafc" />
          <Text style={styles.heroBackButtonLabel}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Explore Categories</Text>
        <ScrollView
          ref={cardScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={sliderSnap}
          snapToAlignment="start"
          contentContainerStyle={[
            styles.categorySlider,
            { gap: sliderGap, paddingHorizontal: sliderSidePadding }
          ]}
          onMomentumScrollEnd={(event) => {
            const offsetX = event.nativeEvent.contentOffset.x;
            const index = Math.max(0, Math.min(SHANGHAI_CATEGORIES.length - 1, Math.round(offsetX / sliderSnap)));
            const next = SHANGHAI_CATEGORIES[index];
            if (next && next.key !== selectedCategoryKey) {
              setSelectedCategoryKey(next.key);
            }
          }}
        >
          {SHANGHAI_CATEGORIES.map((item) => {
            const isActive = item.key === selectedCategory.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  setSelectedCategoryKey(item.key);
                  router.push({
                    pathname: item.route as never,
                    params: { returnTo: "/home/shanghai" }
                  });
                }}
                style={[styles.categoryPosterCard, { width: sliderCardWidth }, isActive ? styles.categoryPosterCardActive : null]}
              >
                <Image source={item.imageSource} style={styles.categoryPosterImage} resizeMode="cover" />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>
          {selectedCategory.key === "church" ? "Recent 3 Posts" : `${selectedCategory.label} Top 3`}
        </Text>
        {isLoadingRanked ? <Text style={styles.metaText}>Loading ranked posts...</Text> : null}
        {rankedError ? <Text style={styles.errorText}>{rankedError}</Text> : null}
        {!isLoadingRanked && rankedPosts.length === 0 && !rankedError ? (
          <Text style={styles.metaText}>No ranked posts yet.</Text>
        ) : null}

        <View style={styles.top3List}>
          {rankedPosts.map((post, index) => {
            const thumbnailUrl = getCardThumbnailUrl(post.thumbnailImageUrl);
            const preview = getPreviewText(post.abstract, post.body);
            return (
              <Link
                key={`rank-${post.id}`}
                asChild
                href={{
                  pathname: "/posts/[postId]",
                  params: { postId: String(post.id), returnTo: "/home/shanghai" }
                }}
              >
                <Pressable style={styles.rankCard}>
                  <View style={styles.rankBadgeWrap}>
                    <Text style={styles.rankBadge}>#{index + 1}</Text>
                  </View>
                  {thumbnailUrl ? (
                    <Image source={{ uri: thumbnailUrl }} style={styles.rankThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.rankThumbPlaceholder}>
                      <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.rankContent}>
                    <Text style={styles.rankTitle} numberOfLines={2}>
                      {post.title}
                    </Text>
                    <Text style={styles.rankMeta} numberOfLines={1}>
                      {formatDate(post.createdAt)} · {post.authorName ?? "Unknown"}
                    </Text>
                    <Text style={styles.rankPreview} numberOfLines={2}>
                      {preview}
                    </Text>
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
  sectionWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  categorySlider: {
    paddingRight: spacing.lg
  },
  categoryPosterCard: {
    borderRadius: radius.xl,
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.6)",
    overflow: "hidden",
    shadowColor: "#0f1f36",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4
  },
  categoryPosterCardActive: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    transform: [{ scale: 1.01 }]
  },
  categoryPosterImage: {
    width: "100%",
    height: "100%"
  },
  top3List: {
    gap: spacing.sm
  },
  rankCard: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    alignItems: "center"
  },
  rankBadgeWrap: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start"
  },
  rankBadge: {
    fontSize: typography.caption,
    fontWeight: "800",
    color: "#f8fafc"
  },
  rankThumb: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted
  },
  rankThumbPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center"
  },
  rankContent: {
    flex: 1,
    gap: 4
  },
  rankTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  rankMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  rankPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
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
