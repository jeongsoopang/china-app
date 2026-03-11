import { reviewModerationFlagAction } from "../../../lib/moderation/actions";
import { fetchModerationFlags } from "../../../lib/moderation/moderation.service";

export const dynamic = "force-dynamic";

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function ModerationPage() {
  let flagsError: string | null = null;
  let flags = [] as Awaited<ReturnType<typeof fetchModerationFlags>>;

  try {
    flags = await fetchModerationFlags();
  } catch (error) {
    flagsError =
      error instanceof Error ? error.message : "Failed to load moderation flags.";
  }

  return (
    <section>
      <h2>Moderation</h2>
      <p>Review moderation flags and update disposition.</p>

      {flagsError ? <p className="error-text">{flagsError}</p> : null}

      {!flagsError && flags.length === 0 ? (
        <p>No moderation flags available.</p>
      ) : (
        <div className="data-list">
          {flags.map((flag) => (
            <article key={flag.id} className="data-card">
              <header className="data-card-header">
                <h3>Flag #{flag.id}</h3>
                <span className="status-badge">{flag.status}</span>
              </header>

              <dl className="data-grid">
                <div>
                  <dt>Target</dt>
                  <dd>
                    {flag.target_type} #{flag.target_id}
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{flag.flag_source}</dd>
                </div>
                <div>
                  <dt>Risk Score</dt>
                  <dd>{flag.risk_score}</dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>{flag.reason_summary}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatTime(flag.created_at)}</dd>
                </div>
                <div>
                  <dt>Reviewed</dt>
                  <dd>{formatTime(flag.reviewed_at)}</dd>
                </div>
              </dl>

              <form action={reviewModerationFlagAction} className="action-form">
                <input name="flagId" type="hidden" value={String(flag.id)} />

                <label>
                  Next Status
                  <input
                    name="nextStatus"
                    required
                    defaultValue={flag.status || "reviewed"}
                    placeholder="reviewed"
                  />
                </label>

                <button type="submit">Apply Review</button>
              </form>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
