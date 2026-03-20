import { Link, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, Image } from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { supabase } from "../../src/lib/supabase/client";

type RecentPost = {
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
  university: { name: string | null; shortName: string | null } | null;
  images: { imageUrl: string; sortOrder: number | null }[];
};

function HomeSegment({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.segmentCard}>
      <Text style={styles.segmentTitle}>{title}</Text>
      <Text style={styles.segmentDescription}>{description}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const auth = useAuthSession();
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [recentPostsError, setRecentPostsError] = useState<string | null>(null);
  const [isLoadingRecentPosts, setIsLoadingRecentPosts] = useState<boolean>(true);
  const [verifiedUniversitySlug, setVerifiedUniversitySlug] = useState<string | null>(null);
  const [isLoadingUniversitySlug, setIsLoadingUniversitySlug] = useState<boolean>(false);
  const [universitySlugError, setUniversitySlugError] = useState<string | null>(null);

  const verifiedUniversityId = useMemo(() => {
    return auth.user?.profile?.verified_university_id ?? null;
  }, [auth.user?.profile?.verified_university_id]);

  const loadRecentPosts = useCallback(async () => {
    setIsLoadingRecentPosts(true);
    setRecentPostsError(null);

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
          created_at,
          sections ( code ),
          categories ( slug ),
          universities ( name_ko, short_name ),
          post_images ( image_url, sort_order )
        `
        )
        .order("created_at", { ascending: false })
        .limit(5);
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
          created_at,
          sections ( code ),
          categories ( slug ),
          universities ( name_ko, short_name ),
          post_images ( image_url, sort_order )
        `
        )
        .order("created_at", { ascending: false })
        .limit(5);
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
      setRecentPostsError(error.message);
      setRecentPosts([]);
      setIsLoadingRecentPosts(false);
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
      universities: { name_ko: string | null; short_name: string | null } | null;
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
      section: row.sections
        ? { slug: row.sections.code ?? null }
        : null,
      category: row.categories
        ? { slug: row.categories.slug ?? null }
        : null,
      university: row.universities
        ? { name: row.universities.name_ko ?? null, shortName: row.universities.short_name ?? null }
        : null,
      images: ((row.post_images ?? []) as Array<{ image_url: string; sort_order: number | null }>).map(
        (image: { image_url: string; sort_order: number | null }) => ({
          imageUrl: image.image_url,
          sortOrder: image.sort_order ?? null
        })
      )
    }));

    setRecentPosts(mapped);
    setIsLoadingRecentPosts(false);

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

    setRecentPosts((current) =>
      current.map((post) => ({
        ...post,
        authorName: displayNameMap.get(post.authorId) ?? post.authorName
      }))
    );
  }, []);

  useEffect(() => {
    void loadRecentPosts();
  }, [loadRecentPosts]);

  useFocusEffect(
    useCallback(() => {
      void loadRecentPosts();
    }, [loadRecentPosts])
  );

  useEffect(() => {
    let cancelled = false;

    async function loadUniversitySlug() {
      setUniversitySlugError(null);
      setVerifiedUniversitySlug(null);

      if (!auth.isSignedIn || !verifiedUniversityId) {
        return;
      }

      setIsLoadingUniversitySlug(true);

      const { data, error } = await supabase
        .from("universities")
        .select("slug")
        .eq("id", verifiedUniversityId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setUniversitySlugError(error.message);
        setIsLoadingUniversitySlug(false);
        return;
      }

      setVerifiedUniversitySlug(data?.slug ?? null);
      setIsLoadingUniversitySlug(false);
    }

    void loadUniversitySlug();

    return () => {
      cancelled = true;
    };
  }, [auth.isSignedIn, verifiedUniversityId]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Home</Text>
      <View style={styles.segmentGrid}>
        <HomeSegment title="Map" description="Campus-based local discovery placeholder." />
        <HomeSegment title="Ranked" description="Ranking feed placeholder." />
        <HomeSegment title="Latest" description="Chronological feed placeholder." />
      </View>

      <View style={styles.linkGroup}>
        {verifiedUniversitySlug ? (
          <Link asChild href={`/universities/${verifiedUniversitySlug}`}>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkLabel}>Open University Detail</Text>
            </Pressable>
          </Link>
        ) : (
          <Pressable style={[styles.linkButton, styles.linkButtonDisabled]} disabled>
            <Text style={styles.linkLabel}>
              {auth.isSignedIn
                ? isLoadingUniversitySlug
                  ? "Loading your university..."
                  : "Verify your university to open"
                : "Sign in to open university"}
            </Text>
          </Pressable>
        )}
        <Link asChild href="/qa/1">
          <Pressable style={styles.linkButton}>
            <Text style={styles.linkLabel}>Open Q&A Detail</Text>
          </Pressable>
        </Link>
      </View>

      <View style={[styles.segmentCard, styles.rankedSection]}>
        <Text style={styles.segmentTitle}>Recent Posts</Text>
        {isLoadingRecentPosts ? (
          <Text style={styles.segmentDescription}>Loading posts...</Text>
        ) : null}
        {recentPostsError ? (
          <Text style={styles.errorText}>Unable to load posts: {recentPostsError}</Text>
        ) : null}
        {!isLoadingRecentPosts && recentPosts.length === 0 && !recentPostsError ? (
          <Text style={styles.segmentDescription}>No posts yet.</Text>
        ) : null}
        {recentPosts.map((post) => {
          const previewText = getPreviewText(post.abstract, post.body);
          const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);

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
                  params: {
                    userId: post.authorId
                  }
                }}
              >
                <Pressable style={styles.authorChip}>
                  <Text style={styles.authorChipLabel}>{post.authorName ?? "Unknown"}</Text>
                </Pressable>
              </Link>
            </View>
          );
        })}
      </View>
    </View>
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
    flex: 1,
    padding: 20,
    gap: 10,
    backgroundColor: "#f8fafc"
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a"
  },
  segmentGrid: {
    gap: 8,
    marginTop: 2
  },
  segmentCard: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 4
  },
  segmentTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a"
  },
  segmentDescription: {
    fontSize: 14,
    color: "#475569"
  },
  linkGroup: {
    gap: 8,
    marginTop: 2,
    marginBottom: 2
  },
  rankedSection: {
    marginTop: 2
  },
  linkButton: {
    borderRadius: 10,
    backgroundColor: "#0f172a",
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  linkButtonDisabled: {
    opacity: 0.6
  },
  linkLabel: {
    color: "#f8fafc",
    fontWeight: "600"
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
    gap: 7,
    marginTop: 2
  },
  authorChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d6deec",
    backgroundColor: "#f8fbff",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  authorChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e3a5f"
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
  },
  errorText: {
    fontSize: 12,
    color: "#b91c1c"
  }
});
