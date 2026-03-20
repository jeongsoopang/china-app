import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase/client";

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
  section: { slug: string | null } | null;
  category: { slug: string | null } | null;
  images: { imageUrl: string; sortOrder: number | null }[];
};

type SectionFilter = "all" | "life" | "study" | "qa";

export default function UniversityDetailScreen() {
  const { universityId } = useLocalSearchParams<{ universityId: string }>();
  const [university, setUniversity] = useState<UniversityRow | null>(null);
  const [posts, setPosts] = useState<UniversityPost[]>([]);
  const [filter, setFilter] = useState<SectionFilter>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);

  const resolvedUniversityId = useMemo(() => {
    if (!universityId) {
      return null;
    }

    return Array.isArray(universityId) ? universityId[0] : universityId;
  }, [universityId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUniversity() {
      if (!resolvedUniversityId) {
        setErrorMessage("Invalid university identifier.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const { data: bySlug, error: slugError } = await supabase
        .from("universities")
        .select("id, name_ko, name_en, short_name, slug")
        .eq("slug", resolvedUniversityId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (slugError) {
        setErrorMessage(slugError.message);
        setIsLoading(false);
        return;
      }

      const bySlugRow = bySlug as unknown as {
        id: string;
        name_ko: string;
        short_name: string | null;
        slug: string;
      } | null;

      if (bySlugRow) {
        setUniversity({
          id: bySlugRow.id,
          name: bySlugRow.name_ko,
          shortName: bySlugRow.short_name ?? null,
          slug: bySlugRow.slug
        });
        setIsLoading(false);
        return;
      }

      const numericUniversityId = /^\d+$/.test(resolvedUniversityId)
        ? Number(resolvedUniversityId)
        : null;

      if (numericUniversityId === null) {
        setErrorMessage("University not found.");
        setIsLoading(false);
        return;
      }

      const { data: byId, error: idError } = await supabase
        .from("universities")
        .select("id, name_ko, name_en, short_name, slug")
        .eq("id", resolvedUniversityId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (idError) {
        setErrorMessage(idError.message);
        setIsLoading(false);
        return;
      }

      if (!byId) {
        setErrorMessage("University not found.");
        setIsLoading(false);
        return;
      }

      const byIdRow = byId as unknown as {
        id: string;
        name_ko: string;
        short_name: string | null;
        slug: string;
      };

      setUniversity({
        id: byIdRow.id,
        name: byIdRow.name_ko,
        shortName: byIdRow.short_name ?? null,
        slug: byIdRow.slug
      });
      setIsLoading(false);
    }

    void loadUniversity();

    return () => {
      cancelled = true;
    };
  }, [resolvedUniversityId]);

  const loadPosts = useCallback(async () => {
    if (!university) {
      return;
    }

    setIsLoading(true);
    setPostsError(null);

    const attemptWithMetadata = async () => {
      let query = supabase
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
          created_at,
          sections!inner ( code ),
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("university_id", university.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (filter === "all") {
        query = query.in("sections.code", ["life", "study", "qa"]);
      } else {
        query = query.eq("sections.code", filter);
      }

      return query;
    };

    const attemptWithoutMetadata = async () => {
      let query = supabase
        .from("posts")
        .select(
          `
          id,
          author_id,
          title,
          body,
          like_count,
          comment_count,
          created_at,
          sections!inner ( code ),
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("university_id", university.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (filter === "all") {
        query = query.in("sections.code", ["life", "study", "qa"]);
      } else {
        query = query.eq("sections.code", filter);
      }

      return query;
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
      setPostsError(error.message);
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
      created_at: string;
      sections: { code: string | null } | null;
      categories: { slug: string | null } | null;
      post_images: Array<{ image_url: string; sort_order: number | null }> | null;
    }>;

    const mapped = rows.map((row) => ({
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
      section: row.sections ? { slug: row.sections.code ?? null } : null,
      category: row.categories ? { slug: row.categories.slug ?? null } : null,
      images: ((row.post_images ?? []) as Array<{ image_url: string; sort_order: number | null }>).map(
        (image: { image_url: string; sort_order: number | null }) => ({
          imageUrl: image.image_url,
          sortOrder: image.sort_order ?? null
        })
      )
    }));

    setPosts(mapped);
    setIsLoading(false);

    const authorIds = Array.from(new Set(mapped.map((post) => post.authorId)));
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
  }, [filter, university]);

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
        {university?.shortName ? (
          <Text style={styles.subHeading}>{university.shortName}</Text>
        ) : null}
        <Text style={styles.headerHint}>Campus community posts</Text>
      </View>

      <View style={styles.filterRow}>
        {([
          { value: "all", label: "All" },
          { value: "life", label: "Life" },
          { value: "study", label: "Study" },
          { value: "qa", label: "Q&A" }
        ] as const).map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setFilter(option.value)}
            style={[
              styles.filterChip,
              filter === option.value && styles.filterChipSelected
            ]}
          >
            <Text
              style={[
                styles.filterChipLabel,
                filter === option.value && styles.filterChipLabelSelected
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {postsError ? <Text style={styles.errorText}>{postsError}</Text> : null}
      {!isLoading && posts.length === 0 && !errorMessage && !postsError ? (
        <Text style={styles.metaText}>No posts yet.</Text>
      ) : null}

      {posts.map((post) => {
        const previewText = getPreviewText(post.abstract, post.body);
        const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
        const labelParts = [post.section?.slug, post.category?.slug].filter(Boolean).join(" · ");
        const createdLabel = formatDate(post.createdAt);

        return (
          <View key={post.id} style={styles.postItemWrap}>
            <Link asChild href={`/posts/${post.id}`}>
              <Pressable style={styles.postCard}>
                {thumbnailUrl ? (
                  <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} />
                ) : null}
                <View style={styles.postContent}>
                  <Text style={styles.postTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  {labelParts ? <Text style={styles.postMeta}>{labelParts}</Text> : null}
                  <Text style={styles.postMeta}>{createdLabel}</Text>
                  <Text style={styles.postMeta}>
                    ❤️ {post.likeCount}   💬 {post.commentCount}
                  </Text>
                  {previewText ? (
                    <Text style={styles.postPreview} numberOfLines={3}>
                      {previewText}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Link>

            <Link
              asChild
              href={{
                pathname: "/users/[userId]",
                params: { userId: post.authorId }
              }}
            >
              <Pressable style={styles.authorChip}>
                <Text style={styles.authorChipLabel}>{post.authorName ?? "Unknown"}</Text>
              </Pressable>
            </Link>
          </View>
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
    padding: 20,
    gap: 16,
    backgroundColor: "#f8fafc"
  },
  header: {
    gap: 4
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a"
  },
  subHeading: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a"
  },
  headerHint: {
    fontSize: 12,
    color: "#64748b"
  },
  metaText: {
    fontSize: 12,
    color: "#64748b"
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c"
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ffffff"
  },
  filterChipSelected: {
    borderColor: "#0f172a",
    backgroundColor: "#0f172a"
  },
  filterChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a"
  },
  filterChipLabelSelected: {
    color: "#f8fafc"
  },
  postCard: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12
  },
  postItemWrap: {
    gap: 6
  },
  authorChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  authorChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  postThumbnail: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },
  postContent: {
    flex: 1,
    gap: 4
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  postMeta: {
    fontSize: 12,
    color: "#64748b"
  },
  postPreview: {
    fontSize: 13,
    color: "#334155"
  }
});
