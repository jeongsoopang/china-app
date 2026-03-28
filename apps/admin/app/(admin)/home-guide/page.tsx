import { saveHomeGuideContentAction } from "../../../lib/home-guide/actions";
import {
  DEFAULT_HOME_GUIDE_CONTENT,
  fetchHomeGuideContentForAdmin
} from "../../../lib/home-guide/home-guide.service";

export const dynamic = "force-dynamic";

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function HomeGuidePage() {
  let loadError: string | null = null;
  let content = DEFAULT_HOME_GUIDE_CONTENT;

  try {
    content = await fetchHomeGuideContentForAdmin();
  } catch (error) {
    console.error("[admin] home guide load failed", error);
    loadError = error instanceof Error ? error.message : "Failed to load Home guide content.";
  }

  return (
    <section className="home-guide-shell">
      <header className="home-guide-header-card">
        <h2>Home Guide Editor</h2>
        <p>Manage the Announcement letter/modal content shown on the mobile Home quick action.</p>
      </header>

      {loadError ? (
        <article className="home-guide-error-card">
          <h3>Unable to load Home Guide content</h3>
          <p>{loadError}</p>
        </article>
      ) : null}

      <article className="data-card home-guide-editor-card">
        <header className="data-card-header">
          <h3>Guide Content</h3>
          <span className="status-badge">{content.is_visible ? "visible" : "hidden"}</span>
        </header>

        <form action={saveHomeGuideContentAction} className="action-form home-guide-form">
          <label>
            Title
            <input name="title" type="text" defaultValue={content.title} maxLength={120} required />
          </label>

          <label>
            Image URL
            <input
              name="imageUrl"
              type="url"
              placeholder="https://..."
              defaultValue={content.image_url ?? ""}
            />
          </label>

          <label className="home-guide-toggle">
            Visible in Mobile
            <input name="isVisible" type="checkbox" defaultChecked={content.is_visible} />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Body
            <textarea
              name="body"
              defaultValue={content.body}
              rows={10}
              required
              className="home-guide-textarea"
            />
          </label>

          <button type="submit">Save Home Guide</button>
        </form>

        <div className="home-guide-meta-row">
          <p className="muted-text">Last updated: {formatTime(content.updated_at)}</p>
          <p className="muted-text">Fallback copy is shown in mobile if this content is missing or hidden.</p>
        </div>
      </article>
    </section>
  );
}
