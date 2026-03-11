import { Link, useLocalSearchParams } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  CommentTree,
  DiscussionComposer,
  ReportComposer
} from "../../src/features/discussion/discussion.components";
import { useDiscussionThread } from "../../src/features/discussion/use-discussion-thread";

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const thread = useDiscussionThread({ mode: "post", routeId: postId });
  const bodyBlocks = parsePostBody(thread.state.post?.body ?? "");

  if (thread.isLoading && !thread.state.post) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Post Detail</Text>
        <Text style={styles.metaText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Post Detail</Text>

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
          <View style={styles.postMetaRow}>
            <Text style={styles.metaText}>Comments: {thread.state.post.comment_count}</Text>
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
        bronzeTopLevelAnswerBlocked={false}
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
    padding: 20,
    gap: 14,
    backgroundColor: "#f8fafc"
  },
  heading: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a"
  },
  postCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8
  },
  postTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a"
  },
  postBody: {
    fontSize: 15,
    color: "#334155"
  },
  postMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  bodyBlocks: {
    gap: 10
  },
  imagesSection: {
    gap: 8
  },
  imageRow: {
    gap: 10
  },
  postImage: {
    width: 160,
    height: 120,
    borderRadius: 10,
    backgroundColor: "#e2e8f0"
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  metaText: {
    fontSize: 12,
    color: "#64748b"
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  likeButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  likeButtonDisabled: {
    opacity: 0.55
  },
  likeButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  authHint: {
    gap: 6
  },
  helperText: {
    fontSize: 13,
    color: "#64748b"
  },
  authLink: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "600"
  },
  refreshButtonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155"
  },
  infoText: {
    fontSize: 14,
    color: "#166534"
  },
  errorText: {
    fontSize: 14,
    color: "#b91c1c"
  }
});
