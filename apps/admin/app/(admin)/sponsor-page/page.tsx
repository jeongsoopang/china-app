import {
  createEventBannerAction,
  createEventSponsorAction,
  deleteEventBannerAction,
  deleteEventSponsorAction,
  moveEventBannerAction,
  moveEventSponsorAction,
  updateEventBannerAction,
  updateEventSponsorAction
} from "../../../lib/sponsor/actions";
import { fetchSponsorPageData } from "../../../lib/sponsor/sponsor.service";

export const dynamic = "force-dynamic";

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function SponsorPage() {
  let loadError: string | null = null;
  let banners = [] as Awaited<ReturnType<typeof fetchSponsorPageData>>["banners"];
  let sponsors = [] as Awaited<ReturnType<typeof fetchSponsorPageData>>["sponsors"];

  try {
    const data = await fetchSponsorPageData();
    banners = data.banners;
    sponsors = data.sponsors;
  } catch (error) {
    console.error("[admin] sponsor page load failed", error);
    loadError = "Failed to load sponsor page data.";
  }

  const activeBanners = banners.filter((row) => row.is_active);
  const activeSponsors = sponsors.filter((row) => row.is_active);
  const hiddenSponsors = sponsors.filter((row) => !row.is_active);
  const lastUpdatedAt = [...banners, ...sponsors]
    .map((row) => row.updated_at)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  return (
    <section>
      <h2>Sponsor Page</h2>
      <p>Manage Event page banners and sponsor items shown in the mobile app.</p>

      <div className="metrics-grid">
        <article className="metric-card">
          <h3>Active Banners</h3>
          <p className="metric-value">{activeBanners.length}</p>
        </article>
        <article className="metric-card">
          <h3>Active Sponsors</h3>
          <p className="metric-value">{activeSponsors.length}</p>
        </article>
        <article className="metric-card">
          <h3>Hidden Sponsors</h3>
          <p className="metric-value">{hiddenSponsors.length}</p>
        </article>
        <article className="metric-card">
          <h3>Last Updated</h3>
          <p className="metric-value">{lastUpdatedAt ? formatTime(lastUpdatedAt) : "-"}</p>
        </article>
      </div>

      {loadError ? <p className="error-text">{loadError}</p> : null}

      <section style={{ marginTop: 24 }}>
        <h3>Event Hero Banners</h3>
        <p className="muted-text">
          Top rotating/scrollable banner images for the Event 맛집 page.
        </p>

        <article className="data-card" style={{ marginTop: 12 }}>
          <header className="data-card-header">
            <h3>Add Banner</h3>
          </header>
          <form action={createEventBannerAction} className="action-form">
            <label>
              Title
              <input name="title" type="text" placeholder="Optional banner title" />
            </label>
            <label>
              Image URL
              <input name="imageUrl" type="url" placeholder="https://..." required />
            </label>
            <label>
              Sort Order
              <input name="sortOrder" type="number" defaultValue="0" required />
            </label>
            <label>
              Active
              <input name="isActive" type="checkbox" defaultChecked />
            </label>
            <button type="submit">Add Banner</button>
          </form>
        </article>

        <div className="data-list" style={{ marginTop: 12 }}>
          {banners.length === 0 ? <p>No event banners yet.</p> : null}
          {banners.map((banner) => (
            <article key={banner.id} className="data-card">
              <header className="data-card-header">
                <h3>Banner #{banner.id}</h3>
                <span className="status-badge">{banner.is_active ? "active" : "hidden"}</span>
              </header>

              <div className="preview-row">
                <img
                  src={banner.image_url}
                  alt={banner.title || `Banner ${banner.id}`}
                  className="preview-banner"
                />
              </div>

              <form action={updateEventBannerAction} className="action-form">
                <input name="id" type="hidden" value={String(banner.id)} />
                <label>
                  Title
                  <input name="title" type="text" defaultValue={banner.title} />
                </label>
                <label>
                  Image URL
                  <input name="imageUrl" type="url" defaultValue={banner.image_url} required />
                </label>
                <label>
                  Sort Order
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={String(banner.sort_order)}
                    required
                  />
                </label>
                <label>
                  Active
                  <input name="isActive" type="checkbox" defaultChecked={banner.is_active} />
                </label>
                <button type="submit">Save Banner</button>
              </form>

              <div className="inline-actions">
                <form action={moveEventBannerAction}>
                  <input name="id" type="hidden" value={String(banner.id)} />
                  <input name="direction" type="hidden" value="up" />
                  <button type="submit">Move Up</button>
                </form>
                <form action={moveEventBannerAction}>
                  <input name="id" type="hidden" value={String(banner.id)} />
                  <input name="direction" type="hidden" value="down" />
                  <button type="submit">Move Down</button>
                </form>
                <form action={deleteEventBannerAction}>
                  <input name="id" type="hidden" value={String(banner.id)} />
                  <button type="submit" className="danger-button">
                    Delete
                  </button>
                </form>
              </div>

              <p className="muted-text">
                Created: {formatTime(banner.created_at)} · Updated: {formatTime(banner.updated_at)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3>Sponsor Items</h3>
        <p className="muted-text">
          Circular sponsor items under the Event page banner. Sponsor count is dynamic.
        </p>

        <article className="data-card" style={{ marginTop: 12 }}>
          <header className="data-card-header">
            <h3>Add Sponsor</h3>
          </header>
          <form action={createEventSponsorAction} className="action-form">
            <label>
              Name
              <input name="name" type="text" placeholder="Sponsor name" required />
            </label>
            <label>
              Image URL
              <input name="imageUrl" type="url" placeholder="https://..." required />
            </label>
            <label>
              Link URL
              <input name="linkUrl" type="url" placeholder="Optional sponsor link" />
            </label>
            <label>
              Sort Order
              <input name="sortOrder" type="number" defaultValue="0" required />
            </label>
            <label>
              Active
              <input name="isActive" type="checkbox" defaultChecked />
            </label>
            <button type="submit">Add Sponsor</button>
          </form>
        </article>

        <div className="data-list" style={{ marginTop: 12 }}>
          {sponsors.length === 0 ? <p>No sponsor items yet.</p> : null}
          {sponsors.map((sponsor) => (
            <article key={sponsor.id} className="data-card">
              <header className="data-card-header">
                <h3>Sponsor #{sponsor.id}</h3>
                <span className="status-badge">{sponsor.is_active ? "active" : "hidden"}</span>
              </header>

              <div className="preview-row">
                <img src={sponsor.image_url} alt={sponsor.name} className="preview-sponsor" />
              </div>

              <form action={updateEventSponsorAction} className="action-form">
                <input name="id" type="hidden" value={String(sponsor.id)} />
                <label>
                  Name
                  <input name="name" type="text" defaultValue={sponsor.name} required />
                </label>
                <label>
                  Image URL
                  <input name="imageUrl" type="url" defaultValue={sponsor.image_url} required />
                </label>
                <label>
                  Link URL
                  <input name="linkUrl" type="url" defaultValue={sponsor.link_url ?? ""} />
                </label>
                <label>
                  Sort Order
                  <input
                    name="sortOrder"
                    type="number"
                    defaultValue={String(sponsor.sort_order)}
                    required
                  />
                </label>
                <label>
                  Active
                  <input name="isActive" type="checkbox" defaultChecked={sponsor.is_active} />
                </label>
                <button type="submit">Save Sponsor</button>
              </form>

              <div className="inline-actions">
                <form action={moveEventSponsorAction}>
                  <input name="id" type="hidden" value={String(sponsor.id)} />
                  <input name="direction" type="hidden" value="up" />
                  <button type="submit">Move Up</button>
                </form>
                <form action={moveEventSponsorAction}>
                  <input name="id" type="hidden" value={String(sponsor.id)} />
                  <input name="direction" type="hidden" value="down" />
                  <button type="submit">Move Down</button>
                </form>
                <form action={deleteEventSponsorAction}>
                  <input name="id" type="hidden" value={String(sponsor.id)} />
                  <button type="submit" className="danger-button">
                    Delete
                  </button>
                </form>
              </div>

              <p className="muted-text">
                Created: {formatTime(sponsor.created_at)} · Updated: {formatTime(sponsor.updated_at)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
