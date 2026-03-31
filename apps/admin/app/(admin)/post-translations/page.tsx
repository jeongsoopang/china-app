import Link from "next/link";
import { saveManualPostTranslationAction } from "../../../lib/post-translations/actions";
import {
  fetchPostTranslationEditorData,
  fetchRecentPostsForTranslation
} from "../../../lib/post-translations/post-translations.service";

export const dynamic = "force-dynamic";

type PostTranslationsPageProps = {
  searchParams?: Promise<{
    postId?: string;
    notice?: string;
    error?: string;
  }>;
};

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function languageLabel(value: "ko" | "en"): string {
  return value === "ko" ? "KR" : "EN";
}

export default async function PostTranslationsPage({
  searchParams
}: PostTranslationsPageProps) {
  const params = (await searchParams) ?? {};
  const selectedPostId = typeof params.postId === "string" && /^\d+$/.test(params.postId)
    ? Number(params.postId)
    : null;

  let listError: string | null = null;
  let editorError: string | null = null;

  let posts = [] as Awaited<ReturnType<typeof fetchRecentPostsForTranslation>>;
  let editor = null as Awaited<ReturnType<typeof fetchPostTranslationEditorData>>;

  try {
    posts = await fetchRecentPostsForTranslation(30);
  } catch (error) {
    listError = error instanceof Error ? error.message : "Failed to load posts.";
  }

  if (selectedPostId) {
    try {
      editor = await fetchPostTranslationEditorData(selectedPostId);
      if (!editor) {
        editorError = "Post not found.";
      }
    } catch (error) {
      editorError = error instanceof Error ? error.message : "Failed to load post translation editor.";
    }
  }

  return (
    <section>
      <h2>Post Translations</h2>
      <p>수동 번역 작성/수정 관리 화면입니다. 자동 번역 큐 없이 관리자 입력만 저장합니다.</p>

      {params.notice ? <p style={{ color: "#166534", marginBottom: 12 }}>{params.notice}</p> : null}
      {params.error ? <p className="error-text">{params.error}</p> : null}
      {listError ? <p className="error-text">{listError}</p> : null}
      {editorError ? <p className="error-text">{editorError}</p> : null}

      <article className="data-card" style={{ marginBottom: 20 }}>
        <header className="data-card-header">
          <h3>Open Post by ID</h3>
        </header>
        <form method="get" className="action-form">
          <label>
            Post ID
            <input name="postId" type="text" defaultValue={selectedPostId ?? ""} placeholder="e.g. 1234" />
          </label>
          <button type="submit">Open</button>
        </form>
      </article>

      {editor ? (
        <article className="data-card" style={{ marginBottom: 20 }}>
          <header className="data-card-header">
            <h3>Editing Post #{editor.postId}</h3>
            <span className="status-badge">
              {languageLabel(editor.originalLanguage)} → {languageLabel(editor.targetLanguage)}
            </span>
          </header>

          <dl className="data-grid">
            <div>
              <dt>Original Updated</dt>
              <dd>{formatTime(editor.updatedAt)}</dd>
            </div>
            <div>
              <dt>Existing Translation</dt>
              <dd>{editor.existingTranslation ? editor.existingTranslation.status : "none"}</dd>
            </div>
          </dl>

          <h4 style={{ marginBottom: 8 }}>Original</h4>
          <p style={{ fontWeight: 700, marginTop: 0 }}>{editor.title || "(untitled)"}</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: 12
            }}
          >
            {editor.body || "(empty body)"}
          </pre>

          <h4 style={{ marginBottom: 8 }}>Manual Translation ({languageLabel(editor.targetLanguage)})</h4>
          <form action={saveManualPostTranslationAction} className="action-form">
            <input name="postId" type="hidden" value={String(editor.postId)} />
            <input name="targetLanguage" type="hidden" value={editor.targetLanguage} />

            <label>
              Translated Title
              <input
                name="translatedTitle"
                type="text"
                defaultValue={editor.existingTranslation?.translatedTitle ?? ""}
                required
              />
            </label>

            <label style={{ gridColumn: "1 / -1" }}>
              Translated Body
              <textarea
                name="translatedBody"
                defaultValue={editor.existingTranslation?.translatedBody ?? ""}
                rows={12}
                required
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  padding: 12,
                  font: "inherit",
                  resize: "vertical"
                }}
              />
            </label>

            <button type="submit">Save Translation</button>
          </form>
        </article>
      ) : null}

      {!listError && (
        <article className="data-card" style={{ marginBottom: 20 }}>
          <header className="data-card-header">
            <h3>Recent Posts</h3>
          </header>
          {posts.length === 0 ? (
            <p>No recent posts found.</p>
          ) : (
            <div className="data-list">
              {posts.map((post) => (
                <article key={post.id} className="data-card">
                  <header className="data-card-header">
                    <h3>#{post.id} {post.title}</h3>
                    <span className="status-badge">
                      {languageLabel(post.originalLanguage)} → {languageLabel(post.targetLanguage)}
                    </span>
                  </header>
                  <dl className="data-grid">
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatTime(post.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt>Translation</dt>
                      <dd>{post.hasCurrentCompletedTranslation ? "completed" : "not translated yet"}</dd>
                    </div>
                  </dl>
                  <Link href={`/post-translations?postId=${post.id}`}>Open editor</Link>
                </article>
              ))}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
