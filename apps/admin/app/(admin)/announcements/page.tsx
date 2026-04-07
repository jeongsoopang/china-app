import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  publishAnnouncementAction,
  updateAnnouncementAction
} from "../../../lib/moderation/actions";
import {
  fetchAnnouncements,
  isAnnouncementImageColumnAvailable
} from "../../../lib/moderation/moderation.service";

export const dynamic = "force-dynamic";

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function PinnedBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 999,
        border: "1px solid #fca5a5",
        backgroundColor: "#fef2f2",
        color: "#b91c1c",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        padding: "3px 9px"
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M16 3l5 5-3 3v7.5a1.5 1.5 0 0 1-2.56 1.06L12 16.12l-3.44 3.44A1.5 1.5 0 0 1 6 18.5V11L3 8l5-5z"
          fill="#b91c1c"
        />
      </svg>
      상단 고정
    </span>
  );
}

function renderAnnouncementImages(imageUrls: string[]) {
  if (imageUrls.length === 0) {
    return <p className="muted-text" style={{ marginTop: 0 }}>No attached images.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      <p className="muted-text" style={{ margin: 0 }}>
        Attached images ({imageUrls.length})
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {imageUrls.map((imageUrl) => (
          <a key={imageUrl} href={imageUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Announcement attachment"
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                backgroundColor: "#fff"
              }}
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default async function AnnouncementsPage() {
  let announcementsError: string | null = null;
  let announcements = [] as Awaited<ReturnType<typeof fetchAnnouncements>>;
  let supportsAnnouncementImages = false;

  try {
    supportsAnnouncementImages = await isAnnouncementImageColumnAvailable();
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

          <label>
            <input name="isHomePopup" type="checkbox" />
            Show as Home popup (also remains a normal announcement)
          </label>

          {supportsAnnouncementImages ? (
            <label style={{ gridColumn: "1 / -1" }}>
              Attach images (optional)
              <input name="images" type="file" accept="image/*" multiple />
            </label>
          ) : (
            <p className="muted-text" style={{ margin: 0 }}>
              Image attachments are temporarily unavailable until migration `0023` is applied.
            </p>
          )}

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
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0 }}>{announcement.title}</h3>
                        {announcement.is_pinned ? (
                          <PinnedBadge />
                        ) : null}
                      </div>
                      <span className="status-badge">draft</span>
                    </header>

                    <p style={{ marginBottom: 6, fontWeight: 600 }}>{announcement.outline}</p>
                    {renderAnnouncementImages(announcement.image_urls)}
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
                      <div>
                        <dt>Home Popup</dt>
                        <dd>{announcement.is_home_popup ? "yes" : "no"}</dd>
                      </div>
                      <div>
                        <dt>Pinned</dt>
                        <dd>{announcement.is_pinned ? "yes" : "no"}</dd>
                      </div>
                      <div>
                        <dt>Pinned At</dt>
                        <dd>{formatTime(announcement.pinned_at)}</dd>
                      </div>
                    </dl>

                    <form action={publishAnnouncementAction} className="action-form">
                      <input
                        name="announcementId"
                        type="hidden"
                        value={String(announcement.id)}
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="submit" name="publishMode" value="normal">
                          일반 발행
                        </button>
                        <button type="submit" name="publishMode" value="pinned">
                          상단 고정 발행
                        </button>
                      </div>
                    </form>

                    <details style={{ marginTop: 16 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                        Edit announcement
                      </summary>

                      <form
                        action={updateAnnouncementAction}
                        className="action-form"
                        style={{ marginTop: 12 }}
                      >
                        <input
                          name="announcementId"
                          type="hidden"
                          value={String(announcement.id)}
                        />
                        {supportsAnnouncementImages
                          ? announcement.image_urls.map((imageUrl) => (
                              <input
                                key={`${announcement.id}-${imageUrl}`}
                                name="existingImageUrls"
                                type="hidden"
                                value={imageUrl}
                              />
                            ))
                          : null}

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

                        <label>
                          <input
                            name="isHomePopup"
                            type="checkbox"
                            defaultChecked={announcement.is_home_popup}
                          />
                          Show as Home popup (also remains a normal announcement)
                        </label>

                        <fieldset
                          style={{
                            gridColumn: "1 / -1",
                            border: "none",
                            padding: 0,
                            margin: 0
                          }}
                        >
                          <legend style={{ fontWeight: 700, marginBottom: 8 }}>고정 설정</legend>
                          <div
                            style={{
                              display: "inline-flex",
                              gap: 8,
                              flexWrap: "wrap"
                            }}
                          >
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                border: "1px solid #cbd5e1",
                                borderRadius: 999,
                                padding: "6px 10px"
                              }}
                            >
                              <input
                                name="pinState"
                                type="radio"
                                value="unpinned"
                                defaultChecked={!announcement.is_pinned}
                              />
                              고정 안 함
                            </label>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                border: "1px solid #cbd5e1",
                                borderRadius: 999,
                                padding: "6px 10px"
                              }}
                            >
                              <input
                                name="pinState"
                                type="radio"
                                value="pinned"
                                defaultChecked={announcement.is_pinned}
                              />
                              상단 고정
                            </label>
                          </div>
                        </fieldset>

                        {supportsAnnouncementImages ? (
                          <label style={{ gridColumn: "1 / -1" }}>
                            Attach additional images (optional)
                            <input name="images" type="file" accept="image/*" multiple />
                          </label>
                        ) : null}

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
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0 }}>{announcement.title}</h3>
                        {announcement.is_pinned ? (
                          <PinnedBadge />
                        ) : null}
                      </div>
                      <span className="status-badge">published</span>
                    </header>

                    <p style={{ marginBottom: 6, fontWeight: 600 }}>{announcement.outline}</p>
                    {renderAnnouncementImages(announcement.image_urls)}
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
                      <div>
                        <dt>Home Popup</dt>
                        <dd>{announcement.is_home_popup ? "yes" : "no"}</dd>
                      </div>
                      <div>
                        <dt>Pinned</dt>
                        <dd>{announcement.is_pinned ? "yes" : "no"}</dd>
                      </div>
                      <div>
                        <dt>Pinned At</dt>
                        <dd>{formatTime(announcement.pinned_at)}</dd>
                      </div>
                    </dl>

                    <details style={{ marginTop: 16 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                        Edit announcement
                      </summary>

                      <form
                        action={updateAnnouncementAction}
                        className="action-form"
                        style={{ marginTop: 12 }}
                      >
                        <input
                          name="announcementId"
                          type="hidden"
                          value={String(announcement.id)}
                        />
                        {supportsAnnouncementImages
                          ? announcement.image_urls.map((imageUrl) => (
                              <input
                                key={`${announcement.id}-${imageUrl}`}
                                name="existingImageUrls"
                                type="hidden"
                                value={imageUrl}
                              />
                            ))
                          : null}

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

                        <label>
                          <input
                            name="isHomePopup"
                            type="checkbox"
                            defaultChecked={announcement.is_home_popup}
                          />
                          Show as Home popup (also remains a normal announcement)
                        </label>

                        <fieldset
                          style={{
                            gridColumn: "1 / -1",
                            border: "none",
                            padding: 0,
                            margin: 0
                          }}
                        >
                          <legend style={{ fontWeight: 700, marginBottom: 8 }}>고정 설정</legend>
                          <div
                            style={{
                              display: "inline-flex",
                              gap: 8,
                              flexWrap: "wrap"
                            }}
                          >
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                border: "1px solid #cbd5e1",
                                borderRadius: 999,
                                padding: "6px 10px"
                              }}
                            >
                              <input
                                name="pinState"
                                type="radio"
                                value="unpinned"
                                defaultChecked={!announcement.is_pinned}
                              />
                              고정 안 함
                            </label>
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                border: "1px solid #cbd5e1",
                                borderRadius: 999,
                                padding: "6px 10px"
                              }}
                            >
                              <input
                                name="pinState"
                                type="radio"
                                value="pinned"
                                defaultChecked={announcement.is_pinned}
                              />
                              상단 고정
                            </label>
                          </div>
                        </fieldset>

                        {supportsAnnouncementImages ? (
                          <label style={{ gridColumn: "1 / -1" }}>
                            Attach additional images (optional)
                            <input name="images" type="file" accept="image/*" multiple />
                          </label>
                        ) : null}

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
