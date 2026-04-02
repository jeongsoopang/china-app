import type { CommentRow, DbUserTier, PostImageRow, PostRow } from "@foryou/types";
import type { ReportReasonCode, ReportTargetType } from "@foryou/supabase";

export type DiscussionMode = "post" | "qa";
export type ThreadLanguageCode = "ko" | "en";

export type ThreadPost = Pick<
  PostRow,
  | "id"
  | "author_id"
  | "university_id"
  | "title"
  | "body"
  | "comment_count"
  | "created_at"
  | "like_count"
  | "view_count"
> & {
  original_language: ThreadLanguageCode;
  accepted_answer_comment_id: number | null;
  images: ThreadPostImage[];
  translation: {
    targetLanguage: ThreadLanguageCode;
    translatedTitle: string | null;
    translatedBody: string | null;
  } | null;
};

export type ThreadPostImage = Pick<PostImageRow, "id" | "image_url" | "sort_order" | "storage_path">;

export type ThreadComment = Pick<
  CommentRow,
  | "id"
  | "post_id"
  | "author_id"
  | "body"
  | "created_at"
  | "parent_comment_id"
  | "like_count"
> & {
  author_display_name?: string | null;
  is_best_answer: boolean;
  replies: ThreadComment[];
};

export type ThreadData = {
  post: ThreadPost;
  topLevelComments: ThreadComment[];
  acceptedAnswerCommentId: number | null;
};

export type ThreadPostCoreData = {
  post: ThreadPost;
};

export type ThreadCommentsBundle = {
  topLevelComments: ThreadComment[];
  acceptedAnswerCommentId: number | null;
};

export type CreateCommentInput = {
  postId: number;
  body: string;
  parentCommentId?: number | null;
};

export type CreateCommentResult = {
  commentId: number | null;
  message: string | null;
};

export type AcceptBestAnswerResult = {
  success: boolean;
  message: string | null;
};

export type ToggleLikeResult = {
  liked: boolean;
  likeCount: number;
};

export type CurrentDiscussionUser = {
  userId: string;
  tier: DbUserTier;
};

export type ThreadReportTarget = {
  targetType: ReportTargetType;
  targetId: number;
};

export type ThreadReportDraft = {
  target: ThreadReportTarget | null;
  reasonCode: ReportReasonCode;
  reasonText: string;
};
