import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { supabase } from "../../../../../../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../../../../../../src/ui/theme";

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
  title: string;
  body: string;
  abstract: string | null;
  thumbnailImageUrl: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  category: { slug: string | null } | null;
  images: { imageUrl: string; sortOrder: number | null }[];
};

type LogoKey = "sjtu" | "ecnu" | "sisu" | "tongji" | "fudan" | "sufe";
type DegreeKey = "bachelor" | "master" | "phd";

const LOGO_ASSETS: Record<LogoKey, ImageSourcePropType> = {
  sjtu: require("../../../../../../../assets/home/logos/sjtu.png"),
  ecnu: require("../../../../../../../assets/home/logos/ecnu.png"),
  sisu: require("../../../../../../../assets/home/logos/sisu.png"),
  tongji: require("../../../../../../../assets/home/logos/tongji.png"),
  fudan: require("../../../../../../../assets/home/logos/fudan.png"),
  sufe: require("../../../../../../../assets/home/logos/sufe.png")
};

const DEGREE_CONFIG: Record<DegreeKey, { combinedLabel: string }> = {
  bachelor: { combinedLabel: "学士 Bachelor" },
  master: { combinedLabel: "硕士 Master" },
  phd: { combinedLabel: "博士 PhD" }
};

const STUDY_CATEGORY_LABELS: Record<string, string> = {
  "study-major": "전공정보",
  "study-class-review": "수업후기",
  "study-professor-review": "교수후기",
  "study-exam-difficulty": "시험난이도",
  "study-classroom-tips": "강의실/수강팁"
};

export default function StudyCategoryDetailScreen() {
  const router = useRouter();
  const { universityId, degree, categorySlug, returnTo } = useLocalSearchParams<{
    universityId: string;
    degree: string;
    categorySlug: string;
    returnTo?: string | string[];
  }>();

  const [university, setUniversity] = useState<UniversityRow | null>(null);
  const [posts, setPosts] = useState<UniversityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedUniversityId = Array.isArray(universityId) ? universityId[0] : universityId;
  const resolvedCategorySlug = Array.isArray(categorySlug) ? categorySlug[0] : categorySlug;
  const resolvedDegree = (Array.isArray(degree) ? degree[0] : degree) as DegreeKey;
  const resolvedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  const safeReturnTo =
    resolvedReturnTo ??
    (resolvedUniversityId
      ? `/universities/${resolvedUniversityId}/study/${resolvedDegree}?returnTo=${encodeURIComponent(
          `/universities/${resolvedUniversityId}?section=study`
        )}`
      : "/(tabs)");

  const currentPageReturnTo =
    resolvedUniversityId && resolvedCategorySlug
      ? `/universities/${resolvedUniversityId}/study/${resolvedDegree}/category/${resolvedCategorySlug}?returnTo=${encodeURIComponent(
          safeReturnTo
        )}`
      : "/(tabs)";

  const categoryLabel = STUDY_CATEGORY_LABELS[resolvedCategorySlug ?? ""] ?? resolvedCategorySlug ?? "Category";

  const universityLogoSource = useMemo<ImageSourcePropType | null>(() => {
    const shortNameKey = university?.shortName?.trim().toLowerCase() as LogoKey | undefined;
    const slugKey = university?.slug?.trim().toLowerCase() as LogoKey | undefined;

    if (shortNameKey && shortNameKey in LOGO_ASSETS) {
      return LOGO_ASSETS[shortNameKey];
    }
    if (slugKey && slugKey in LOGO_ASSETS) {
      return LOGO_ASSETS[slugKey];
    }

    return null;
  }, [university?.shortName, university?.slug]);

  const onGoBack = useCallback(() => {
    if (safeReturnTo) {
      router.replace(safeReturnTo as never);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)" as never);
  }, [router, safeReturnTo]);

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

    const row = (bySlug ??
      null) as {
      id: string;
      name_ko: string;
      short_name: string | null;
      slug: string;
    } | null;

    if (row) {
      setUniversity({
        id: row.id,
        name: row.name_ko,
        shortName: row.short_name ?? null,
        slug: row.slug
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

    const rowById = (byId ??
      null) as {
      id: string;
      name_ko: string;
      short_name: string | null;
      slug: string;
    } | null;

    if (!rowById) {
      setErrorMessage("University not found.");
      setIsLoading(false);
      return;
    }

    setUniversity({
      id: rowById.id,
      name: rowById.name_ko,
      shortName: rowById.short_name ?? null,
      slug: rowById.slug
    });
  }, [resolvedUniversityId]);

  const loadPosts = useCallback(async () => {
    if (!university?.id || !resolvedCategorySlug) {
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
      created_at: string;
      categories: { slug: string | null } | null;
      post_images: Array<{ image_url: string; sort_order: number | null }> | null;
    }>;

    const filteredRows = rows.filter((row) => row.categories?.slug === resolvedCategorySlug);

    const mapped = filteredRows.map((row) => ({
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

    if (authorIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, display_name")
        .in("id", authorIds);

      if (profileError) {
        setErrorMessage(profileError.message);
        setPosts([]);
        setIsLoading(false);
        return;
      }

      (profileData ?? []).forEach((profile) => {
        displayNameMap.set(profile.id, profile.display_name ?? null);
      });
    }

    setPosts(
      mapped.map((row) => ({
        ...row,
        authorName: displayNameMap.get(row.authorId) ?? null
      }))
    );
    setIsLoading(false);
  }, [resolvedCategorySlug, resolvedDegree, university?.id]);

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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.screenHeaderRow}>
        <Pressable onPress={onGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.heading}>{university?.name ?? "University"}</Text>
        <Text style={styles.subHeading}>
          {DEGREE_CONFIG[resolvedDegree]?.combinedLabel ?? "Study"} · {categoryLabel}
        </Text>
      </View>

      {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {!isLoading && posts.length === 0 && !errorMessage ? (
        <Text style={styles.metaText}>No posts yet.</Text>
      ) : null}

      {posts.map((post) => {
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
                returnTo: currentPageReturnTo
              }
            }}
          >
            <Pressable style={styles.postCard}>
              {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} /> : null}
              <View style={styles.postContent}>
                <Text style={styles.postTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.postMeta}>{createdLabel}</Text>
                {previewText ? (
                  <Text style={styles.postPreview} numberOfLines={3}>
                    {previewText}
                  </Text>
                ) : null}
                <View style={styles.postAuthorRow}>
                  {universityLogoSource ? (
                    <Image source={universityLogoSource} style={styles.postAuthorLogo} resizeMode="contain" />
                  ) : null}
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
                </View>
              </View>
            </Pressable>
          </Link>
        );
      })}
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
    return abstract.trim().length > 160 ? `${abstract.trim().slice(0, 157)}...` : abstract.trim();
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

  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
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
  header: {
    gap: 4
  },
  heading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.textPrimary
  },
  subHeading: {
    fontSize: typography.body,
    fontWeight: "600",
    color: colors.textSecondary
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
    backgroundColor: colors.surface,
    alignItems: "flex-start"
  },
  postThumbnail: {
    width: 92,
    height: 92,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted
  },
  postContent: {
    flex: 1,
    gap: 4
  },
  postTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  postPreview: {
    fontSize: typography.body,
    color: colors.textSecondary
  },
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2
  },
  postAuthorLogo: {
    width: 16,
    height: 16
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
