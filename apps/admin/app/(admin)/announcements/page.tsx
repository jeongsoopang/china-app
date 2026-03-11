import { publishAnnouncementAction } from "../../../lib/moderation/actions";
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

  return (
    <section>
      <h2>Announcements</h2>
      <p>Publish pending announcements to student feeds.</p>

      {announcementsError ? <p className="error-text">{announcementsError}</p> : null}

      {!announcementsError && announcements.length === 0 ? (
        <p>No announcements available.</p>
      ) : (
        <div className="data-list">
          {announcements.map((announcement) => {
            const isPublished = announcement.published_at !== null;

            return (
              <article key={announcement.id} className="data-card">
                <header className="data-card-header">
                  <h3>{announcement.title}</h3>
                  <span className="status-badge">{announcement.status}</span>
                </header>

                <p>{announcement.body}</p>

                <dl className="data-grid">
                  <div>
                    <dt>ID</dt>
                    <dd>{announcement.id}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatTime(announcement.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Published At</dt>
                    <dd>{formatTime(announcement.published_at)}</dd>
                  </div>
                </dl>

                <form action={publishAnnouncementAction} className="action-form">
                  <input
                    name="announcementId"
                    type="hidden"
                    value={String(announcement.id)}
                  />
                  <button type="submit" disabled={isPublished}>
                    {isPublished ? "Published" : "Publish"}
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
