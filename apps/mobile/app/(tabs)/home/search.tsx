import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

type SearchPost = {
  id: number;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  abstract: string | null;
  createdAt: string;
  sectionSlug: string | null;
  categorySlug: string | null;
};

function stripText(value: string): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  const text = stripText(body);
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

export default function HomeSearchScreen() {
  const { q, returnTo } = useLocalSearchParams<{ q?: string | string[]; returnTo?: string | string[] }>();
  const resolvedReturnTo = (Array.isArray(returnTo) ? returnTo[0] : returnTo) ?? "/(tabs)";
  const initialQuery = (Array.isArray(q) ? q[0] : q) ?? "";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery.trim());
  const [results, setResults] = useState<SearchPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentSearchReturnTo = useMemo(() => {
    const queryString = activeQuery.trim();
    if (!queryString) {
      return `/home/search?returnTo=${encodeURIComponent(resolvedReturnTo)}`;
    }
    return `/home/search?q=${encodeURIComponent(queryString)}&returnTo=${encodeURIComponent(resolvedReturnTo)}`;
  }, [activeQuery, resolvedReturnTo]);

  const loadResults = useCallback(async () => {
    const normalized = activeQuery.trim();
    if (!normalized) {
      setResults([]);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const escaped = normalized.replace(/,/g, "\\,").replace(/\./g, "\\.");

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
          created_at,
          sections ( code ),
          categories ( slug )
        `
        )
        .in("sections.code", ["life", "study", "qa", "fun"])
        .or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%,abstract.ilike.%${escaped}%`)
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
          created_at,
          sections ( code ),
          categories ( slug )
        `
        )
        .in("sections.code", ["life", "study", "qa", "fun"])
        .or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`)
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
      setResults([]);
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: number;
      author_id: string;
      title: string;
      body: string;
      abstract?: string | null;
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
      sectionSlug: row.sections?.code ?? null,
      categorySlug: row.categories?.slug ?? null
    }));

    setResults(mapped);
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

    setResults((current) =>
      current.map((post) => ({
        ...post,
        authorName: displayNameMap.get(post.authorId) ?? post.authorName
      }))
    );
  }, [activeQuery]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  function submitSearch() {
    setActiveQuery(inputValue.trim());
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.searchTopCard}>
        <Text style={styles.heading}>Search Results</Text>
        <View style={styles.searchInputRow}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={inputValue}
            onChangeText={setInputValue}
            onSubmitEditing={submitSearch}
            placeholder="Search posts"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          <Pressable style={styles.searchButton} onPress={submitSearch}>
            <Text style={styles.searchButtonLabel}>Search</Text>
          </Pressable>
        </View>
        <Text style={styles.metaText}>
          {activeQuery ? `"${activeQuery}" · ${results.length} result(s)` : "Enter a query to search posts."}
        </Text>
      </View>

      {isLoading ? <Text style={styles.metaText}>Loading results...</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.resultList}>
        {!isLoading && activeQuery && results.length === 0 && !errorMessage ? (
          <Text style={styles.metaText}>No matching posts found.</Text>
        ) : null}

        {results.map((post) => {
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
                <Text style={styles.resultTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.resultMeta} numberOfLines={1}>
                  {post.authorName ?? "Unknown"} · {formatDate(post.createdAt)}
                </Text>
                {label ? (
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {label}
                  </Text>
                ) : null}
                {preview ? (
                  <Text style={styles.resultPreview} numberOfLines={3}>
                    {preview}
                  </Text>
                ) : null}
              </Pressable>
            </Link>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  searchTopCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
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
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  searchInput: {
    flex: 1,
    minHeight: 34,
    color: colors.textPrimary,
    fontSize: typography.body
  },
  searchButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  searchButtonLabel: {
    color: "#f8fafc",
    fontSize: typography.bodySmall,
    fontWeight: "700"
  },
  metaText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
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
    gap: 4
  },
  resultTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  resultMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  resultPreview: {
    marginTop: 2,
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  }
});
