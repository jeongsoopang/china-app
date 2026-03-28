import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CommentTree,
  DiscussionComposer,
  ReportComposer
} from "../../../src/features/discussion/discussion.components";
import { useDiscussionThread } from "../../../src/features/discussion/use-discussion-thread";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

export default function QaDetailScreen() {
  const { qaId } = useLocalSearchParams<{
    qaId: string;
  }>();
  const thread = useDiscussionThread({ mode: "qa", routeId: qaId });
  const bodyBlocks = parsePostBody(thread.state.post?.body ?? "");

  if (thread.isLoading && !thread.state.post) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Q&A Detail</Text>
        <Text style={styles.metaText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Q&A Detail</Text>

      {thread.state.post ? (
        <View style={styles.postCard}>
          <Text style={styles.postTitle}>{thread.state.post.title}</Text>
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

          <Text style={styles.metaText}>Answers: {thread.answerCount}</Text>

          <Pressable
            disabled={!thread.canTogglePostLike}
            onPress={thread.togglePostLike}
            style={[styles.likeButton, !thread.canTogglePostLike && styles.likeButtonDisabled]}
          >
            <Text style={styles.likeButtonLabel}>
              {thread.state.likingPost
                ? "..."
                : `${thread.state.postLikedByMe ? "Unlike" : "Like"} (${thread.state.post.like_count})`}
            </Text>
          </Pressable>

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
        mode="qa"
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
          <Text style={styles.helperText}>Sign in to answer or reply.</Text>
          <Link href="/auth/sign-in" style={styles.authLink}>
            Go to Sign In
          </Link>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Answers</Text>
        <Text style={styles.metaText}>Replies: {thread.replyCount}</Text>
      </View>

      {thread.canShowAcceptBestAnswer ? (
        <Text style={styles.helperText}>
          질문 작성자는 베스트 답변을 선택하거나 변경할 수 있습니다.
        </Text>
      ) : null}

      <CommentTree
        mode="qa"
        comments={thread.state.topLevelComments}
        acceptedAnswerCommentId={thread.state.acceptedAnswerCommentId}
        canShowAcceptBestAnswer={thread.canShowAcceptBestAnswer}
        isAcceptingAnswer={thread.isAcceptingAnswer}
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
  postBody: {
    fontSize: typography.body,
    color: colors.textSecondary,
    lineHeight: 23
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
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  helperText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
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
  authLink: {
    fontSize: typography.bodySmall,
    color: colors.accent,
    fontWeight: "600"
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
