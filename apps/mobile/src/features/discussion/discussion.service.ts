import type { CommentRow, Database, PostImageRow, PostRow } from "@foryou/types";
import { supabase } from "../../lib/supabase/client";
import type {
  AcceptBestAnswerResult,
  CreateCommentInput,
  CreateCommentResult,
  DiscussionMode,
  ThreadComment,
  ThreadData,
  ThreadPostImage,
  ThreadPost,
  ToggleLikeResult
} from "./discussion.types";

type CreateCommentRpcReturn = Database["public"]["Functions"]["create_comment"]["Returns"];
type AcceptBestAnswerRpcReturn =
  Database["public"]["Functions"]["accept_best_answer"]["Returns"];
type TogglePostLikeRpcReturn = Database["public"]["Functions"]["toggle_post_like"]["Returns"];
type ToggleCommentLikeRpcReturn =
  Database["public"]["Functions"]["toggle_comment_like"]["Returns"];

function normalizeNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function toThreadPost(row: PostRow): ThreadPost {
  const originalLanguage: ThreadPost["original_language"] =
    row.original_language === "en" ? "en" : "ko";

  return {
    id: row.id,
    author_id: row.author_id,
    university_id: row.university_id,
    title: row.title,
    body: row.body,
    comment_count: row.comment_count,
    like_count: row.like_count,
    view_count: row.view_count,
    created_at: row.created_at,
    original_language: originalLanguage,
    accepted_answer_comment_id: row.accepted_answer_comment_id,
    images: [],
    translation: null
  };
}

function toThreadComment(row: CommentRow, displayName?: string | null): ThreadComment {
  return {
    id: row.id,
    post_id: row.post_id,
    author_id: row.author_id,
    author_display_name: displayName ?? null,
    body: row.body,
    created_at: row.created_at,
    parent_comment_id: row.parent_comment_id,
    like_count: row.like_count,
    is_best_answer: Boolean(row.is_best_answer),
    replies: []
  };
}

function toThreadPostImage(row: PostImageRow): ThreadPostImage {
  return {
    id: row.id,
    image_url: row.image_url,
    sort_order: row.sort_order,
    storage_path: row.storage_path
  };
}

function buildCommentTree(
  comments: CommentRow[],
  displayNames: Map<string, string | null>
): ThreadComment[] {
  const byId = new Map<number, ThreadComment>();
  const roots: ThreadComment[] = [];

  comments.forEach((comment) => {
    const node = toThreadComment(comment, displayNames.get(comment.author_id) ?? null);
    byId.set(node.id, node);
  });

  comments.forEach((comment) => {
    const node = byId.get(comment.id);

    if (!node) {
      return;
    }

    if (comment.parent_comment_id === null) {
      roots.push(node);
      return;
    }

    const parentNode = byId.get(comment.parent_comment_id);

    if (!parentNode) {
      roots.push(node);
      return;
    }

    parentNode.replies.push(node);
  });

  return roots;
}

function findAcceptedAnswerCommentId(
  post: ThreadPost,
  topLevelComments: ThreadComment[]
): number | null {
  if (post.accepted_answer_comment_id) {
    return post.accepted_answer_comment_id;
  }

  const accepted = topLevelComments.find((comment) => comment.is_best_answer);
  return accepted?.id ?? null;
}

function parseCreateCommentResult(data: CreateCommentRpcReturn): CreateCommentResult {
  const getFromRecord = (record: Record<string, unknown>): CreateCommentResult => {
    return {
      commentId: normalizeNumericId(record.comment_id ?? record.id),
      message: typeof record.message === "string" ? record.message : null
    };
  };

  if (typeof data === "string") {
    return {
      commentId: normalizeNumericId(data),
      message: null
    };
  }

  if (Array.isArray(data)) {
    const first = data[0];

    if (!first || typeof first !== "object") {
      return { commentId: null, message: null };
    }

    return getFromRecord(first as Record<string, unknown>);
  }

  if (data && typeof data === "object") {
    return getFromRecord(data as Record<string, unknown>);
  }

  return { commentId: null, message: null };
}

function parseAcceptBestAnswerResult(data: AcceptBestAnswerRpcReturn): AcceptBestAnswerResult {
  const getFromRecord = (record: Record<string, unknown>): AcceptBestAnswerResult => {
    return {
      success: Boolean(record.success ?? true),
      message: typeof record.message === "string" ? record.message : null
    };
  };

  if (typeof data === "string") {
    return {
      success: true,
      message: data
    };
  }

  if (Array.isArray(data)) {
    const first = data[0];

    if (!first || typeof first !== "object") {
      return { success: true, message: null };
    }

    return getFromRecord(first as Record<string, unknown>);
  }

  if (data && typeof data === "object") {
    return getFromRecord(data as Record<string, unknown>);
  }

  return { success: true, message: null };
}

function parseToggleLikeResult(
  data: TogglePostLikeRpcReturn | ToggleCommentLikeRpcReturn
): ToggleLikeResult {
  const parseRecord = (record: Record<string, unknown>): ToggleLikeResult => {
    return {
      liked: Boolean(record.liked),
      likeCount:
        typeof record.like_count === "number"
          ? record.like_count
          : typeof record.like_count === "string" && /^\d+$/.test(record.like_count)
            ? Number(record.like_count)
            : 0
    };
  };

  if (Array.isArray(data)) {
    const first = data[0];

    if (!first || typeof first !== "object") {
      throw new Error("Like toggle returned no data.");
    }

    return parseRecord(first as Record<string, unknown>);
  }

  if (data && typeof data === "object") {
    return parseRecord(data as Record<string, unknown>);
  }

  throw new Error("Like toggle returned invalid data.");
}

export async function fetchThreadData(
  postId: number,
  mode: DiscussionMode,
  resolvedLanguage?: "ko" | "en"
): Promise<ThreadData> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sign in is required to view post details.");
  }

  const [
    { data: postData, error: postError },
    { data: commentsData, error: commentsError },
    { data: imagesData, error: imagesError }
  ] =
    await Promise.all([
      supabase.from("posts").select("*").eq("id", postId).maybeSingle(),
      supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true }),
      supabase
        .from("post_images")
        .select("*")
        .eq("post_id", postId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
    ]);

  if (postError) {
    throw postError;
  }

  if (!postData) {
    throw new Error("Post not found.");
  }

  if (commentsError) {
    throw commentsError;
  }

  if (imagesError) {
    throw imagesError;
  }

  const originalLanguage: ThreadPost["original_language"] =
    postData.original_language === "en" ? "en" : "ko";
  let translation: ThreadPost["translation"] = null;

  if (resolvedLanguage && resolvedLanguage !== originalLanguage) {
    const { data: translationData, error: translationError } = await supabase
      .from("post_translations")
      .select("target_language, translated_title, translated_body")
      .eq("post_id", postId)
      .eq("status", "completed")
      .eq("target_language", resolvedLanguage)
      .eq("source_updated_at", postData.updated_at)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (translationError) {
      throw translationError;
    }

    if (translationData) {
      translation = {
        targetLanguage: translationData.target_language === "ko" ? "ko" : "en",
        translatedTitle: translationData.translated_title,
        translatedBody: translationData.translated_body
      };
    }
  }

  const post: ThreadPost = {
    ...toThreadPost(postData),
    original_language: originalLanguage,
    images: (imagesData ?? []).map(toThreadPostImage),
    translation
  };
  const commentRows = commentsData ?? [];
  const authorIds = Array.from(new Set(commentRows.map((comment) => comment.author_id)));
  const displayNames = new Map<string, string | null>();

  if (authorIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, display_name")
      .in("id", authorIds);

    if (profileError) {
      throw profileError;
    }

    (profileData ?? []).forEach((profile) => {
      displayNames.set(profile.id, profile.display_name ?? null);
    });
  }

  const topLevelComments = buildCommentTree(commentRows, displayNames);
  const acceptedAnswerCommentId =
    mode === "qa" ? findAcceptedAnswerCommentId(post, topLevelComments) : null;

  return {
    post,
    topLevelComments,
    acceptedAnswerCommentId
  };
}

export async function createCommentViaRpc(
  input: CreateCommentInput
): Promise<CreateCommentResult> {
  const { data, error } = await supabase.rpc("create_comment", {
    p_post_id: input.postId,
    p_body: input.body,
    p_parent_comment_id: input.parentCommentId ?? null
  });

  if (error) {
    throw error;
  }

  return parseCreateCommentResult(data);
}

export async function acceptBestAnswerViaRpc(
  postId: number,
  commentId: number
): Promise<AcceptBestAnswerResult> {
  const { data, error } = await supabase.rpc("accept_best_answer", {
    p_post_id: postId,
    p_comment_id: commentId
  });

  if (error) {
    throw error;
  }

  return parseAcceptBestAnswerResult(data);
}

export async function togglePostLike(postId: number): Promise<ToggleLikeResult> {
  const attemptPrimary = await supabase.rpc("toggle_post_like", {
    p_post_id: postId
  });

  if (!attemptPrimary.error) {
    return parseToggleLikeResult(attemptPrimary.data);
  }

  const message = attemptPrimary.error.message ?? "";
  const shouldRetryWithAltParam =
    message.includes("toggle_post_like") || message.includes("p_post_id") || message.includes("does not exist");

  if (!shouldRetryWithAltParam) {
    throw new Error(attemptPrimary.error.message);
  }

  const attemptFallback = await supabase.rpc(
    "toggle_post_like",
    { post_id: postId } as unknown as { p_post_id: number }
  );

  if (attemptFallback.error) {
    throw new Error(attemptFallback.error.message);
  }

  return parseToggleLikeResult(attemptFallback.data);
}

export async function incrementPostViewCount(postId: number): Promise<number> {
  const attemptPrimary = await supabase.rpc("increment_post_view_count", {
    p_post_id: postId
  });

  const parseViewCount = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value)) {
      return Number(value);
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      const candidates = [
        record.view_count,
        record.new_view_count,
        record.increment_post_view_count,
        record.count
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isFinite(candidate)) {
          return candidate;
        }
        if (typeof candidate === "string" && /^\d+$/.test(candidate)) {
          return Number(candidate);
        }
      }
    }
    return null;
  };

  if (!attemptPrimary.error) {
    const direct = parseViewCount(attemptPrimary.data);
    if (direct !== null) {
      return direct;
    }

    if (Array.isArray(attemptPrimary.data)) {
      const first = parseViewCount(attemptPrimary.data[0]);
      if (first !== null) {
        return first;
      }
    }

    return 0;
  }

  const message = attemptPrimary.error.message ?? "";
  const shouldRetryWithAltParam =
    message.includes("increment_post_view_count") ||
    message.includes("p_post_id") ||
    message.includes("does not exist");

  if (!shouldRetryWithAltParam) {
    throw new Error(attemptPrimary.error.message);
  }

  const attemptFallback = await supabase.rpc(
    "increment_post_view_count",
    { post_id: postId } as unknown as { p_post_id: number }
  );

  if (attemptFallback.error) {
    throw new Error(attemptFallback.error.message);
  }

  const fallbackDirect = parseViewCount(attemptFallback.data);
  if (fallbackDirect !== null) {
    return fallbackDirect;
  }

  if (Array.isArray(attemptFallback.data)) {
    const first = parseViewCount(attemptFallback.data[0]);
    if (first !== null) {
      return first;
    }
  }

  return 0;
}

export async function toggleCommentLike(commentId: number): Promise<ToggleLikeResult> {
  const { data, error } = await supabase.rpc("toggle_comment_like", {
    p_comment_id: commentId
  });

  if (error) {
    throw error;
  }

  return parseToggleLikeResult(data);
}

export function parsePostRouteId(value: string | string[] | undefined): number | null {
  if (typeof value === "string") {
    return normalizeNumericId(value);
  }

  if (Array.isArray(value) && value.length > 0) {
    return normalizeNumericId(value[0]);
  }

  return null;
}

export function mapDiscussionError(error: unknown): string {
  const fallback = "Request failed. Please try again.";

  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (!message) {
    return fallback;
  }

  const normalized = message.toLowerCase();

  if (normalized.includes("bronze") && normalized.includes("only comment on q&a")) {
    return "Bronze users can only comment on Q&A posts.";
  }

  if (normalized.includes("bronze") && normalized.includes("cannot answer")) {
    return "Bronze users cannot submit top-level answers on Q&A posts.";
  }

  if (normalized.includes("bronze") && normalized.includes("5 comments") && normalized.includes("shanghai day")) {
    return "Bronze users can submit up to 5 comments per Shanghai day.";
  }

  if (normalized.includes("only the question author") || normalized.includes("question author")) {
    return "Only the question author can accept a best answer.";
  }

  if (normalized.includes("at least 3") && normalized.includes("answer")) {
    return "At least 3 top-level answers are required to accept a best answer.";
  }

  if (normalized.includes("like") || normalized.includes("toggle_post_like")) {
    return "Unable to update like status right now.";
  }

  return message || fallback;
}
