import { createHash } from "node:crypto";
import { requireGrandMasterAccess } from "../auth/grandmaster";
import { createAdminServiceClient } from "../supabase/server";

type SupportedLanguage = "ko" | "en";

type RawPostRow = {
  id: number;
  title: string | null;
  body: string | null;
  original_language: string | null;
  updated_at: string;
  created_at: string;
};

type RawPostTranslationRow = {
  id: number;
  post_id: number;
  source_language: string | null;
  target_language: string | null;
  status: string | null;
  translated_title: string | null;
  translated_body: string | null;
  source_hash: string | null;
  source_updated_at: string;
  updated_at: string;
  created_at: string;
};

export type AdminPostTranslationListItem = {
  id: number;
  title: string;
  originalLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  updatedAt: string;
  createdAt: string;
  hasCurrentCompletedTranslation: boolean;
};

export type AdminPostTranslationEditorData = {
  postId: number;
  title: string;
  body: string;
  originalLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  updatedAt: string;
  existingTranslation: {
    id: number;
    status: string;
    translatedTitle: string;
    translatedBody: string;
    sourceUpdatedAt: string;
    updatedAt: string;
  } | null;
};

function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  return value === "en" ? "en" : "ko";
}

function oppositeLanguage(value: SupportedLanguage): SupportedLanguage {
  return value === "ko" ? "en" : "ko";
}

function toDisplayTitle(value: string | null | undefined): string {
  if (!value) {
    return "(untitled)";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "(untitled)";
}

function buildSourceHash(params: {
  originalLanguage: SupportedLanguage;
  title: string;
  body: string;
  updatedAt: string;
}): string {
  const source = [
    params.originalLanguage,
    params.title,
    params.body,
    params.updatedAt
  ].join("\n");

  return createHash("sha256").update(source).digest("hex");
}

export async function fetchRecentPostsForTranslation(
  limit = 30
): Promise<AdminPostTranslationListItem[]> {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient();

  const { data: postsData, error: postsError } = await client
    .from("posts")
    .select("id, title, original_language, updated_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (postsError) {
    throw new Error(postsError.message);
  }

  const posts = (postsData ?? []) as unknown as RawPostRow[];
  if (posts.length === 0) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const { data: translationsData, error: translationsError } = await client
    .from("post_translations")
    .select("id, post_id, target_language, status, source_updated_at")
    .in("post_id", postIds)
    .eq("status", "completed");

  if (translationsError) {
    throw new Error(translationsError.message);
  }

  const completedRows = (translationsData ?? []) as Array<{
    post_id: number;
    target_language: string | null;
    source_updated_at: string;
  }>;

  const completedKeySet = new Set(
    completedRows.map((row) => `${row.post_id}:${row.target_language ?? ""}:${row.source_updated_at}`)
  );

  return posts.map((post) => {
    const originalLanguage = normalizeLanguage(post.original_language);
    const targetLanguage = oppositeLanguage(originalLanguage);
    const hasCurrentCompletedTranslation = completedKeySet.has(
      `${post.id}:${targetLanguage}:${post.updated_at}`
    );

    return {
      id: post.id,
      title: toDisplayTitle(post.title),
      originalLanguage,
      targetLanguage,
      updatedAt: post.updated_at,
      createdAt: post.created_at,
      hasCurrentCompletedTranslation
    };
  });
}

export async function fetchPostTranslationEditorData(
  postId: number
): Promise<AdminPostTranslationEditorData | null> {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient();

  const { data: postData, error: postError } = await client
    .from("posts")
    .select("id, title, body, original_language, updated_at")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  const post = (postData ?? null) as RawPostRow | null;
  if (!post) {
    return null;
  }

  const originalLanguage = normalizeLanguage(post.original_language);
  const targetLanguage = oppositeLanguage(originalLanguage);

  const { data: translationData, error: translationError } = await client
    .from("post_translations")
    .select("id, post_id, source_language, target_language, status, translated_title, translated_body, source_hash, source_updated_at, updated_at, created_at")
    .eq("post_id", postId)
    .eq("target_language", targetLanguage)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (translationError) {
    throw new Error(translationError.message);
  }

  const existing = (translationData ?? null) as RawPostTranslationRow | null;

  return {
    postId: post.id,
    title: post.title ?? "",
    body: post.body ?? "",
    originalLanguage,
    targetLanguage,
    updatedAt: post.updated_at,
    existingTranslation: existing
      ? {
          id: existing.id,
          status: existing.status ?? "unknown",
          translatedTitle: existing.translated_title ?? "",
          translatedBody: existing.translated_body ?? "",
          sourceUpdatedAt: existing.source_updated_at,
          updatedAt: existing.updated_at
        }
      : null
  };
}

export async function saveManualPostTranslation(input: {
  postId: number;
  targetLanguage: SupportedLanguage;
  translatedTitle: string;
  translatedBody: string;
}): Promise<{ translationId: number }> {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient();

  const { data: postData, error: postError } = await client
    .from("posts")
    .select("id, title, body, original_language, updated_at")
    .eq("id", input.postId)
    .maybeSingle();

  if (postError) {
    throw new Error(postError.message);
  }

  const post = (postData ?? null) as RawPostRow | null;
  if (!post) {
    throw new Error("Post not found.");
  }

  const originalLanguage = normalizeLanguage(post.original_language);
  const expectedTargetLanguage = oppositeLanguage(originalLanguage);
  if (input.targetLanguage !== expectedTargetLanguage) {
    throw new Error("Target language must be the opposite of original_language.");
  }

  const sourceHash = buildSourceHash({
    originalLanguage,
    title: post.title ?? "",
    body: post.body ?? "",
    updatedAt: post.updated_at
  });

  const nowIso = new Date().toISOString();

  const { data: existingData, error: existingError } = await client
    .from("post_translations")
    .select("id")
    .eq("post_id", input.postId)
    .eq("target_language", input.targetLanguage)
    .eq("source_hash", sourceHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingId = (existingData as { id: number } | null)?.id ?? null;

  if (existingId) {
    const { error: updateError } = await client
      .from("post_translations")
      .update({
        source_language: originalLanguage,
        target_language: input.targetLanguage,
        status: "completed",
        translated_title: input.translatedTitle,
        translated_body: input.translatedBody,
        translated_abstract: null,
        source_hash: sourceHash,
        source_updated_at: post.updated_at,
        error_message: null,
        completed_at: nowIso,
        last_attempt_at: nowIso
      })
      .eq("id", existingId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return { translationId: existingId };
  }

  const { data: insertData, error: insertError } = await client
    .from("post_translations")
    .insert({
      post_id: input.postId,
      source_language: originalLanguage,
      target_language: input.targetLanguage,
      status: "completed",
      translated_title: input.translatedTitle,
      translated_body: input.translatedBody,
      translated_abstract: null,
      source_hash: sourceHash,
      source_updated_at: post.updated_at,
      attempt_count: 0,
      error_message: null,
      last_attempt_at: nowIso,
      completed_at: nowIso
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    translationId: (insertData as { id: number }).id
  };
}
