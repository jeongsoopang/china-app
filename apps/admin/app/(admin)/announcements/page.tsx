import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  publishAnnouncementAction,
  updateAnnouncementAction
} from "../../../lib/moderation/actions";
import { fetchAnnouncements } from "../../../lib/moderation/moderation.service";

export const dynamic = "force-dynamic";

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function AnnouncementsPage() {
  let announcementsError: string | null = null;
  let announcements = [] as Awaited<ReturnType<typeof fetchAnnouncements>>;

  try {
    announcements = await fetchAnnouncements();
  } catch (error) {
    announcementsError =
      error instanceof Error ? error.message : "Failed to load announcements.";
  }

  const draftAnnouncements = announcements.filter((announcement) => !announcement.is_published);
  const publishedAnnouncements = announcements.filter((announcement) => announcement.is_published);

  return (
    <section>
      <h2>Announcements</h2>
      <p>Create announcement drafts, then publish them to student feeds.</p>

      <article className="data-card" style={{ marginBottom: 24 }}>
        <header className="data-card-header">
          <h3>Create Announcement</h3>
        </header>

        <form action={createAnnouncementAction} className="action-form">
          <label>
            Title
            <input
              name="title"
              type="text"
              placeholder="Enter announcement title"
              maxLength={120}
              required
            />
          </label>

          <label>
            Outline
            <input
              name="outline"
              type="text"
              placeholder="Short summary shown on the app card"
              maxLength={180}
              required
            />
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Body
            <textarea
              name="body"
              placeholder="Write full announcement body"
              rows={8}
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

          <button type="submit">Create Draft</button>
        </form>
      </article>

      {announcementsError ? <p className="error-text">{announcementsError}</p> : null}

      {!announcementsError && announcements.length === 0 ? (
        <p>No announcements available.</p>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          <section>
            <h3 style={{ marginBottom: 8 }}>Drafts</h3>
            <p className="muted-text" style={{ marginTop: 0 }}>
              Draft announcements are visible only in admin until published.
            </p>

            {draftAnnouncements.length === 0 ? (
              <p>No draft announcements.</p>
            ) : (
              <div className="data-list">
                {draftAnnouncements.map((announcement) => (
                  <article key={announcement.id} className="data-card">
                    <header className="data-card-header">
                      <h3>{announcement.title}</h3>
                      <span className="status-badge">draft</span>
                    </header>

                    <p style={{ marginBottom: 6, fontWeight: 600 }}>{announcement.outline}</p>
                    <p style={{ whiteSpace: "pre-wrap" }}>{announcement.body}</p>

                    <dl className="data-grid">
                      <div>
                        <dt>ID</dt>
                        <dd>{announcement.id}</dd>
                      </div>
                      <div>
                        <dt>Author</dt>
                        <dd>{announcement.author_user_id}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatTime(announcement.created_at)}</dd>
                      </div>
                      <div>
                        <dt>Published</dt>
                        <dd>{formatTime(announcement.published_at)}</dd>
                      </div>
                    </dl>

                    <form action={publishAnnouncementAction} className="action-form">
                      <input
                        name="announcementId"
                        type="hidden"
                        value={String(announcement.id)}
                      />
                      <button type="submit">Publish Announcement</button>
                    </form>

                    <details style={{ marginTop: 16 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                        Edit announcement
                      </summary>

                      <form action={updateAnnouncementAction} className="action-form" style={{ marginTop: 12 }}>
                        <input
                          name="announcementId"
                          type="hidden"
                          value={String(announcement.id)}
                        />

                        <label>
                          Title
                          <input name="title" type="text" defaultValue={announcement.title} required />
                        </label>

                        <label>
                          Outline
                          <input
                            name="outline"
                            type="text"
                            defaultValue={announcement.outline}
                            required
                          />
                        </label>

                        <label style={{ gridColumn: "1 / -1" }}>
                          Body
                          <textarea
                            name="body"
                            defaultValue={announcement.body}
                            rows={8}
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

                        <button type="submit">Save Changes</button>
                      </form>
                    </details>

                    <form action={deleteAnnouncementAction} style={{ marginTop: 12 }}>
                      <input
                        name="announcementId"
                        type="hidden"
                        value={String(announcement.id)}
                      />
                      <button
                        type="submit"
                        style={{
                          border: "1px solid #ef4444",
                          color: "#b91c1c",
                          background: "#fff",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontWeight: 700
                        }}
                      >
                        Delete Announcement
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 style={{ marginBottom: 8 }}>Published</h3>
            <p className="muted-text" style={{ marginTop: 0 }}>
              These announcements have already been published to student feeds.
            </p>

            {publishedAnnouncements.length === 0 ? (
              <p>No published announcements yet.</p>
            ) : (
              <div className="data-list">
                {publishedAnnouncements.map((announcement) => (
                  <article key={announcement.id} className="data-card">
                    <header className="data-card-header">
                      <h3>{announcement.title}</h3>
                      <span className="status-badge">published</span>
                    </header>

                    <p style={{ marginBottom: 6, fontWeight: 600 }}>{announcement.outline}</p>
                    <p style={{ whiteSpace: "pre-wrap" }}>{announcement.body}</p>

                    <dl className="data-grid">
                      <div>
                        <dt>ID</dt>
                        <dd>{announcement.id}</dd>
                      </div>
                      <div>
                        <dt>Author</dt>
                        <dd>{announcement.author_user_id}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatTime(announcement.created_at)}</dd>
                      </div>
                      <div>
                        <dt>Published</dt>
                        <dd>{formatTime(announcement.published_at)}</dd>
                      </div>
                    </dl>

                    <details style={{ marginTop: 16 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                        Edit announcement
                      </summary>

                      <form action={updateAnnouncementAction} className="action-form" style={{ marginTop: 12 }}>
                        <input
                          name="announcementId"
                          type="hidden"
                          value={String(announcement.id)}
                        />

                        <label>
                          Title
                          <input name="title" type="text" defaultValue={announcement.title} required />
                        </label>

                        <label>
                          Outline
                          <input
                            name="outline"
                            type="text"
                            defaultValue={announcement.outline}
                            required
                          />
                        </label>

                        <label style={{ gridColumn: "1 / -1" }}>
                          Body
                          <textarea
                            name="body"
                            defaultValue={announcement.body}
                            rows={8}
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

                        <button type="submit">Save Changes</button>
                      </form>
                    </details>

                    <form action={deleteAnnouncementAction} style={{ marginTop: 12 }}>
                      <input
                        name="announcementId"
                        type="hidden"
                        value={String(announcement.id)}
                      />
                      <button
                        type="submit"
                        style={{
                          border: "1px solid #ef4444",
                          color: "#b91c1c",
                          background: "#fff",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontWeight: 700
                        }}
                      >
                        Delete Announcement
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
