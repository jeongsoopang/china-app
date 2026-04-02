import type { DbUserTier } from "@foryou/types";
import type { ReportReasonCode, ReportTargetType } from "@foryou/supabase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMobileCurrentUser } from "../auth/current-user";
import { mapReportError, submitReport } from "../moderation/report.service";
import {
  acceptBestAnswerViaRpc,
  createCommentViaRpc,
  fetchPostCommentsBundle,
  fetchPostDetailCore,
  mapDiscussionError,
  parsePostRouteId,
  toggleCommentLike,
  togglePostLike
} from "./discussion.service";
import type { DiscussionMode, ThreadComment, ThreadData } from "./discussion.types";

type ThreadAction =
  | "loading"
  | "ready"
  | "submitting_comment"
  | "accepting_answer"
  | "submitting_report";

type ReportTarget = {
  targetType: ReportTargetType;
  targetId: number;
};

type DiscussionThreadState = {
  action: ThreadAction;
  postId: number | null;
  post: ThreadData["post"] | null;
  topLevelComments: ThreadComment[];
  acceptedAnswerCommentId: number | null;
  currentUserId: string | null;
  currentUserTier: DbUserTier | null;
  composerBody: string;
  replyToCommentId: number | null;
  postLikedByMe: boolean | null;
  commentLikedByMe: Record<number, boolean>;
  likingPost: boolean;
  likingCommentId: number | null;
  commentsLoading: boolean;
  reportTarget: ReportTarget | null;
  reportReasonCode: ReportReasonCode;
  reportReasonText: string;
  infoMessage: string | null;
  errorMessage: string | null;
};

const INITIAL_STATE: DiscussionThreadState = {
  action: "loading",
  postId: null,
  post: null,
  topLevelComments: [],
  acceptedAnswerCommentId: null,
  currentUserId: null,
  currentUserTier: null,
  composerBody: "",
  replyToCommentId: null,
  postLikedByMe: null,
  commentLikedByMe: {},
  likingPost: false,
  likingCommentId: null,
  commentsLoading: false,
  reportTarget: null,
  reportReasonCode: "spam",
  reportReasonText: "",
  infoMessage: null,
  errorMessage: null
};

function countReplies(comments: ThreadComment[]): number {
  return comments.reduce((count, comment) => count + comment.replies.length, 0);
}

function collectCommentIds(comments: ThreadComment[]): number[] {
  return comments.flatMap((comment) => [comment.id, ...collectCommentIds(comment.replies)]);
}

function updateCommentLikeCount(
  comments: ThreadComment[],
  targetCommentId: number,
  likeCount: number
): ThreadComment[] {
  return comments.map((comment) => {
    if (comment.id === targetCommentId) {
      return {
        ...comment,
        like_count: likeCount,
        replies: updateCommentLikeCount(comment.replies, targetCommentId, likeCount)
      };
    }

    if (comment.replies.length > 0) {
      return {
        ...comment,
        replies: updateCommentLikeCount(comment.replies, targetCommentId, likeCount)
      };
    }

    return comment;
  });
}

export function useDiscussionThread(params: {
  mode: DiscussionMode;
  routeId: string | string[] | undefined;
  resolvedLanguage?: "ko" | "en";
}) {
  const { mode, routeId, resolvedLanguage } = params;
  const [state, setState] = useState<DiscussionThreadState>(INITIAL_STATE);
  const loadRequestIdRef = useRef(0);

  const resolvedPostId = useMemo(() => parsePostRouteId(routeId), [routeId]);

  const loadThread = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    if (!resolvedPostId) {
      setState((current) => ({
        ...current,
        action: "ready",
        postId: null,
        commentsLoading: false,
        errorMessage: "Invalid post ID."
      }));
      return;
    }

    setState((current) => ({
      ...current,
      action: "loading",
      errorMessage: null,
      infoMessage: null,
      postId: resolvedPostId,
      commentsLoading: true,
      ...(current.postId !== resolvedPostId
        ? {
            post: null,
            topLevelComments: [],
            acceptedAnswerCommentId: null,
            postLikedByMe: null,
            commentLikedByMe: {},
            likingPost: false,
            likingCommentId: null
          }
        : {})
    }));

    const currentUserPromise = getMobileCurrentUser().catch(() => null);
    void currentUserPromise.then((currentUser) => {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setState((current) => ({
        ...current,
        currentUserId: currentUser?.authUser.id ?? null,
        currentUserTier: currentUser?.profile.tier ?? null
      }));
    });

    try {
      const coreData = await fetchPostDetailCore(resolvedPostId, resolvedLanguage);

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setState((current) => {
        return {
          ...current,
          action: "ready",
          postId: resolvedPostId,
          post: coreData.post,
          acceptedAnswerCommentId:
            mode === "qa" ? coreData.post.accepted_answer_comment_id : null,
          errorMessage: null
        };
      });

      const commentsBundle = await fetchPostCommentsBundle({
        postId: resolvedPostId,
        mode,
        acceptedAnswerCommentIdFromPost: coreData.post.accepted_answer_comment_id
      });

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setState((current) => {
        const validCommentIds = new Set(collectCommentIds(commentsBundle.topLevelComments));
        const nextCommentLikedByMe = Object.fromEntries(
          Object.entries(current.commentLikedByMe).filter(([commentId]) =>
            validCommentIds.has(Number(commentId))
          )
        ) as Record<number, boolean>;

        return {
          ...current,
          action: "ready",
          postId: resolvedPostId,
          topLevelComments: commentsBundle.topLevelComments,
          acceptedAnswerCommentId: commentsBundle.acceptedAnswerCommentId,
          commentLikedByMe: nextCommentLikedByMe,
          commentsLoading: false,
          errorMessage: null
        };
      });
    } catch (error) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      setState((current) => ({
        ...current,
        action: "ready",
        postId: resolvedPostId,
        commentsLoading: false,
        errorMessage: mapDiscussionError(error)
      }));
    }
  }, [mode, resolvedLanguage, resolvedPostId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const isQa = mode === "qa";
  const isLoading = state.action === "loading";
  const isCommentsLoading = state.commentsLoading;
  const isSubmittingComment = state.action === "submitting_comment";
  const isAcceptingAnswer = state.action === "accepting_answer";
  const isSubmittingReport = state.action === "submitting_report";
  const isSignedIn = Boolean(state.currentUserId);

  const answerCount = state.topLevelComments.length;
  const replyCount = countReplies(state.topLevelComments);
  const isQuestionAuthor =
    Boolean(state.currentUserId) && state.currentUserId === state.post?.author_id;

  const canShowAcceptBestAnswer =
    isQa && isQuestionAuthor;

  const bronzeTopLevelAnswerBlocked =
    isQa && state.currentUserTier === "bronze" && state.replyToCommentId === null;

  const canSubmit =
    !isLoading &&
    !isSubmittingComment &&
    !isAcceptingAnswer &&
    !isSubmittingReport &&
    Boolean(state.postId) &&
    isSignedIn &&
    state.composerBody.trim().length > 0 &&
    !bronzeTopLevelAnswerBlocked;

  const canTogglePostLike =
    !isLoading &&
    !isSubmittingComment &&
    !isAcceptingAnswer &&
    !isSubmittingReport &&
    Boolean(state.postId) &&
    isSignedIn &&
    !state.likingPost;

  function canToggleCommentLike(_commentId: number): boolean {
    return (
      !isLoading &&
      !isSubmittingComment &&
      !isAcceptingAnswer &&
      !isSubmittingReport &&
      isSignedIn &&
      state.likingCommentId === null
    );
  }

  const canOpenReport =
    isSignedIn &&
    !isLoading &&
    !isSubmittingComment &&
    !isAcceptingAnswer &&
    !isSubmittingReport;

  const canSubmitReport =
    canOpenReport &&
    state.reportTarget !== null &&
    (state.reportReasonCode !== "other" || state.reportReasonText.trim().length > 0);

  function setComposerBody(value: string) {
    setState((current) => ({
      ...current,
      composerBody: value,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function beginReply(commentId: number) {
    setState((current) => ({
      ...current,
      replyToCommentId: commentId,
      infoMessage: null,
      errorMessage: null
    }));
  }

  function cancelReply() {
    setState((current) => ({
      ...current,
      replyToCommentId: null,
      infoMessage: null,
      errorMessage: null
    }));
  }

  function openReportForPost() {
    const postId = state.postId;

    if (!canOpenReport || !postId) {
      return;
    }

    setState((current) => ({
      ...current,
      reportTarget: {
        targetType: "post",
        targetId: postId
      },
      reportReasonCode: "spam",
      reportReasonText: "",
      errorMessage: null,
      infoMessage: null
    }));
  }

  function openReportForComment(commentId: number) {
    if (!canOpenReport) {
      return;
    }

    setState((current) => ({
      ...current,
      reportTarget: {
        targetType: "comment",
        targetId: commentId
      },
      reportReasonCode: "spam",
      reportReasonText: "",
      errorMessage: null,
      infoMessage: null
    }));
  }

  function closeReportComposer() {
    setState((current) => ({
      ...current,
      reportTarget: null,
      reportReasonCode: "spam",
      reportReasonText: "",
      errorMessage: null
    }));
  }

  function setReportReasonCode(reasonCode: ReportReasonCode) {
    setState((current) => ({
      ...current,
      reportReasonCode: reasonCode,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function setReportReasonText(value: string) {
    setState((current) => ({
      ...current,
      reportReasonText: value,
      errorMessage: null,
      infoMessage: null
    }));
  }

  async function submitComment() {
    if (!state.postId || !state.currentUserId || !canSubmit) {
      return;
    }

    setState((current) => ({
      ...current,
      action: "submitting_comment",
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await createCommentViaRpc({
        postId: state.postId,
        body: state.composerBody.trim(),
        parentCommentId: state.replyToCommentId
      });

      await loadThread();

      setState((current) => ({
        ...current,
        composerBody: "",
        replyToCommentId: null,
        infoMessage: result.message ?? (isQa ? "Reply submitted." : "Comment submitted."),
        errorMessage: null
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "ready",
        errorMessage: mapDiscussionError(error)
      }));
    }
  }

  async function acceptBestAnswer(commentId: number) {
    if (!state.postId || !canShowAcceptBestAnswer || isAcceptingAnswer) {
      return;
    }

    setState((current) => ({
      ...current,
      action: "accepting_answer",
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await acceptBestAnswerViaRpc(state.postId, commentId);

      if (!result.success) {
        throw new Error(result.message ?? "Unable to accept best answer.");
      }

      await loadThread();

      setState((current) => ({
        ...current,
        infoMessage: result.message ?? "Best answer accepted.",
        errorMessage: null
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "ready",
        errorMessage: mapDiscussionError(error)
      }));
    }
  }

  async function onTogglePostLike() {
    if (!state.postId || !canTogglePostLike) {
      return;
    }

    setState((current) => ({
      ...current,
      likingPost: true,
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await togglePostLike(state.postId);

      setState((current) => ({
        ...current,
        likingPost: false,
        postLikedByMe: result.liked,
        post: current.post
          ? {
              ...current.post,
              like_count: result.likeCount
            }
          : current.post
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        likingPost: false,
        errorMessage: mapDiscussionError(error)
      }));
    }
  }

  async function onToggleCommentLike(commentId: number) {
    if (!canToggleCommentLike(commentId)) {
      return;
    }

    setState((current) => ({
      ...current,
      likingCommentId: commentId,
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await toggleCommentLike(commentId);

      setState((current) => ({
        ...current,
        likingCommentId: null,
        commentLikedByMe: {
          ...current.commentLikedByMe,
          [commentId]: result.liked
        },
        topLevelComments: updateCommentLikeCount(
          current.topLevelComments,
          commentId,
          result.likeCount
        )
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        likingCommentId: null,
        errorMessage: mapDiscussionError(error)
      }));
    }
  }

  async function onSubmitReport() {
    if (!canSubmitReport || !state.reportTarget) {
      return;
    }

    setState((current) => ({
      ...current,
      action: "submitting_report",
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const result = await submitReport({
        targetType: state.reportTarget.targetType,
        targetId: state.reportTarget.targetId,
        reasonCode: state.reportReasonCode,
        reasonText:
          state.reportReasonCode === "other" || state.reportReasonText.trim().length > 0
            ? state.reportReasonText.trim()
            : null
      });

      setState((current) => ({
        ...current,
        action: "ready",
        reportTarget: null,
        reportReasonCode: "spam",
        reportReasonText: "",
        infoMessage: result.message ?? "Report submitted.",
        errorMessage: null
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "ready",
        errorMessage: mapReportError(error)
      }));
    }
  }

  return {
    state,
    isQa,
    isSignedIn,
    isLoading,
    isCommentsLoading,
    isSubmittingComment,
    isAcceptingAnswer,
    isSubmittingReport,
    answerCount,
    replyCount,
    bronzeTopLevelAnswerBlocked,
    canShowAcceptBestAnswer,
    canSubmit,
    canOpenReport,
    canSubmitReport,
    canTogglePostLike,
    canToggleCommentLike,
    setComposerBody,
    beginReply,
    cancelReply,
    submitComment,
    acceptBestAnswer,
    openReportForPost,
    openReportForComment,
    closeReportComposer,
    setReportReasonCode,
    setReportReasonText,
    submitReport: onSubmitReport,
    togglePostLike: onTogglePostLike,
    toggleCommentLike: onToggleCommentLike,
    refresh: loadThread
  };
}
