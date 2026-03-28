import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { supabase } from "../../../../../src/lib/supabase/client";
import { TierMarker, resolveTierMarkerValue } from "../../../../../src/ui/tier-marker";
import { colors, radius, spacing, typography } from "../../../../../src/ui/theme";

type UniversityRow = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
};

type UniversityPost = {
  id: number;
  authorId: string;
  authorName: string | null;
  authorTier: string | null;
  title: string;
  body: string;
  abstract: string | null;
  thumbnailImageUrl: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  category: { slug: string | null } | null;
  images: { imageUrl: string; sortOrder: number | null }[];
};

type DegreeKey = "bachelor" | "master" | "phd";

const DEGREE_CONFIG: Record<
  DegreeKey,
  { combinedLabel: string; chipLabel: string; imageSource: ImageSourcePropType }
> = {
  bachelor: {
    combinedLabel: "学士 Bachelor",
    chipLabel: "学士",
    imageSource: require("../../../../../assets/study/study-bachelor.png")
  },
  master: {
    combinedLabel: "硕士 Master",
    chipLabel: "硕士",
    imageSource: require("../../../../../assets/study/study-master.png")
  },
  phd: {
    combinedLabel: "博士 PhD",
    chipLabel: "博士",
    imageSource: require("../../../../../assets/study/study-phd.png")
  }
};

const DEGREE_TABS: DegreeKey[] = ["bachelor", "master", "phd"];

const STUDY_CATEGORY_ORDER = [
  "study-major",
  "study-class-review",
  "study-professor-review",
  "study-exam-difficulty",
  "study-classroom-tips"
] as const;

const STUDY_CATEGORY_LABELS: Record<string, string> = {
  "study-major": "전공정보",
  "study-class-review": "수업후기",
  "study-professor-review": "교수후기",
  "study-exam-difficulty": "시험난이도",
  "study-classroom-tips": "강의실/수강팁"
};

export default function UniversityStudyDegreeScreen() {
  const router = useRouter();
  const { universityId, degree, returnTo } = useLocalSearchParams<{
    universityId: string;
    degree: string;
    returnTo?: string | string[];
  }>();

  const [university, setUniversity] = useState<UniversityRow | null>(null);
  const [posts, setPosts] = useState<UniversityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedUniversityId = useMemo(() => {
    if (!universityId) {
      return null;
    }
    return Array.isArray(universityId) ? universityId[0] : universityId;
  }, [universityId]);

  const resolvedDegree = useMemo<DegreeKey>(() => {
    const raw = Array.isArray(degree) ? degree[0] : degree;
    if (raw === "master" || raw === "phd") {
      return raw;
    }
    return "bachelor";
  }, [degree]);

  const resolvedReturnTo = useMemo(() => {
    const raw = Array.isArray(returnTo) ? returnTo[0] : returnTo;
    if (raw && raw.length > 0) {
      return raw;
    }
    return resolvedUniversityId
      ? `/universities/${resolvedUniversityId}?section=study`
      : "/(tabs)";
  }, [returnTo, resolvedUniversityId]);

  const currentStudyDetailReturnTo = useMemo(() => {
    if (!resolvedUniversityId) {
      return "/(tabs)";
    }

    return `/universities/${resolvedUniversityId}/study/${resolvedDegree}?returnTo=${encodeURIComponent(
      resolvedReturnTo
    )}`;
  }, [resolvedDegree, resolvedReturnTo, resolvedUniversityId]);

  const degreeConfig = DEGREE_CONFIG[resolvedDegree];

  const onGoBack = useCallback(() => {
    if (resolvedReturnTo) {
      router.replace(resolvedReturnTo as never);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)" as never);
  }, [resolvedReturnTo, router]);

  const groupedPosts = useMemo(() => {
    const bucket = new Map<string, UniversityPost[]>();

    STUDY_CATEGORY_ORDER.forEach((slug) => {
      bucket.set(slug, []);
    });

    posts.forEach((post) => {
      const slug = post.category?.slug ?? "";
      if (!bucket.has(slug)) {
        bucket.set(slug, []);
      }
      bucket.get(slug)?.push(post);
    });

    return bucket;
  }, [posts]);

  const loadUniversity = useCallback(async () => {
    if (!resolvedUniversityId) {
      setErrorMessage("Invalid university identifier.");
      setIsLoading(false);
      return;
    }

    const { data: bySlug, error: slugError } = await supabase
      .from("universities")
      .select("id, name_ko, short_name, slug")
      .eq("slug", resolvedUniversityId)
      .maybeSingle();

    if (slugError) {
      setErrorMessage(slugError.message);
      setIsLoading(false);
      return;
    }

    const bySlugRow = bySlug as
      | {
          id: string;
          name_ko: string;
          short_name: string | null;
          slug: string;
        }
      | null;

    if (bySlugRow) {
      setUniversity({
        id: bySlugRow.id,
        name: bySlugRow.name_ko,
        shortName: bySlugRow.short_name ?? null,
        slug: bySlugRow.slug
      });
      return;
    }

    const { data: byId, error: idError } = await supabase
      .from("universities")
      .select("id, name_ko, short_name, slug")
      .eq("id", resolvedUniversityId)
      .maybeSingle();

    if (idError) {
      setErrorMessage(idError.message);
      setIsLoading(false);
      return;
    }

    const byIdRow = byId as
      | {
          id: string;
          name_ko: string;
          short_name: string | null;
          slug: string;
        }
      | null;

    if (!byIdRow) {
      setErrorMessage("University not found.");
      setIsLoading(false);
      return;
    }

    setUniversity({
      id: byIdRow.id,
      name: byIdRow.name_ko,
      shortName: byIdRow.short_name ?? null,
      slug: byIdRow.slug
    });
  }, [resolvedUniversityId]);

  const loadPosts = useCallback(async () => {
    if (!university?.id) {
      return;
    }

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
          degree,
          like_count,
          comment_count,
          view_count,
          created_at,
          sections!inner ( code ),
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("university_id", university.id)
        .eq("sections.code", "study")
        .eq("degree", resolvedDegree)
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
          degree,
          like_count,
          comment_count,
          view_count,
          created_at,
          sections!inner ( code ),
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("university_id", university.id)
        .eq("sections.code", "study")
        .eq("degree", resolvedDegree)
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
      degree?: string | null;
      like_count: number | null;
      comment_count: number | null;
      view_count: number | null;
      created_at: string;
      categories: { slug: string | null } | null;
      post_images: Array<{ image_url: string; sort_order: number | null }> | null;
    }>;

    const mapped = rows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: null,
      authorTier: null,
      title: row.title,
      body: row.body,
      abstract: typeof row.abstract === "string" ? row.abstract : null,
      thumbnailImageUrl:
        typeof row.thumbnail_image_url === "string" ? row.thumbnail_image_url : null,
      likeCount: row.like_count ?? 0,
      commentCount: row.comment_count ?? 0,
      viewCount: row.view_count ?? 0,
      createdAt: row.created_at,
      category: row.categories ? { slug: row.categories.slug ?? null } : null,
      images: ((row.post_images ?? []) as Array<{ image_url: string; sort_order: number | null }>).map(
        (image) => ({
          imageUrl: image.image_url,
          sortOrder: image.sort_order ?? null
        })
      )
    }));

    const authorIds = Array.from(new Set(mapped.map((row) => row.authorId)));
    const displayNameMap = new Map<string, string | null>();
    const tierMap = new Map<string, string | null>();

    if (authorIds.length > 0) {
      const withTierProfilesResult = await supabase
        .from("user_profiles")
        .select("id, display_name, tier, role")
        .in("id", authorIds);
      let profileData = (withTierProfilesResult.data ?? null) as
        | Array<{ id: string; display_name?: string | null; tier?: string | null; role?: string | null }>
        | null;
      let profileError = withTierProfilesResult.error;

      if (profileError && /column/i.test(profileError.message) && /tier/i.test(profileError.message)) {
        const withoutTierProfilesResult = await supabase
          .from("user_profiles")
          .select("id, display_name, role")
          .in("id", authorIds);
        profileData = (withoutTierProfilesResult.data ?? null) as
          | Array<{ id: string; display_name?: string | null; tier?: string | null; role?: string | null }>
          | null;
        profileError = withoutTierProfilesResult.error;
      }

      if (profileError) {
        setErrorMessage(profileError.message);
        setPosts([]);
        setIsLoading(false);
        return;
      }

      (profileData ?? []).forEach((profile) => {
        displayNameMap.set(profile.id, profile.display_name ?? null);
        tierMap.set(profile.id, resolveTierMarkerValue(profile.tier, profile.role));
      });
    }

    setPosts(
      mapped.map((row) => ({
        ...row,
        authorName: displayNameMap.get(row.authorId) ?? null,
        authorTier: tierMap.get(row.authorId) ?? null
      }))
    );
    setIsLoading(false);
  }, [resolvedDegree, university?.id]);

  useEffect(() => {
    void loadUniversity();
  }, [loadUniversity]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.screenHeaderRow}>
        <Pressable onPress={onGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.headerTopRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.heading}>{university?.name ?? "University"}</Text>
          <Text style={styles.degreeTitle}>{degreeConfig.combinedLabel}</Text>
        </View>

        <Image source={degreeConfig.imageSource} resizeMode="contain" style={styles.headerDegreeImage} />
      </View>

      <View style={styles.tabRow}>
        {DEGREE_TABS.map((tab) => (
          <Link
            key={tab}
            asChild
            href={{
              pathname: "/universities/[universityId]/study/[degree]",
              params: {
                universityId: resolvedUniversityId ?? "",
                degree: tab,
                returnTo: resolvedReturnTo
              }
            }}
          >
            <Pressable
              style={[
                styles.degreeChip,
                resolvedDegree === tab && styles.degreeChipSelected
              ]}
            >
              <Ionicons
                name="school-outline"
                size={14}
                color={resolvedDegree === tab ? colors.background : colors.textPrimary}
              />
              <Text
                style={[
                  styles.degreeChipLabel,
                  resolvedDegree === tab && styles.degreeChipLabelSelected
                ]}
                numberOfLines={1}
              >
                {DEGREE_CONFIG[tab].chipLabel}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>

      {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {STUDY_CATEGORY_ORDER.map((slug) => {
        const list = groupedPosts.get(slug) ?? [];
        const previewPosts = list.slice(0, 2);
        const label = STUDY_CATEGORY_LABELS[slug] ?? slug;

        return (
          <View key={slug} style={styles.categoryCard}>
            <View style={styles.categoryHeaderRow}>
              <View>
                <Text style={styles.categoryTitle}>{label}</Text>
                <Text style={styles.categoryMeta}>{list.length} Postings</Text>
              </View>

              <Link
                asChild
                href={{
                  pathname: "/universities/[universityId]/study/[degree]/category/[categorySlug]",
                  params: {
                    universityId: resolvedUniversityId ?? "",
                    degree: resolvedDegree,
                    categorySlug: slug,
                    returnTo: currentStudyDetailReturnTo
                  }
                }}
              >
                <Pressable style={styles.moreButton}>
                  <Text style={styles.moreButtonLabel}>More</Text>
                </Pressable>
              </Link>
            </View>

            {previewPosts.length === 0 ? (
              <Text style={styles.metaText}>No posts yet.</Text>
            ) : (
              <View style={styles.categoryPreviewList}>
                {previewPosts.map((post) => {
                  const previewText = getPreviewText(post.abstract, post.body);
                  const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
                  const createdLabel = formatDate(post.createdAt);

                  return (
                    <Link
                      key={post.id}
                      asChild
                      href={{
                        pathname: "/posts/[postId]",
                        params: {
                          postId: String(post.id),
                          returnTo: currentStudyDetailReturnTo
                        }
                      }}
                    >
                      <Pressable style={styles.postCard}>
                        {thumbnailUrl ? (
                          <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} />
                        ) : null}
                        <View style={styles.postContent}>
                          <Text style={styles.postTitle} numberOfLines={2}>
                            {post.title}
                          </Text>
                          {previewText ? (
                            <Text style={styles.postPreview} numberOfLines={2}>
                              {previewText}
                            </Text>
                          ) : null}
                          <Text style={styles.postMeta}>{createdLabel}</Text>
                          <View style={styles.postAuthorRow}>
                            <TierMarker value={post.authorTier} size={16} />
                            <Text style={styles.postAuthorName} numberOfLines={1}>
                              {post.authorName ?? "Unknown"}
                            </Text>
                          </View>
                          <View style={styles.postEngagementRow}>
                            <View style={styles.postEngagementItem}>
                              <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                              <Text style={styles.postMeta}>{post.likeCount}</Text>
                            </View>
                            <View style={styles.postEngagementItem}>
                              <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                              <Text style={styles.postMeta}>{post.commentCount}</Text>
                            </View>
                            <View style={styles.postEngagementItem}>
                              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
                              <Text style={styles.postMeta}>Views {post.viewCount}</Text>
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    </Link>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
      </ScrollView>
    </SafeAreaView>
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
    return abstract.trim().length > 120 ? `${abstract.trim().slice(0, 117)}...` : abstract.trim();
  }

  if (!body) {
    return "";
  }

  const text = body
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
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
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  screenHeaderRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  backButtonLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  headerTextWrap: {
    flex: 1,
    justifyContent: "center"
  },
  heading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.textPrimary
  },
  degreeTitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 4
  },
  headerDegreeImage: {
    width: 88,
    height: 96
  },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs
  },
  degreeChip: {
    width: "31%",
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  degreeChipSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary
  },
  degreeChipLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  degreeChipLabelSelected: {
    color: colors.background
  },
  categoryCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  categoryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  categoryTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  categoryMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  moreButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  moreButtonLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textPrimary
  },
  categoryPreviewList: {
    gap: spacing.sm
  },
  metaText: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.caption,
    color: colors.error
  },
  postCard: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "flex-start"
  },
  postThumbnail: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.surface
  },
  postContent: {
    flex: 1,
    gap: 4
  },
  postTitle: {
    fontSize: 16,
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
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2
  },
  postAuthorName: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontWeight: "600"
  },
  postEngagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: 4
  },
  postEngagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  }
});
