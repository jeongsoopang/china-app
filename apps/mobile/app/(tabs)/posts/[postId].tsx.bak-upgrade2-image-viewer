import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CommentTree,
  DiscussionComposer,
  ReportComposer
} from "../../../src/features/discussion/discussion.components";
import { incrementPostViewCount } from "../../../src/features/discussion/discussion.service";
import { useDiscussionThread } from "../../../src/features/discussion/use-discussion-thread";
import { useAuthSession } from "../../../src/features/auth/auth-session";
import { useAppLanguage } from "../../../src/features/language/app-language";
import { supabase } from "../../../src/lib/supabase/client";
import { TierMarker, resolveTierMarkerValue } from "../../../src/ui/tier-marker";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

function isSpecialRole(value: string | null | undefined): boolean {
  return value === "campus_master" || value === "church_master" || value === "grandmaster";
}

export default function PostDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuthSession();
  const { postId, returnTo } = useLocalSearchParams<{
    postId: string;
    returnTo?: string | string[];
  }>();
  const { resolvedLanguage } = useAppLanguage();

  const resolvedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const safeTopPadding = Math.max(insets.top + 8, spacing.lg);

  function onGoBackFromGate() {
    if (resolvedReturnTo) {
      router.replace(resolvedReturnTo as never);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)" as never);
  }

  if (auth.isLoading) {
    return (
      <View style={[styles.container, { paddingTop: safeTopPadding }]}>
        <Text style={styles.heading}>Post Detail</Text>
        <Text style={styles.metaText}>Checking session...</Text>
      </View>
    );
  }

  if (!auth.isSignedIn) {
    return (
      <View style={[styles.container, { paddingTop: safeTopPadding }]}>
        <View style={styles.screenHeaderRow}>
          <Pressable onPress={onGoBackFromGate} style={styles.backButton}>
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            <Text style={styles.backButtonLabel}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.heading}>Post Detail</Text>
        <View style={styles.authGateCard}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.textMuted} />
          <Text style={styles.authGateTitle}>로그인이 필요합니다</Text>
          <Text style={styles.helperText}>
            비회원은 미리보기만 볼 수 있으며, 상세 본문은 로그인 후 확인할 수 있습니다.
          </Text>
          <Link asChild href="/auth/sign-in">
            <Pressable style={styles.primaryAuthButton}>
              <Text style={styles.primaryAuthButtonLabel}>로그인</Text>
            </Pressable>
          </Link>
          <Link asChild href="/auth/sign-up">
            <Pressable style={styles.secondaryAuthButton}>
              <Text style={styles.secondaryAuthButtonLabel}>회원가입</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  return (
      <AuthenticatedPostDetailScreen
        postId={postId}
        returnTo={resolvedReturnTo}
        safeTopPadding={safeTopPadding}
        resolvedLanguage={resolvedLanguage}
      />
  );
}

function AuthenticatedPostDetailScreen(props: {
  postId: string;
  returnTo?: string;
  safeTopPadding: number;
  resolvedLanguage: "ko" | "en";
}) {
  const { postId, returnTo, safeTopPadding, resolvedLanguage } = props;
  const router = useRouter();
  const thread = useDiscussionThread({ mode: "post", routeId: postId, resolvedLanguage });
  const post = thread.state.post;
  const shouldUseTranslation =
    post !== null &&
    resolvedLanguage !== post.original_language &&
    post.translation?.targetLanguage === resolvedLanguage;
  const displayTitle = shouldUseTranslation
    ? (post?.translation?.translatedTitle ?? post?.title ?? "")
    : (post?.title ?? "");
  const displayBody = shouldUseTranslation
    ? (post?.translation?.translatedBody ?? post?.body ?? "")
    : (post?.body ?? "");
  const translationMissingNotice =
    post &&
    resolvedLanguage !== post.original_language &&
    !shouldUseTranslation
      ? (resolvedLanguage === "ko" ? "아직 번역되지 않음" : "Not translated yet")
      : null;
  const bodyBlocks = parsePostBody(displayBody);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [authorTier, setAuthorTier] = useState<string | null>(null);
  const [viewCountOverride, setViewCountOverride] = useState<number | null>(null);
  const incrementedPostIdRef = useRef<number | null>(null);
  const inferredUniversityReturnTo = thread.state.post?.university_id
    ? `/universities/${thread.state.post.university_id}`
    : null;
  const resolvedBackTo = returnTo ?? inferredUniversityReturnTo;

  useEffect(() => {
    let cancelled = false;

    async function loadAuthorName() {
      const authorId = thread.state.post?.author_id;
      if (!authorId) {
        setAuthorName(null);
        setAuthorTier(null);
        return;
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name, point_tier, role")
        .eq("id", authorId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setAuthorName(null);
        setAuthorTier(null);
        return;
      }

      setAuthorName(typeof data?.display_name === "string" ? data.display_name : null);
      const role = typeof data?.role === "string" ? data.role : null;
      const pointTier = typeof data?.point_tier === "string" ? data.point_tier : null;
      setAuthorTier(
        isSpecialRole(role)
          ? role
          : resolveTierMarkerValue(pointTier, role)
      );
    }

    void loadAuthorName();

    return () => {
      cancelled = true;
    };
  }, [thread.state.post?.author_id]);

  useEffect(() => {
    const numericPostId = typeof postId === "string" && /^\d+$/.test(postId) ? Number(postId) : null;
    if (!numericPostId) {
      return;
    }
    const resolvedPostId = numericPostId;
    setViewCountOverride(null);

    if (incrementedPostIdRef.current === resolvedPostId) {
      return;
    }

    incrementedPostIdRef.current = resolvedPostId;
    let cancelled = false;

    async function incrementViews() {
      try {
        const nextViewCount = await incrementPostViewCount(resolvedPostId);
        if (cancelled) {
          return;
        }
        setViewCountOverride(nextViewCount);
      } catch {
        return;
      }
    }

    void incrementViews();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  function onGoBack() {
    if (resolvedBackTo) {
      router.replace(resolvedBackTo as never);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)" as never);
  }

  if (thread.isLoading && !thread.state.post) {
    return (
      <View style={[styles.container, { paddingTop: safeTopPadding }]}>
        <View style={styles.screenHeaderRow}>
          <Pressable onPress={onGoBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            <Text style={styles.backButtonLabel}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.heading}>Post Detail</Text>
        <Text style={styles.metaText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: safeTopPadding }]}>
      <View style={styles.screenHeaderRow}>
        <Pressable onPress={onGoBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.heading}>Post Detail</Text>

      {thread.state.post ? (
        <View style={styles.postCard}>
          <Text style={styles.postTitle}>{displayTitle}</Text>
          {translationMissingNotice ? <Text style={styles.metaText}>{translationMissingNotice}</Text> : null}
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/users/[userId]",
                params: {
                  userId: thread.state.post?.author_id ?? "",
                  returnTo: resolvedBackTo ?? `/posts/${postId}`
                }
              })
            }
            style={styles.authorIdentityButton}
          >
            <TierMarker value={authorTier} size={16} />
            <Text style={styles.authorIdentityLabel} numberOfLines={1}>
              {authorName ?? "Unknown"}
            </Text>
          </Pressable>

          <View style={styles.bodyBlocks}>
            {bodyBlocks.map((block, index) =>
              block.type === "paragraph" ? (
                <Text key={`${block.type}-${index}`} style={styles.postBody}>
                  {block.text}
                </Text>
              ) : (
                <Image
                  key={`${block.type}-${index}`}
                  source={{ uri: block.url }}
                  style={styles.postImage}
                />
              )
            )}
          </View>

          {bodyBlocks.every((block) => block.type !== "image") &&
          thread.state.post.images.length > 0 ? (
            <View style={styles.imagesSection}>
              <Text style={styles.metaText}>Images: {thread.state.post.images.length}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageRow}
              >
                {thread.state.post.images.map((image) => (
                  <Image key={image.id} source={{ uri: image.image_url }} style={styles.postImage} />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.postMetaRow}>
            <View style={styles.postMetaInline}>
              <Ionicons name="eye-outline" size={16} color={colors.textMuted} />
              <Text style={styles.metaText}>
                Views {viewCountOverride ?? thread.state.post.view_count}
              </Text>
            </View>
            <Text style={styles.metaText}>Comments: {thread.state.post.comment_count}</Text>

            <Pressable
              disabled={!thread.canTogglePostLike}
              onPress={thread.togglePostLike}
              style={[styles.heartButton, !thread.canTogglePostLike && styles.likeButtonDisabled]}
            >
              <Ionicons
                name={thread.state.postLikedByMe ? "heart" : "heart-outline"}
                size={18}
                color={colors.textPrimary}
              />
              <Text style={styles.heartButtonCount}>
                {thread.state.likingPost ? "..." : thread.state.post.like_count}
              </Text>
            </Pressable>
          </View>

          {!thread.isSignedIn ? (
            <Text style={styles.helperText}>Sign in to like posts.</Text>
          ) : null}

          <Pressable
            disabled={!thread.canOpenReport}
            onPress={thread.openReportForPost}
            style={[styles.likeButton, !thread.canOpenReport && styles.likeButtonDisabled]}
          >
            <Text style={styles.likeButtonLabel}>
              {thread.state.reportTarget?.targetType === "post" ? "Reporting..." : "Report Post"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <DiscussionComposer
        mode="post"
        composerBody={thread.state.composerBody}
        replyToCommentId={thread.state.replyToCommentId}
        isSubmitting={thread.isSubmittingComment}
        canSubmit={thread.canSubmit}
        bronzeTopLevelAnswerBlocked={thread.bronzeTopLevelAnswerBlocked}
        onComposerBodyChange={thread.setComposerBody}
        onCancelReply={thread.cancelReply}
        onSubmit={thread.submitComment}
      />

      {!thread.isSignedIn ? (
        <View style={styles.authHint}>
          <Text style={styles.helperText}>Sign in to create comments and replies.</Text>
          <Link href="/auth/sign-in" style={styles.authLink}>
            Go to Sign In
          </Link>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Comments</Text>
        <Text style={styles.metaText}>
          Total {thread.state.post?.comment_count ?? 0} · Replies {thread.replyCount}
        </Text>
      </View>

      <CommentTree
        mode="post"
        comments={thread.state.topLevelComments}
        acceptedAnswerCommentId={null}
        canShowAcceptBestAnswer={false}
        isAcceptingAnswer={false}
        canLike={thread.isSignedIn}
        canReport={thread.canOpenReport}
        activeReportTarget={thread.state.reportTarget}
        commentLikedByMe={thread.state.commentLikedByMe}
        likingCommentId={thread.state.likingCommentId}
        onReply={thread.beginReply}
        onReportComment={thread.openReportForComment}
        onAcceptBestAnswer={thread.acceptBestAnswer}
        onToggleCommentLike={thread.toggleCommentLike}
      />

      <ReportComposer
        reportTargetLabel={
          thread.state.reportTarget
            ? `${thread.state.reportTarget.targetType} #${thread.state.reportTarget.targetId}`
            : null
        }
        reasonCode={thread.state.reportReasonCode}
        reasonText={thread.state.reportReasonText}
        isSubmitting={thread.isSubmittingReport}
        canSubmit={thread.canSubmitReport}
        onReasonCodeChange={thread.setReportReasonCode}
        onReasonTextChange={thread.setReportReasonText}
        onCancel={thread.closeReportComposer}
        onSubmit={thread.submitReport}
      />

      <Pressable onPress={thread.refresh} style={styles.refreshButton}>
        <Text style={styles.refreshButtonLabel}>Refresh</Text>
      </Pressable>

      {thread.state.infoMessage ? <Text style={styles.infoText}>{thread.state.infoMessage}</Text> : null}
      {thread.state.errorMessage ? <Text style={styles.errorText}>{thread.state.errorMessage}</Text> : null}
    </ScrollView>
  );
}

type BodyBlock =
  | { type: "paragraph"; text: string }
  | { type: "image"; url: string };

function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function parsePostBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const pattern = /<p>(.*?)<\/p>|<img\s+[^>]*>/gis;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    if (match[1] !== undefined) {
      const text = unescapeHtml(match[1]);
      if (text.trim().length > 0) {
        blocks.push({ type: "paragraph", text });
      }
      continue;
    }

    const tag = match[0];
    const srcMatch = /src=["']([^"']+)["']/.exec(tag);
    if (srcMatch?.[1]) {
      blocks.push({ type: "image", url: srcMatch[1] });
    }
  }

  if (blocks.length === 0 && body.trim().length > 0) {
    blocks.push({ type: "paragraph", text: body });
  }

  return blocks;
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
  heading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: spacing.sm
  },
  postTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary
  },
  authorIdentityButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  authorIdentityLabel: {
    maxWidth: 180,
    fontSize: typography.bodySmall,
    fontWeight: "600",
    color: colors.textSecondary
  },
  postBody: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 23
  },
  postMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm
  },
  postMetaInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  bodyBlocks: {
    gap: spacing.sm
  },
  imagesSection: {
    gap: spacing.xs
  },
  imageRow: {
    gap: spacing.sm
  },
  postImage: {
    width: 200,
    height: 140,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  metaText: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surface
  },
  likeButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface
  },
  heartButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface
  },
  heartButtonCount: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textPrimary
  },
  likeButtonDisabled: {
    opacity: 0.55
  },
  likeButtonLabel: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textPrimary
  },
  authHint: {
    gap: 6
  },
  authGateCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 16,
    gap: spacing.sm
  },
  authGateTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  primaryAuthButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    alignItems: "center"
  },
  primaryAuthButtonLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: "#f8fafc"
  },
  secondaryAuthButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryAuthButtonLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  helperText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  authLink: {
    fontSize: typography.bodySmall,
    color: colors.accent,
    fontWeight: "600"
  },
  refreshButtonLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary
  },
  infoText: {
    fontSize: typography.bodySmall,
    color: colors.success
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  }
});
