import { saveUniversityAlumniContentAction } from "../../../lib/alumni/actions";
import {
  DEFAULT_UNIVERSITY_ALUMNI_CONTENT,
  fetchUniversitiesForAlumniAdmin,
  fetchUniversityAlumniContentForAdmin
} from "../../../lib/alumni/alumni.service";

export const dynamic = "force-dynamic";

type AlumniPageProps = {
  searchParams?: Promise<{
    universityId?: string;
  }>;
};

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function AlumniPage({ searchParams }: AlumniPageProps) {
  const params = (await searchParams) ?? {};
  let loadError: string | null = null;
  let universities = [] as Awaited<ReturnType<typeof fetchUniversitiesForAlumniAdmin>>;

  try {
    universities = await fetchUniversitiesForAlumniAdmin();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load universities.";
  }

  const selectedUniversityId =
    params.universityId && universities.some((university) => university.id === params.universityId)
      ? params.universityId
      : universities[0]?.id ?? null;

  const selectedUniversity =
    selectedUniversityId != null
      ? universities.find((university) => university.id === selectedUniversityId) ?? null
      : null;

  let content = DEFAULT_UNIVERSITY_ALUMNI_CONTENT;
  if (!loadError && selectedUniversityId) {
    try {
      content = await fetchUniversityAlumniContentForAdmin(selectedUniversityId);
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Failed to load alumni content.";
    }
  }

  return (
    <section className="home-guide-shell">
      <header className="home-guide-header-card">
        <h2>Alumni Content Editor</h2>
        <p>Manage university-specific alumni letter content shown on the mobile university page.</p>
      </header>

      {loadError ? (
        <article className="home-guide-error-card">
          <h3>Unable to load alumni content</h3>
          <p>{loadError}</p>
        </article>
      ) : null}

      <article className="data-card home-guide-editor-card">
        <header className="data-card-header">
          <h3>University Alumni Letter</h3>
          <span className="status-badge">{content.is_visible ? "visible" : "hidden"}</span>
        </header>

        <form method="get" className="action-form alumni-university-picker">
          <label>
            University
            <select name="universityId" defaultValue={selectedUniversityId ?? ""} disabled={universities.length === 0}>
              {universities.map((university) => (
                <option key={university.id} value={university.id}>
                  {university.label} ({university.slug})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={universities.length === 0}>
            Load University
          </button>
        </form>

        {selectedUniversityId ? (
          <form action={saveUniversityAlumniContentAction} className="action-form home-guide-form">
            <input type="hidden" name="universityId" value={selectedUniversityId} />

            <label>
              University
              <input
                type="text"
                value={
                  selectedUniversity ? `${selectedUniversity.label} (${selectedUniversity.slug})` : selectedUniversityId
                }
                disabled
              />
            </label>

            <label>
              Title
              <input name="title" type="text" defaultValue={content.title} maxLength={140} required />
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
                rows={12}
                required
                className="home-guide-textarea"
              />
            </label>

            <button type="submit">Save Alumni Content</button>
          </form>
        ) : (
          <p className="muted-text">No university available to edit yet.</p>
        )}

        <div className="home-guide-meta-row">
          <p className="muted-text">Last updated: {formatTime(content.updated_at)}</p>
          <p className="muted-text">
            Mobile always shows the fixed first line and renders this stored content below it.
          </p>
        </div>
      </article>
    </section>
  );
}
