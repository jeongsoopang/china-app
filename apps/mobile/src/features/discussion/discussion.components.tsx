import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ReportReasonCode } from "@foryou/supabase";
import { REPORT_REASON_OPTIONS } from "../moderation/report.service";
import type { DiscussionMode, ThreadComment } from "./discussion.types";

type CommentTreeProps = {
  mode: DiscussionMode;
  comments: ThreadComment[];
  acceptedAnswerCommentId: number | null;
  canShowAcceptBestAnswer: boolean;
  isAcceptingAnswer: boolean;
  canLike: boolean;
  canReport: boolean;
  activeReportTarget: { targetType: "post" | "comment"; targetId: number } | null;
  commentLikedByMe: Record<number, boolean>;
  likingCommentId: number | null;
  onReply: (commentId: number) => void;
  onReportComment: (commentId: number) => void;
  onAcceptBestAnswer: (commentId: number) => void;
  onToggleCommentLike: (commentId: number) => void;
};

function getCommentKindLabel(mode: DiscussionMode, isReply: boolean): string {
  if (isReply) {
    return "Reply";
  }

  return mode === "qa" ? "Answer" : "Comment";
}

function CommentNode(props: {
  mode: DiscussionMode;
  comment: ThreadComment;
  depth: number;
  acceptedAnswerCommentId: number | null;
  canShowAcceptBestAnswer: boolean;
  isAcceptingAnswer: boolean;
  canLike: boolean;
  canReport: boolean;
  activeReportTarget: { targetType: "post" | "comment"; targetId: number } | null;
  commentLikedByMe: Record<number, boolean>;
  likingCommentId: number | null;
  onReply: (commentId: number) => void;
  onReportComment: (commentId: number) => void;
  onAcceptBestAnswer: (commentId: number) => void;
  onToggleCommentLike: (commentId: number) => void;
}) {
  const {
    mode,
    comment,
    depth,
    acceptedAnswerCommentId,
    canShowAcceptBestAnswer,
    isAcceptingAnswer,
    canLike,
    canReport,
    activeReportTarget,
    commentLikedByMe,
    likingCommentId,
    onReply,
    onReportComment,
    onAcceptBestAnswer,
    onToggleCommentLike
  } = props;

  const isReply = depth > 0;
  const isAccepted = acceptedAnswerCommentId === comment.id;
  const label = getCommentKindLabel(mode, isReply);
  const likedByMe = Boolean(commentLikedByMe[comment.id]);
  const isLiking = likingCommentId === comment.id;
  const isReportingComment =
    activeReportTarget?.targetType === "comment" && activeReportTarget.targetId === comment.id;
  const authorLabel = formatAuthorId(comment.author_id);
  const createdLabel = formatTimestamp(comment.created_at);

  return (
    <View style={[styles.commentCard, depth > 0 && styles.replyCard]}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentLabel}>{label}</Text>
        <Text style={styles.commentMeta}>#{comment.id}</Text>
      </View>

      <View style={styles.commentMetaRow}>
        <Text style={styles.commentMeta}>By {authorLabel}</Text>
        <Text style={styles.commentMeta}>{createdLabel}</Text>
      </View>

      {isAccepted ? <Text style={styles.acceptedBadge}>Best Answer</Text> : null}

      <Text style={styles.commentBody}>{comment.body}</Text>

      <View style={styles.commentActions}>
        <Pressable onPress={() => onReply(comment.id)} style={styles.actionButton}>
          <Text style={styles.actionButtonLabel}>Reply</Text>
        </Pressable>

        <Pressable
          disabled={!canLike || isLiking}
          onPress={() => onToggleCommentLike(comment.id)}
          style={[styles.actionButton, (!canLike || isLiking) && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonLabel}>
            {isLiking ? "..." : likedByMe ? "Unlike" : "Like"}
          </Text>
        </Pressable>

        <Pressable
          disabled={!canReport}
          onPress={() => onReportComment(comment.id)}
          style={[styles.actionButton, !canReport && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonLabel}>{isReportingComment ? "Reporting..." : "Report"}</Text>
        </Pressable>

        {mode === "qa" &&
        depth === 0 &&
        canShowAcceptBestAnswer &&
        !isAccepted &&
        !isAcceptingAnswer ? (
          <Pressable onPress={() => onAcceptBestAnswer(comment.id)} style={styles.actionButton}>
            <Text style={styles.actionButtonLabel}>Accept</Text>
          </Pressable>
        ) : null}
      </View>

      {comment.replies.length > 0 ? (
        <View style={styles.repliesBlock}>
          {comment.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              mode={mode}
              comment={reply}
              depth={depth + 1}
              acceptedAnswerCommentId={acceptedAnswerCommentId}
              canShowAcceptBestAnswer={false}
              isAcceptingAnswer={isAcceptingAnswer}
              canLike={canLike}
              canReport={canReport}
              activeReportTarget={activeReportTarget}
              commentLikedByMe={commentLikedByMe}
              likingCommentId={likingCommentId}
              onReply={onReply}
              onReportComment={onReportComment}
              onAcceptBestAnswer={onAcceptBestAnswer}
              onToggleCommentLike={onToggleCommentLike}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function formatAuthorId(authorId: string): string {
  if (!authorId) {
    return "Unknown";
  }

  return authorId.length > 8 ? `${authorId.slice(0, 6)}…` : authorId;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function CommentTree(props: CommentTreeProps) {
  const {
    mode,
    comments,
    acceptedAnswerCommentId,
    canShowAcceptBestAnswer,
    isAcceptingAnswer,
    canLike,
    canReport,
    activeReportTarget,
    commentLikedByMe,
    likingCommentId,
    onReply,
    onReportComment,
    onAcceptBestAnswer,
    onToggleCommentLike
  } = props;

  if (comments.length === 0) {
    return <Text style={styles.emptyText}>No items yet.</Text>;
  }

  return (
    <View style={styles.commentList}>
      {comments.map((comment) => (
        <CommentNode
          key={comment.id}
          mode={mode}
          comment={comment}
          depth={0}
          acceptedAnswerCommentId={acceptedAnswerCommentId}
          canShowAcceptBestAnswer={canShowAcceptBestAnswer}
          isAcceptingAnswer={isAcceptingAnswer}
          canLike={canLike}
          canReport={canReport}
          activeReportTarget={activeReportTarget}
          commentLikedByMe={commentLikedByMe}
          likingCommentId={likingCommentId}
          onReply={onReply}
          onReportComment={onReportComment}
          onAcceptBestAnswer={onAcceptBestAnswer}
          onToggleCommentLike={onToggleCommentLike}
        />
      ))}
    </View>
  );
}

type ComposerProps = {
  mode: DiscussionMode;
  composerBody: string;
  replyToCommentId: number | null;
  isSubmitting: boolean;
  canSubmit: boolean;
  bronzeTopLevelAnswerBlocked: boolean;
  onComposerBodyChange: (value: string) => void;
  onCancelReply: () => void;
  onSubmit: () => void;
};

export function DiscussionComposer(props: ComposerProps) {
  const {
    mode,
    composerBody,
    replyToCommentId,
    isSubmitting,
    canSubmit,
    bronzeTopLevelAnswerBlocked,
    onComposerBodyChange,
    onCancelReply,
    onSubmit
  } = props;

  const topLevelLabel = mode === "qa" ? "Answer" : "Comment";

  return (
    <View style={styles.composerCard}>
      <Text style={styles.composerTitle}>
        {replyToCommentId ? `Reply to #${replyToCommentId}` : `Add ${topLevelLabel}`}
      </Text>

      {replyToCommentId ? (
        <Pressable onPress={onCancelReply} style={styles.actionButton}>
          <Text style={styles.actionButtonLabel}>Cancel Reply</Text>
        </Pressable>
      ) : null}

      {mode === "qa" && bronzeTopLevelAnswerBlocked ? (
        <Text style={styles.warningText}>
          Bronze users cannot submit top-level answers on Q&A posts. Replies are allowed.
        </Text>
      ) : null}

      <TextInput
        editable={!isSubmitting}
        multiline
        placeholder={replyToCommentId ? "Write your reply" : `Write your ${topLevelLabel.toLowerCase()}`}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        textAlignVertical="top"
        value={composerBody}
        onChangeText={onComposerBodyChange}
      />

      <Pressable
        disabled={!canSubmit}
        onPress={onSubmit}
        style={[styles.submitButton, !canSubmit && styles.buttonDisabled]}
      >
        <Text style={styles.submitButtonLabel}>{isSubmitting ? "Submitting..." : "Submit"}</Text>
      </Pressable>
    </View>
  );
}

type ReportComposerProps = {
  reportTargetLabel: string | null;
  reasonCode: ReportReasonCode;
  reasonText: string;
  isSubmitting: boolean;
  canSubmit: boolean;
  onReasonCodeChange: (value: ReportReasonCode) => void;
  onReasonTextChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function ReportComposer(props: ReportComposerProps) {
  const {
    reportTargetLabel,
    reasonCode,
    reasonText,
    isSubmitting,
    canSubmit,
    onReasonCodeChange,
    onReasonTextChange,
    onCancel,
    onSubmit
  } = props;

  if (!reportTargetLabel) {
    return null;
  }

  return (
    <View style={styles.reportCard}>
      <Text style={styles.composerTitle}>Report {reportTargetLabel}</Text>

      <View style={styles.reportReasonWrap}>
        {REPORT_REASON_OPTIONS.map((option) => {
          const selected = option.code === reasonCode;

          return (
            <Pressable
              key={option.code}
              onPress={() => onReasonCodeChange(option.code)}
              style={[styles.reasonChip, selected && styles.reasonChipSelected]}
            >
              <Text style={[styles.reasonChipLabel, selected && styles.reasonChipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {reasonCode === "other" ? (
        <TextInput
          editable={!isSubmitting}
          multiline
          placeholder="Provide additional detail"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          textAlignVertical="top"
          value={reasonText}
          onChangeText={onReasonTextChange}
        />
      ) : null}

      <View style={styles.reportActions}>
        <Pressable onPress={onCancel} style={styles.actionButton}>
          <Text style={styles.actionButtonLabel}>Cancel</Text>
        </Pressable>
        <Pressable
          disabled={!canSubmit}
          onPress={onSubmit}
          style={[styles.submitButton, !canSubmit && styles.buttonDisabled]}
        >
          <Text style={styles.submitButtonLabel}>
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  commentList: {
    gap: 12
  },
  commentCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8
  },
  replyCard: {
    marginLeft: 12,
    borderColor: "#cbd5e1"
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  commentMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b"
  },
  commentMeta: {
    fontSize: 12,
    color: "#64748b"
  },
  acceptedBadge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  commentBody: {
    fontSize: 15,
    color: "#0f172a"
  },
  commentActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  actionButtonDisabled: {
    opacity: 0.55
  },
  actionButtonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  repliesBlock: {
    gap: 10
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b"
  },
  composerCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    gap: 10,
    backgroundColor: "#ffffff"
  },
  reportCard: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
    gap: 10,
    backgroundColor: "#fff1f2"
  },
  composerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a"
  },
  warningText: {
    fontSize: 13,
    color: "#b45309"
  },
  reportReasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  reasonChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fda4af",
    backgroundColor: "#ffffff"
  },
  reasonChipSelected: {
    borderColor: "#be123c",
    backgroundColor: "#be123c"
  },
  reasonChipLabel: {
    fontSize: 12,
    color: "#9f1239"
  },
  reasonChipLabelSelected: {
    color: "#ffffff",
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
    fontSize: 15,
    color: "#0f172a"
  },
  submitButton: {
    borderRadius: 10,
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    alignItems: "center"
  },
  reportActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  buttonDisabled: {
    opacity: 0.5
  },
  submitButtonLabel: {
    color: "#f8fafc",
    fontWeight: "600"
  }
});
