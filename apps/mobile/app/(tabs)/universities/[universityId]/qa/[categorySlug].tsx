import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
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

const QA_CATEGORY_LABELS: Record<string, string> = {
  "qa-facilities": "시설",
  "qa-dorm": "기숙사",
  "qa-study": "학업"
};

export default function UniversityQaCategoryScreen() {
  const { universityId, categorySlug, returnTo } = useLocalSearchParams<{
    universityId: string;
    categorySlug: string;
    returnTo?: string | string[];
  }>();

  const [university, setUniversity] = useState<UniversityRow | null>(null);
  const [posts, setPosts] = useState<UniversityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedUniversityId = Array.isArray(universityId) ? universityId[0] : universityId;
  const resolvedCategorySlug = Array.isArray(categorySlug) ? categorySlug[0] : categorySlug;
  const resolvedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  const safeReturnTo =
    resolvedReturnTo ??
    (resolvedUniversityId ? `/universities/${resolvedUniversityId}?section=qa` : "/(tabs)");

  const currentPageReturnTo =
    resolvedUniversityId && resolvedCategorySlug
      ? `/universities/${resolvedUniversityId}/qa/${resolvedCategorySlug}?returnTo=${encodeURIComponent(
          safeReturnTo
        )}`
      : "/(tabs)";

  const categoryLabel =
    QA_CATEGORY_LABELS[resolvedCategorySlug ?? ""] ?? resolvedCategorySlug ?? "Q&A";

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

    const row = (bySlug ?? null) as
      | {
          id: string;
          name_ko: string;
          short_name: string | null;
          slug: string;
        }
      | null;

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

    const rowById = (byId ?? null) as
      | {
          id: string;
          name_ko: string;
          short_name: string | null;
          slug: string;
        }
      | null;

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
        .eq("sections.code", "qa")
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
        .eq("university_id", university.id)
        .eq("sections.code", "qa")
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

    const filteredRows = rows.filter((row) => row.categories?.slug === resolvedCategorySlug);

    const mapped = filteredRows.map((row) => ({
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
  }, [resolvedCategorySlug, university?.id]);

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
      <View style={styles.header}>
        <Text style={styles.heading}>{university?.name ?? "University"}</Text>
        <Text style={styles.subHeading}>Q&A · {categoryLabel}</Text>
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
              pathname: "/qa/[qaId]",
              params: {
                qaId: String(post.id),
                universityId: resolvedUniversityId ?? "",
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
                  <TierMarker value={post.authorTier} size={18} />
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
    return abstract.trim();
  }

  const withoutImages = body.replace(/<img[^>]*>/gi, " ");
  const withoutParagraphTags = withoutImages.replace(/<\/?p>/gi, " ");
  const withoutHtml = withoutParagraphTags.replace(/<[^>]+>/g, " ");
  const normalized = withoutHtml.replace(/\s+/g, " ").trim();

  return normalized;
}

function getThumbnailUrl(
  thumbnailImageUrl: string | null,
  body: string,
  images: { imageUrl: string; sortOrder: number | null }[]
): string | null {
  if (thumbnailImageUrl) {
    return thumbnailImageUrl;
  }

  const bodyMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(body);
  if (bodyMatch?.[1]) {
    return bodyMatch[1];
  }

  if (images.length > 0) {
    const sorted = [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return sorted[0]?.imageUrl ?? null;
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
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
  postCard: {
    flexDirection: "row",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: 12
  },
  postThumbnail: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  postContent: {
    flex: 1,
    gap: 6
  },
  postTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20
  },
  postMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  postAuthorName: {
    flex: 1,
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  postEngagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
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
