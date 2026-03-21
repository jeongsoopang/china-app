import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAuthSession } from "../../src/features/auth/auth-session";
import { supabase } from "../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

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

type UniversitySummary = {
  name: string;
  shortName: string | null;
  slug: string;
};

type LogoKey = "sjtu" | "ecnu" | "sisu" | "tongji" | "fudan" | "sufe";

type BoardMode = "day" | "mood" | "night" | "auto";
type ResolvedBoardVariant = "day" | "mood" | "night";

type BoardNodeKey =
  | "sjtu-minhang"
  | "ecnu-minhang"
  | "sisu-songjiang"
  | "sjtu-xuhui"
  | "ecnu-putuo"
  | "tongji"
  | "sisu-hongkou"
  | "fudan"
  | "sufe";

type BoardNode = {
  key: BoardNodeKey;
  slug: string;
  logoKey: LogoKey;
  shortLabel: string;
  users: number;
  labelSide: "left" | "right";
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  zIndex?: number;
};

const BOARD_DAY_IMAGE = require("../../assets/home/base/shanghai-board-day.png");
const BOARD_MOOD_IMAGE = require("../../assets/home/base/shanghai-board-mood.png");
const BOARD_NIGHT_IMAGE = require("../../assets/home/base/shanghai-board-night.png");

const LOGO_ASSETS: Record<LogoKey, ImageSourcePropType> = {
  sjtu: require("../../assets/home/logos/sjtu.png"),
  ecnu: require("../../assets/home/logos/ecnu.png"),
  sisu: require("../../assets/home/logos/sisu.png"),
  tongji: require("../../assets/home/logos/tongji.png"),
  fudan: require("../../assets/home/logos/fudan.png"),
  sufe: require("../../assets/home/logos/sufe.png")
};

const BOARD_NODES: BoardNode[] = [
  {
    key: "ecnu-putuo",
    slug: "ecnu",
    logoKey: "ecnu",
    shortLabel: "ECNU PT",
    users: 0,
    labelSide: "right",
    top: "10.8%",
    left: "16.2%",
    size: 18,
    zIndex: 4
  },
  {
    key: "sisu-hongkou",
    slug: "sisu",
    logoKey: "sisu",
    shortLabel: "SISU HK",
    users: 0,
    labelSide: "right",
    top: "31.4%",
    left: "45.8%",
    size: 18,
    zIndex: 4
  },
  {
    key: "sisu-songjiang",
    slug: "sisu",
    logoKey: "sisu",
    shortLabel: "SISU SG",
    users: 0,
    labelSide: "right",
    top: "42.0%",
    left: "28.0%",
    size: 18,
    zIndex: 4
  },
  {
    key: "ecnu-minhang",
    slug: "ecnu",
    logoKey: "ecnu",
    shortLabel: "ECNU MH",
    users: 0,
    labelSide: "left",
    top: "46.6%",
    left: "62.0%",
    size: 18,
    zIndex: 4
  },
  {
    key: "fudan",
    slug: "fudan",
    logoKey: "fudan",
    shortLabel: "Fudan",
    users: 0,
    labelSide: "right",
    top: "61.4%",
    left: "22.0%",
    size: 18,
    zIndex: 4
  },
  {
    key: "tongji",
    slug: "tongji",
    logoKey: "tongji",
    shortLabel: "Tongji",
    users: 0,
    labelSide: "left",
    top: "65.0%",
    left: "80.6%",
    size: 18,
    zIndex: 4
  },
  {
    key: "sjtu-minhang",
    slug: "sjtu",
    logoKey: "sjtu",
    shortLabel: "SJTU MH",
    users: 0,
    labelSide: "right",
    top: "71.4%",
    left: "42.8%",
    size: 18,
    zIndex: 5
  },
  {
    key: "sufe",
    slug: "sufe",
    logoKey: "sufe",
    shortLabel: "SUFE",
    users: 0,
    labelSide: "left",
    top: "86.0%",
    left: "80.2%",
    size: 18,
    zIndex: 4
  },
  {
    key: "sjtu-xuhui",
    slug: "sjtu",
    logoKey: "sjtu",
    shortLabel: "SJTU XH",
    users: 0,
    labelSide: "right",
    top: "92.2%",
    left: "56.8%",
    size: 18,
    zIndex: 4
  }
];

function resolveBoardVariant(mode: BoardMode, date: Date): ResolvedBoardVariant {
  if (mode === "day") {
    return "day";
  }

  if (mode === "mood") {
    return "mood";
  }

  if (mode === "night") {
    return "night";
  }

  const hour = date.getHours();

  if (hour >= 6 && hour < 16) {
    return "day";
  }

  if (hour >= 16 && hour < 18) {
    return "mood";
  }

  return "night";
}

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuthSession();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [recentPostsError, setRecentPostsError] = useState<string | null>(null);
  const [isLoadingRecentPosts, setIsLoadingRecentPosts] = useState<boolean>(true);
  const [verifiedUniversitySlug, setVerifiedUniversitySlug] = useState<string | null>(null);
  const [verifiedUniversity, setVerifiedUniversity] = useState<UniversitySummary | null>(null);
  const [isLoadingUniversity, setIsLoadingUniversity] = useState<boolean>(false);
  const [universityError, setUniversityError] = useState<string | null>(null);

  const [boardMode, setBoardMode] = useState<BoardMode>("auto");
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  const verifiedUniversityId = useMemo(() => {
    return auth.user?.profile?.verified_university_id ?? null;
  }, [auth.user?.profile?.verified_university_id]);

  const homeUserName = useMemo(() => {
    return (
      auth.user?.profile?.display_name ??
      (typeof auth.user?.authUser.user_metadata?.display_name === "string"
        ? auth.user.authUser.user_metadata.display_name
        : null) ??
      (auth.user?.authUser.email ? auth.user.authUser.email.split("@")[0] : null) ??
      "Guest"
    );
  }, [
    auth.user?.profile?.display_name,
    auth.user?.authUser.user_metadata?.display_name,
    auth.user?.authUser.email
  ]);

  const verifiedUniversityLogoSource = useMemo<ImageSourcePropType | null>(() => {
    if (!verifiedUniversitySlug) {
      return null;
    }

    if (verifiedUniversitySlug === "sjtu") {
      return LOGO_ASSETS.sjtu;
    }
    if (verifiedUniversitySlug === "ecnu") {
      return LOGO_ASSETS.ecnu;
    }
    if (verifiedUniversitySlug === "sisu") {
      return LOGO_ASSETS.sisu;
    }
    if (verifiedUniversitySlug === "tongji") {
      return LOGO_ASSETS.tongji;
    }
    if (verifiedUniversitySlug === "fudan") {
      return LOGO_ASSETS.fudan;
    }
    if (verifiedUniversitySlug === "sufe") {
      return LOGO_ASSETS.sufe;
    }

    return null;
  }, [verifiedUniversitySlug]);

  const boardAspectRatio = 1536 / 2048;
  const availableBoardWidth = Math.max(windowWidth - spacing.lg * 2, 300);
  const maxBoardWidth = availableBoardWidth;
  const maxBoardHeight = Math.min(windowHeight * 0.84, 780);
  const boardWidth = Math.min(maxBoardWidth, maxBoardHeight * boardAspectRatio);
  const boardHeight = boardWidth / boardAspectRatio;

  const resolvedBoardVariant = useMemo<ResolvedBoardVariant>(() => {
    return resolveBoardVariant(boardMode, now);
  }, [boardMode, now]);

  const boardImageSource = useMemo(() => {
    if (resolvedBoardVariant === "day") {
      return BOARD_DAY_IMAGE;
    }
    if (resolvedBoardVariant === "mood") {
      return BOARD_MOOD_IMAGE;
    }
    return BOARD_NIGHT_IMAGE;
  }, [resolvedBoardVariant]);

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
        .limit(12);
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
        .limit(12);
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
      section: row.sections ? { slug: row.sections.code ?? null } : null,
      category: row.categories ? { slug: row.categories.slug ?? null } : null,
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

    const authorIds = Array.from(new Set(mapped.map((row) => row.authorId).filter(Boolean)));
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

    async function loadVerifiedUniversity() {
      setUniversityError(null);
      setVerifiedUniversitySlug(null);
      setVerifiedUniversity(null);

      if (!auth.isSignedIn || !verifiedUniversityId) {
        return;
      }

      setIsLoadingUniversity(true);

      const { data, error } = await supabase
        .from("universities")
        .select("slug, name:name_ko, short_name")
        .eq("id", verifiedUniversityId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setUniversityError(error.message);
        setIsLoadingUniversity(false);
        return;
      }

      const universityRow = data as unknown as {
        slug: string | null;
        name: string | null;
        short_name: string | null;
      } | null;

      setVerifiedUniversitySlug(universityRow?.slug ?? null);
      setVerifiedUniversity(
        universityRow
          ? {
              slug: universityRow.slug ?? "",
              name: universityRow.name ?? "University",
              shortName: universityRow.short_name ?? null
            }
          : null
      );
      setIsLoadingUniversity(false);
    }

    void loadVerifiedUniversity();

    return () => {
      cancelled = true;
    };
  }, [auth.isSignedIn, verifiedUniversityId]);

  const rankedPosts = useMemo(() => {
    return [...recentPosts]
      .sort((a, b) => {
        const aScore = a.likeCount * 3 + a.commentCount * 2;
        const bScore = b.likeCount * 3 + b.commentCount * 2;
        if (bScore !== aScore) {
          return bScore - aScore;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 3);
  }, [recentPosts]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroSection}>
        <Image
          source={require("../../assets/home/shanghai-banner-light.png")}
          style={styles.heroBannerImage}
          resizeMode="contain"
        />

        <View style={styles.heroOverlayContent}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandHeading}>Shanghai 上海</Text>
            <View style={styles.brandIdentityRow}>
              {verifiedUniversityLogoSource ? (
                <Image source={verifiedUniversityLogoSource} style={styles.brandIdentityLogo} resizeMode="contain" />
              ) : null}
              <Text style={styles.brandSubHeading}>{homeUserName}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.boardSectionCard, styles.boardSectionCardAttached]}>
        <View style={[styles.boardWrap, { width: boardWidth, height: boardHeight }]}>
          <Image source={boardImageSource} style={styles.boardImage} resizeMode="cover" />
          <View style={styles.boardOverlayShade} />

          {BOARD_NODES.map((node) => (
            <BoardLogoNode
              key={node.key}
              node={node}
              isDay={resolvedBoardVariant === "day"}
              onPress={() => router.push(`/universities/${node.slug}` as never)}
            />
          ))}
        </View>

        <View style={styles.boardControlRow}>
          <View style={styles.modeToggleWrap}>
            {(["day", "mood", "night", "auto"] as BoardMode[]).map((mode) => {
              const active = boardMode === mode;
              const label =
                mode === "day" ? "Day" : mode === "mood" ? "Mood" : mode === "night" ? "Night" : "Auto";

              return (
                <Pressable
                  key={mode}
                  onPress={() => setBoardMode(mode)}
                  style={[styles.modeToggleButton, active ? styles.modeToggleButtonActive : null]}
                >
                  <Text style={[styles.modeToggleButtonText, active ? styles.modeToggleButtonTextActive : null]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {verifiedUniversitySlug ? (
            <Pressable
              onPress={() => router.push(`/universities/${verifiedUniversitySlug}` as never)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonLabel}>Open my campus</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.primaryButton, styles.primaryButtonDisabled]} disabled>
              <Text style={styles.primaryButtonLabel}>
                {auth.isSignedIn
                  ? isLoadingUniversity
                    ? "Resolving university..."
                    : "Verify school"
                  : "Sign in"}
              </Text>
            </Pressable>
          )}
        </View>

        {universityError ? <Text style={styles.errorText}>{universityError}</Text> : null}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Ranked</Text>
            <Text style={styles.sectionSubtitle}>Top 3 posts by engagement</Text>
          </View>
        </View>

        {isLoadingRecentPosts ? <Text style={styles.metaText}>Loading ranked posts...</Text> : null}
        {recentPostsError ? <Text style={styles.errorText}>Unable to load posts: {recentPostsError}</Text> : null}
        {!isLoadingRecentPosts && rankedPosts.length === 0 && !recentPostsError ? (
          <Text style={styles.metaText}>No ranked posts yet.</Text>
        ) : null}

        <View style={styles.feedList}>
          {rankedPosts.map((post, index) => (
            <PostCard key={`ranked-${post.id}`} post={post} rank={index + 1} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function BoardLogoNode({
  node,
  isDay,
  onPress
}: {
  node: BoardNode;
  isDay: boolean;
  onPress: () => void;
}) {
  const logoSource = LOGO_ASSETS[node.logoKey];
  const rowStyle = node.labelSide === "left" ? styles.logoNodeRowLeft : styles.logoNodeRowRight;
  const anchorStyle = node.labelSide === "left" ? styles.logoNodeWrapLeftAnchor : null;
  const labelStyle = node.key === "ecnu-putuo" ? styles.logoNodeLabelCardLifted : null;

  return (
    <Pressable
      hitSlop={10}
      onPress={onPress}
      style={[
        styles.logoNodeWrap,
        anchorStyle,
        {
          top: node.top,
          left: node.left,
          zIndex: node.zIndex ?? 1
        }
      ]}
    >
      <View style={[styles.logoNodeRow, rowStyle]}>
        <View
          style={[
            styles.logoNodeButton,
            {
              width: node.size,
              height: node.size,
              borderRadius: node.size / 2
            }
          ]}
        >
          <Image source={logoSource} style={styles.logoNodeImage} resizeMode="contain" />
        </View>

        <View style={[styles.logoNodeLabelCard, isDay ? styles.logoNodeLabelCardDay : null, labelStyle]}>
          <Text
            style={[
              styles.logoNodeLabelTitle,
              isDay ? styles.logoNodeLabelTitleDay : null
            ]}
            numberOfLines={1}
          >
            {node.shortLabel}
          </Text>
          <Text style={[styles.logoNodeLabelMeta, isDay ? styles.logoNodeLabelMetaDay : null]}>
            User: {node.users}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function PostCard({ post, rank }: { post: RecentPost; rank?: number }) {
  const router = useRouter();
  const previewText = getPreviewText(post.abstract, post.body);
  const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
  const labelParts = [
    post.university?.shortName ?? post.university?.name,
    post.section?.slug,
    post.category?.slug
  ].filter(Boolean);
  const dateLabel = formatDate(post.createdAt);

  return (
    <Pressable onPress={() => router.push(`/posts/${post.id}` as never)} style={styles.postCard}>
      {rank ? (
        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeLabel}>{rank}</Text>
        </View>
      ) : null}
      {thumbnailUrl ? (
        <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} />
      ) : (
        <View style={styles.postThumbnailPlaceholder}>
          <Text style={styles.postThumbnailPlaceholderLabel}>Post</Text>
        </View>
      )}
      <View style={styles.postContent}>
        <Text style={styles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>
        {labelParts.length > 0 ? (
          <Text style={styles.postMeta} numberOfLines={1}>
            {labelParts.join(" · ")}
          </Text>
        ) : null}
        <View style={styles.postMetaRow}>
          <Text style={styles.postMeta}>{dateLabel}</Text>
          <View style={styles.postMetaIconGroup}>
            <Ionicons name="heart-outline" size={12} color={colors.textMuted} />
            <Text style={styles.postMeta}>{post.likeCount}</Text>
          </View>
          <View style={styles.postMetaIconGroup}>
            <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
            <Text style={styles.postMeta}>{post.commentCount}</Text>
          </View>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            router.push({
              pathname: "/users/[userId]",
              params: {
                userId: post.authorId,
                returnTo: "/(tabs)"
              }
            });
          }}
          style={styles.authorIdentityButton}
        >
          <Ionicons name="person-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.authorIdentityLabel} numberOfLines={1}>
            {post.authorName ?? "Unknown"}
          </Text>
        </Pressable>
        {previewText ? (
          <Text style={styles.postPreview} numberOfLines={3}>
            {previewText}
          </Text>
        ) : null}
      </View>
    </Pressable>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: 0,
    gap: spacing.sm,
    backgroundColor: colors.background
  },
  brandBlock: {
    alignItems: "center",
    gap: 6,
    marginBottom: 2
  },
  heroSection: {
    position: "relative",
    width: "100%",
    alignSelf: "center",
    height: 132,
    marginBottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl
  },
  heroBannerImage: {
    position: "absolute",
    top: -44,
    left: 0,
    width: "100%",
    height: 198
  },
  heroOverlayContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: spacing.lg,
    zIndex: 2
  },
  boardSectionCardAttached: {
    marginTop: -spacing.sm,
    zIndex: 3
  },

  brandHeading: {
    fontSize: typography.titleLarge,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    textShadowColor: "rgba(255,255,255,0.85)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6
  },
  brandIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  brandIdentityLogo: {
    width: 20,
    height: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  brandSubHeading: {
    fontSize: typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
    textShadowColor: "rgba(255,255,255,0.72)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
  },
  sectionCard: {
    marginTop: -spacing.sm,
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
  boardSectionCard: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: spacing.xs
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  boardControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: spacing.xs,
    marginTop: 0
  },
  modeToggleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    flexShrink: 0
  },
  modeToggleButton: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  modeToggleButtonActive: {
    backgroundColor: colors.accent
  },
  modeToggleButtonText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textMuted
  },
  modeToggleButtonTextActive: {
    color: "#f8fafc"
  },
  boardTapHint: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textAlign: "center"
  },
  boardWrap: {
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: "#edf3fb",
    borderWidth: 1,
    borderColor: "#dbe5f3",
    marginBottom: 2
  },
  boardImage: {
    width: "100%",
    height: "100%",
    position: "absolute"
  },
  boardOverlayShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.02)"
  },
  logoNodeWrap: {
    position: "absolute"
  },
  logoNodeWrapLeftAnchor: {
    transform: [{ translateX: -46 }]
  },
  logoNodeRow: {
    alignItems: "center",
    gap: 4
  },
  logoNodeRowRight: {
    flexDirection: "row"
  },
  logoNodeRowLeft: {
    flexDirection: "row-reverse"
  },
  logoNodeButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
    shadowColor: "#0b1e38",
    shadowOpacity: 0.10,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  logoNodeImage: {
    width: "78%",
    height: "78%"
  },
  logoNodeLabelCard: {
    minWidth: 34,
    maxWidth: 54,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.44)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)"
  },
  logoNodeLabelCardDay: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderColor: "rgba(148,163,184,0.72)"
  },
  logoNodeLabelCardLifted: {
    transform: [{ translateY: -10 }]
  },
  logoNodeLabelTitle: {
    fontSize: 6,
    fontWeight: "700",
    color: "#f8fafc"
  },
  logoNodeLabelTitleDay: {
    color: "#0f172a"
  },
  logoNodeLabelMeta: {
    marginTop: 0,
    fontSize: 6,
    color: "rgba(248,250,252,0.92)"
  },
  logoNodeLabelMetaDay: {
    color: "rgba(15,23,42,0.82)"
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 9,
    paddingHorizontal: 11,
    alignItems: "center",
    alignSelf: "auto",
    flexShrink: 0,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  primaryButtonDisabled: {
    opacity: 0.5
  },
  primaryButtonLabel: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: typography.caption
  },
  feedList: {
    gap: spacing.sm
  },
  postCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  rankBadgeLabel: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: typography.caption
  },
  postThumbnail: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.surface
  },
  postThumbnailPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  postThumbnailPlaceholderLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.accent
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
  postMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  postMetaIconGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  postMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  postPreview: {
    fontSize: typography.bodySmall,
    lineHeight: 19,
    color: colors.textSecondary
  },
  authorIdentityButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingVertical: 3,
    paddingHorizontal: 8
  },
  authorIdentityLabel: {
    maxWidth: 140,
    fontSize: typography.caption,
    color: colors.textSecondary,
    fontWeight: "600"
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
