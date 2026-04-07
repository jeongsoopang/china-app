import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../../../src/features/auth/auth-session";
import {
  fetchShanghaiPosts,
  formatDate,
  getCardThumbnailUrl,
  getPreviewText,
  type ShanghaiPost
} from "../../../src/features/home/shanghai-posts";
import { supabase } from "../../../src/lib/supabase/client";
import { CityHeroHeader } from "../../../src/ui/city-hero-header";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

type ChurchTab = "intro" | "notice";

type ChurchIntroContent = {
  title: string;
  body: string;
  imageUrl: string | null;
  updatedAt: string | null;
};

function parseChurchIntroBody(value: string): string {
  return value
    .replace(/<img\s+[^>]*>/gi, "")
    .replace(/\[Image pending upload\]/gi, " ")
    .replace(/\[Image failed to upload\]/gi, " ")
    .replace(/<\/?p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseChurchIntroImageUrl(value: string): string | null {
  const match = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i.exec(value);
  return match?.[1] ?? null;
}

function isChurchMasterRole(value: string | null | undefined): boolean {
  return value === "church_master";
}

export default function ShanghaiChurchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[]; tab?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const auth = useAuthSession();
  const rawReturnTo = params.returnTo;
  const returnTo = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const rawTab = params.tab;
  const queryTab = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  const initialTab: ChurchTab = queryTab === "notice" ? "notice" : "intro";

  const [activeTab, setActiveTab] = useState<ChurchTab>(initialTab);
  const [introContent, setIntroContent] = useState<ChurchIntroContent>({
    title: "LUCL Shanghai Church",
    body: "교회 소개 콘텐츠를 준비 중입니다.",
    imageUrl: null,
    updatedAt: null
  });
  const [isLoadingIntro, setIsLoadingIntro] = useState(true);
  const [introError, setIntroError] = useState<string | null>(null);
  const [introImageAspectRatio, setIntroImageAspectRatio] = useState(1);
  const [notices, setNotices] = useState<ShanghaiPost[]>([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(true);
  const [noticesError, setNoticesError] = useState<string | null>(null);

  const canEditChurch = useMemo(() => {
    const role = auth.user?.profile?.role ?? null;
    const tier = auth.user?.profile?.tier ?? null;
    return isChurchMasterRole(role) || isChurchMasterRole(tier);
  }, [auth.user?.profile?.role, auth.user?.profile?.tier]);

  const loadChurchData = useCallback(async () => {
    setIsLoadingIntro(true);
    setIsLoadingNotices(true);
    setIntroError(null);
    setNoticesError(null);

    const [introResult, noticeResult] = await Promise.allSettled([
      supabase
        .from("church_page_content")
        .select("title, body, updated_at")
        .eq("id", 1)
        .maybeSingle(),
      fetchShanghaiPosts({
        categorySlugs: ["fun-church-notice"],
        limit: 24
      })
    ]);

    if (introResult.status === "fulfilled") {
      if (introResult.value.error) {
        setIntroError(introResult.value.error.message);
      } else {
        setIntroContent({
          title: introResult.value.data?.title ?? "LUCL Shanghai Church",
          body: parseChurchIntroBody(introResult.value.data?.body ?? ""),
          imageUrl: parseChurchIntroImageUrl(introResult.value.data?.body ?? ""),
          updatedAt: introResult.value.data?.updated_at ?? null
        });
      }
    } else {
      const message =
        introResult.reason instanceof Error
          ? introResult.reason.message
          : "Failed to load church intro.";
      setIntroError(message);
    }

    if (noticeResult.status === "fulfilled") {
      setNotices(noticeResult.value);
    } else {
      const message =
        noticeResult.reason instanceof Error
          ? noticeResult.reason.message
          : "Failed to load church notices.";
      setNoticesError(message);
    }

    setIsLoadingIntro(false);
    setIsLoadingNotices(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadChurchData();
    }, [loadChurchData])
  );

  useEffect(() => {
    const imageUrl = introContent.imageUrl;
    if (!imageUrl) {
      setIntroImageAspectRatio(1);
      return;
    }

    let cancelled = false;

    Image.getSize(
      imageUrl,
      (width, height) => {
        if (cancelled) {
          return;
        }

        if (width > 0 && height > 0) {
          setIntroImageAspectRatio(width / height);
        } else {
          setIntroImageAspectRatio(1);
        }
      },
      () => {
        if (!cancelled) {
          setIntroImageAspectRatio(1);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [introContent.imageUrl]);

  useEffect(() => {
    if (activeTab !== "notice") {
      return;
    }

    notices.slice(0, 6).forEach((post) => {
      const thumbnailUrl = getCardThumbnailUrl(post.thumbnailImageUrl);
      if (thumbnailUrl) {
        void Image.prefetch(thumbnailUrl);
      }
    });
  }, [activeTab, notices]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroWrap}>
        <CityHeroHeader
          title="Church"
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

            router.replace("/home/shanghai" as never);
          }}
          style={[styles.heroBackButton, { top: Math.max(insets.top + 6, spacing.md) }]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color="#f8fafc" />
          <Text style={styles.heroBackButtonLabel}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.bodyWrap}>
        <View style={styles.tabRow}>
          <Pressable
            onPress={() => setActiveTab("intro")}
            style={[styles.tabButton, activeTab === "intro" ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabButtonLabel, activeTab === "intro" ? styles.tabButtonLabelActive : null]}>
              소개
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("notice")}
            style={[styles.tabButton, activeTab === "notice" ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabButtonLabel, activeTab === "notice" ? styles.tabButtonLabelActive : null]}>
              공지
            </Text>
          </Pressable>
        </View>

        {activeTab === "intro" ? (
          <View style={styles.sectionWrap}>
            {isLoadingIntro ? <Text style={styles.metaText}>Loading church intro...</Text> : null}
            {introError ? <Text style={styles.errorText}>{introError}</Text> : null}
            {!isLoadingIntro ? (
              <View style={styles.introCard}>
                <Text style={styles.introTitle}>{introContent.title}</Text>
                {introContent.imageUrl ? (
                  <Image
                    source={{ uri: introContent.imageUrl }}
                    style={[styles.introImage, { aspectRatio: introImageAspectRatio }]}
                    resizeMode="contain"
                    onLoad={(event) => {
                      const width = event.nativeEvent.source?.width ?? 0;
                      const height = event.nativeEvent.source?.height ?? 0;
                      if (width > 0 && height > 0) {
                        setIntroImageAspectRatio(width / height);
                      }
                    }}
                  />
                ) : null}
                <Text style={styles.introBody}>{introContent.body || "교회 소개 콘텐츠를 준비 중입니다."}</Text>
                {introContent.updatedAt ? (
                  <Text style={styles.introMeta}>Updated {formatDate(introContent.updatedAt)}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.sectionWrap}>
            {canEditChurch ? (
              <Link
                asChild
                href={{
                  pathname: "/compose",
                  params: { presetSection: "fun", presetCategory: "fun-church-notice" }
                }}
              >
                <Pressable style={styles.actionButton}>
                  <Text style={styles.actionButtonLabel}>공지 작성</Text>
                </Pressable>
              </Link>
            ) : null}
            {isLoadingNotices ? <Text style={styles.metaText}>Loading church notices...</Text> : null}
            {noticesError ? <Text style={styles.errorText}>{noticesError}</Text> : null}
            {!isLoadingNotices && notices.length === 0 && !noticesError ? (
              <Text style={styles.metaText}>No church notices yet.</Text>
            ) : null}
            <View style={styles.listWrap}>
              {notices.map((post) => {
                const previewText = getPreviewText(post.abstract, post.body);
                const thumbnailUrl = getCardThumbnailUrl(post.thumbnailImageUrl);
                return (
                  <Link
                    key={`church-notice-${post.id}`}
                    asChild
                    href={{
                      pathname: "/posts/[postId]",
                      params: { postId: String(post.id), returnTo: "/home/shanghai-church" }
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
                      </View>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>
        )}
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
    gap: spacing.md
  },
  tabRow: {
    flexDirection: "row",
    gap: spacing.xs
  },
  tabButton: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  tabButtonLabel: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textSecondary
  },
  tabButtonLabelActive: {
    color: "#f8fafc"
  },
  sectionWrap: {
    gap: spacing.sm
  },
  introCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(173,194,220,0.58)",
    backgroundColor: "rgba(255,255,255,0.96)",
    minHeight: 240,
    padding: spacing.md,
    gap: spacing.sm
  },
  introTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: colors.textPrimary
  },
  introImage: {
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  introBody: {
    fontSize: typography.body,
    lineHeight: 24,
    color: colors.textSecondary
  },
  introMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  actionButton: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 8
  },
  actionButtonLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
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
    padding: spacing.sm
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
  metaText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  }
});
