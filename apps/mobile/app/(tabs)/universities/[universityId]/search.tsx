import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../../../src/ui/theme";

type SearchPost = {
  id: number;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  abstract: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  sectionSlug: string | null;
  categorySlug: string | null;
};

type UniversitySummary = {
  id: string;
  name: string;
};

export default function UniversitySearchScreen() {
  const { universityId, q, returnTo } = useLocalSearchParams<{
    universityId?: string;
    q?: string;
    returnTo?: string;
  }>();

  const resolvedUniversityRouteId = Array.isArray(universityId) ? universityId[0] : universityId;
  const resolvedInitialQuery = (Array.isArray(q) ? q[0] : q) ?? "";
  const resolvedReturnTo = (Array.isArray(returnTo) ? returnTo[0] : returnTo) ?? "/(tabs)";

  const [university, setUniversity] = useState<UniversitySummary | null>(null);
  const [inputValue, setInputValue] = useState(resolvedInitialQuery);
  const [activeQuery, setActiveQuery] = useState(resolvedInitialQuery.trim());
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentSearchReturnTo = useMemo(() => {
    if (!resolvedUniversityRouteId) {
      return resolvedReturnTo;
    }
    const queryString = activeQuery.trim();
    if (!queryString) {
      return `/universities/${resolvedUniversityRouteId}/search?returnTo=${encodeURIComponent(resolvedReturnTo)}`;
    }
    return `/universities/${resolvedUniversityRouteId}/search?q=${encodeURIComponent(
      queryString
    )}&returnTo=${encodeURIComponent(resolvedReturnTo)}`;
  }, [activeQuery, resolvedReturnTo, resolvedUniversityRouteId]);

  useEffect(() => {
    let cancelled = false;

    async function loadUniversity() {
      if (!resolvedUniversityRouteId) {
        setErrorMessage("Invalid university identifier.");
        setIsLoading(false);
        return;
      }

      const { data: bySlug, error: slugError } = await supabase
        .from("universities")
        .select("id, name:name_ko")
        .eq("slug", resolvedUniversityRouteId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (slugError) {
        setErrorMessage(slugError.message);
        setIsLoading(false);
        return;
      }

      if (bySlug) {
        const row = bySlug as unknown as { id: string; name: string | null };
        setUniversity({
          id: row.id,
          name: row.name ?? "University"
        });
        return;
      }

      const { data: byId, error: idError } = await supabase
        .from("universities")
        .select("id, name:name_ko")
        .eq("id", resolvedUniversityRouteId)
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

      const row = byId as unknown as { id: string; name: string | null };
      setUniversity({
        id: row.id,
        name: row.name ?? "University"
      });
    }

    void loadUniversity();

    return () => {
      cancelled = true;
    };
  }, [resolvedUniversityRouteId]);

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
          like_count,
          comment_count,
          created_at,
          sections ( code ),
          categories ( slug )
        `
        )
        .eq("university_id", university.id)
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
          created_at,
          sections ( code ),
          categories ( slug )
        `
        )
        .eq("university_id", university.id)
        .order("created_at", { ascending: false })
        .limit(120);
    };

    let data: unknown = null;
    let error: { message: string } | null = null;

    const withMetadata = await attemptWithMetadata();
    data = withMetadata.data;
    error = withMetadata.error ? { message: withMetadata.error.message } : null;

    if (error && /column/i.test(error.message) && /abstract/i.test(error.message)) {
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
      like_count: number | null;
      comment_count: number | null;
      created_at: string;
      sections: { code: string | null } | null;
      categories: { slug: string | null } | null;
    }>;

    const mapped: SearchPost[] = rows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: null,
      title: row.title,
      body: row.body,
      abstract: typeof row.abstract === "string" ? row.abstract : null,
      createdAt: row.created_at,
      likeCount: row.like_count ?? 0,
      commentCount: row.comment_count ?? 0,
      sectionSlug: row.sections?.code ?? null,
      categorySlug: row.categories?.slug ?? null
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
  }, [university?.id]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    const normalized = activeQuery.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return posts.filter((post) => {
      const authorName = (post.authorName ?? "").toLowerCase();
      const title = post.title.toLowerCase();
      const textBody = stripText(post.body).toLowerCase();
      return title.includes(normalized) || textBody.includes(normalized) || authorName.includes(normalized);
    });
  }, [activeQuery, posts]);

  const submitSearch = useCallback(() => {
    setActiveQuery(inputValue.trim());
  }, [inputValue]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.searchTopCard}>
        <Text style={styles.heading}>{university?.name ?? "University"} Search</Text>
        <View style={styles.searchInputRow}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={submitSearch}
            placeholder="키워드 또는 사용자명을 입력하세요"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          <Pressable style={styles.searchButton} onPress={submitSearch}>
            <Text style={styles.searchButtonLabel}>검색</Text>
          </Pressable>
        </View>
        <Text style={styles.metaText}>
          {activeQuery ? `검색 결과 총 ${filteredPosts.length}개` : "검색어를 입력해 주세요."}
        </Text>
      </View>

      {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.resultList}>
        {!isLoading && activeQuery && filteredPosts.length === 0 ? (
          <Text style={styles.metaText}>검색 결과가 없습니다.</Text>
        ) : null}

        {filteredPosts.map((post) => {
          const preview = getPreviewText(post.abstract, post.body);
          const label = [post.sectionSlug, post.categorySlug].filter(Boolean).join(" · ");
          return (
            <Link
              key={post.id}
              asChild
              href={{
                pathname: "/posts/[postId]",
                params: {
                  postId: String(post.id),
                  returnTo: currentSearchReturnTo
                }
              }}
            >
              <Pressable style={styles.resultCard}>
                <HighlightedText text={post.title} query={activeQuery} style={styles.resultTitle} />
                <View style={styles.resultMetaRow}>
                  <HighlightedText
                    text={post.authorName ?? "Unknown"}
                    query={activeQuery}
                    style={styles.resultMeta}
                  />
                  <Text style={styles.resultMeta}>· {formatDate(post.createdAt)}</Text>
                </View>
                {label ? <Text style={styles.resultMeta}>{label}</Text> : null}
                {preview ? (
                  <HighlightedText text={preview} query={activeQuery} style={styles.resultPreview} numberOfLines={3} />
                ) : null}
                <View style={styles.resultEngagementRow}>
                  <View style={styles.resultEngagementItem}>
                    <Ionicons name="heart-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.resultMeta}>{post.likeCount}</Text>
                  </View>
                  <View style={styles.resultEngagementItem}>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.resultMeta}>{post.commentCount}</Text>
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

function HighlightedText({
  text,
  query,
  style,
  numberOfLines
}: {
  text: string;
  query: string;
  style: object;
  numberOfLines?: number;
}) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(regex);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        const matched = part.toLowerCase() === normalizedQuery.toLowerCase();
        if (matched) {
          return (
            <Text key={`${part}-${index}`} style={styles.highlightText}>
              {part}
            </Text>
          );
        }
        return <Text key={`${part}-${index}`}>{part}</Text>;
      })}
    </Text>
  );
}

function stripText(value: string): string {
  return value
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPreviewText(abstract: string | null, body: string): string {
  if (abstract && abstract.trim()) {
    return abstract.trim().length > 180 ? `${abstract.trim().slice(0, 177)}...` : abstract.trim();
  }

  const normalized = stripText(body);
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  searchTopCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  heading: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8
  },
  searchInput: {
    flex: 1,
    minHeight: 24,
    fontSize: typography.body,
    color: colors.textPrimary
  },
  searchButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  searchButtonLabel: {
    color: "#f8fafc",
    fontSize: typography.caption,
    fontWeight: "700"
  },
  resultList: {
    gap: spacing.sm
  },
  resultCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: 4,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  resultTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  resultMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  resultPreview: {
    fontSize: typography.bodySmall,
    lineHeight: 18,
    color: colors.textSecondary
  },
  resultEngagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  resultEngagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  highlightText: {
    fontWeight: "800",
    color: colors.textPrimary
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
