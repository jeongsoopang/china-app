import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type SupportedLanguage = "ko" | "en";
type TranslationStatus = "pending" | "completed" | "failed";

type PendingTranslationRow = {
  id: number;
  post_id: number;
  source_language: SupportedLanguage;
  target_language: SupportedLanguage;
  source_hash: string;
  source_updated_at: string;
  status: TranslationStatus;
  attempt_count: number;
  created_at: string;
};

type SourcePostRow = {
  id: number;
  title: string;
  body: string;
  original_language: SupportedLanguage;
  updated_at: string;
};

type OpenAITranslationResult = {
  translated_title: string;
  translated_body: string;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return "Unknown translation worker error.";
}

function normalizeLanguage(value: string): SupportedLanguage | null {
  if (value === "ko" || value === "en") {
    return value;
  }
  return null;
}

function getTargetLanguageName(language: SupportedLanguage): string {
  return language === "ko" ? "Korean" : "English";
}

async function translateWithOpenAI(params: {
  apiKey: string;
  model: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  title: string;
  body: string;
}): Promise<OpenAITranslationResult> {
  const { apiKey, model, sourceLanguage, targetLanguage, title, body } = params;
  const sourceLanguageName = getTargetLanguageName(sourceLanguage);
  const targetLanguageName = getTargetLanguageName(targetLanguage);

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a precise translator. Translate faithfully with no added facts, no omissions, and no summarization. Keep tone and meaning natural in the target language."
      },
      {
        role: "user",
        content: [
          `Source language: ${sourceLanguageName}`,
          `Target language: ${targetLanguageName}`,
          "Translate the following fields:",
          `title: ${title}`,
          `body: ${body}`,
          "Return JSON with keys translated_title and translated_body."
        ].join("\n")
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "post_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            translated_title: { type: "string" },
            translated_body: { type: "string" }
          },
          required: ["translated_title", "translated_body"],
          additionalProperties: false
        }
      }
    }
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | null;
      } | null;
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI returned an empty translation payload.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI JSON output: ${toErrorMessage(error)}`);
  }

  const translatedTitle =
    parsed && typeof parsed === "object" && "translated_title" in parsed
      ? (parsed as { translated_title?: unknown }).translated_title
      : null;
  const translatedBody =
    parsed && typeof parsed === "object" && "translated_body" in parsed
      ? (parsed as { translated_body?: unknown }).translated_body
      : null;

  if (typeof translatedTitle !== "string" || translatedTitle.trim().length === 0) {
    throw new Error("OpenAI output missing translated_title.");
  }

  if (typeof translatedBody !== "string" || translatedBody.trim().length === 0) {
    throw new Error("OpenAI output missing translated_body.");
  }

  return {
    translated_title: translatedTitle.trim(),
    translated_body: translatedBody.trim()
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    const openAiModel = Deno.env.get("OPENAI_MODEL");
    const workerSecret = Deno.env.get("TRANSLATE_POSTS_WORKER_SECRET");

    if (!supabaseUrl || !serviceRoleKey || !openAiApiKey || !openAiModel || !workerSecret) {
      return jsonResponse(500, {
        success: false,
        error: "Missing required server secrets."
      });
    }

    const inboundSecret = req.headers.get("x-worker-secret") ?? "";
    if (inboundSecret !== workerSecret) {
      return jsonResponse(401, {
        success: false,
        error: "Unauthorized worker request."
      });
    }

    const body = await req.json().catch(() => ({}));
    const batchSizeRaw = typeof body?.batchSize === "number" ? body.batchSize : 5;
    const batchSize = Math.max(1, Math.min(20, Math.trunc(batchSizeRaw)));

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: pendingRows, error: pendingError } = await supabase
      .from("post_translations")
      .select("id, post_id, source_language, target_language, source_hash, source_updated_at, status, attempt_count, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (pendingError) {
      return jsonResponse(500, {
        success: false,
        error: pendingError.message
      });
    }

    const queue = (pendingRows ?? []) as PendingTranslationRow[];
    if (queue.length === 0) {
      return jsonResponse(200, {
        success: true,
        fetched: 0,
        completed: 0,
        failed: 0
      });
    }

    const postIds = Array.from(new Set(queue.map((row) => row.post_id)));
    const { data: sourcePosts, error: postsError } = await supabase
      .from("posts")
      .select("id, title, body, original_language, updated_at")
      .in("id", postIds);

    if (postsError) {
      return jsonResponse(500, {
        success: false,
        error: postsError.message
      });
    }

    const sourcePostById = new Map<number, SourcePostRow>();
    ((sourcePosts ?? []) as SourcePostRow[]).forEach((post) => {
      sourcePostById.set(post.id, post);
    });

    let completedCount = 0;
    let failedCount = 0;
    const rowResults: Array<Record<string, unknown>> = [];

    for (const row of queue) {
      try {
        const sourcePost = sourcePostById.get(row.post_id);
        if (!sourcePost) {
          throw new Error(`Source post not found for post_id=${row.post_id}`);
        }

        const sourceLanguage = normalizeLanguage(row.source_language);
        const targetLanguage = normalizeLanguage(row.target_language);
        const postOriginalLanguage = normalizeLanguage(sourcePost.original_language);

        if (!sourceLanguage || !targetLanguage || !postOriginalLanguage) {
          throw new Error("Unsupported language value in translation row or source post.");
        }

        if (sourceLanguage === targetLanguage) {
          throw new Error("Source and target language must be different.");
        }

        if (postOriginalLanguage !== sourceLanguage) {
          throw new Error(
            `Language mismatch: post.original_language=${postOriginalLanguage}, row.source_language=${sourceLanguage}`
          );
        }

        if (sourcePost.updated_at !== row.source_updated_at) {
          throw new Error("Source updated_at mismatch: source content changed after enqueue.");
        }

        const translated = await translateWithOpenAI({
          apiKey: openAiApiKey,
          model: openAiModel,
          sourceLanguage,
          targetLanguage,
          title: sourcePost.title ?? "",
          body: sourcePost.body ?? ""
        });

        const nowIso = new Date().toISOString();
        const { error: completeError } = await supabase
          .from("post_translations")
          .update({
            translated_title: translated.translated_title,
            translated_body: translated.translated_body,
            translated_abstract: null,
            status: "completed",
            error_message: null,
            completed_at: nowIso,
            last_attempt_at: nowIso
          })
          .eq("id", row.id)
          .eq("status", "pending");

        if (completeError) {
          throw new Error(`Failed to save completed translation: ${completeError.message}`);
        }

        completedCount += 1;
        rowResults.push({
          translationId: row.id,
          postId: row.post_id,
          status: "completed"
        });
      } catch (error) {
        const message = toErrorMessage(error);
        const nowIso = new Date().toISOString();
        const { error: failedUpdateError } = await supabase
          .from("post_translations")
          .update({
            status: "failed",
            attempt_count: row.attempt_count + 1,
            error_message: message.slice(0, 2000),
            last_attempt_at: nowIso,
            completed_at: null
          })
          .eq("id", row.id);

        if (failedUpdateError) {
          rowResults.push({
            translationId: row.id,
            postId: row.post_id,
            status: "failed",
            error: `Primary failure: ${message}; failed-update error: ${failedUpdateError.message}`
          });
        } else {
          rowResults.push({
            translationId: row.id,
            postId: row.post_id,
            status: "failed",
            error: message
          });
        }

        failedCount += 1;
      }
    }

    return jsonResponse(200, {
      success: true,
      fetched: queue.length,
      completed: completedCount,
      failed: failedCount,
      results: rowResults
    });
  } catch (error) {
    return jsonResponse(500, {
      success: false,
      error: toErrorMessage(error)
    });
  }
});
