import { reviewReportAction } from "../../../lib/moderation/actions";
import { fetchReports } from "../../../lib/moderation/moderation.service";

export const dynamic = "force-dynamic";

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function ReportsPage() {
  let reportsError: string | null = null;
  let reports = [] as Awaited<ReturnType<typeof fetchReports>>;

  try {
    reports = await fetchReports();
  } catch (error) {
    reportsError =
      error instanceof Error ? error.message : "Failed to load reports.";
  }

  return (
    <section>
      <h2>Reports</h2>
      <p>Review user reports and apply moderation actions.</p>

      {reportsError ? <p className="error-text">{reportsError}</p> : null}

      {!reportsError && reports.length === 0 ? (
        <p>No reports available.</p>
      ) : (
        <div className="data-list">
          {reports.map((report) => (
            <article key={report.id} className="data-card">
              <header className="data-card-header">
                <h3>Report #{report.id}</h3>
                <span className="status-badge">{report.status}</span>
              </header>

              <dl className="data-grid">
                <div>
                  <dt>Target</dt>
                  <dd>
                    {report.target_type} #{report.target_id}
                  </dd>
                </div>
                <div>
                  <dt>Reason</dt>
                  <dd>{report.reason_code}</dd>
                </div>
                <div>
                  <dt>Details</dt>
                  <dd>{report.reason_text ?? "-"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatTime(report.created_at)}</dd>
                </div>
                <div>
                  <dt>Reviewed</dt>
                  <dd>{formatTime(report.reviewed_at)}</dd>
                </div>
              </dl>

              <form action={reviewReportAction} className="action-form">
                <input name="reportId" type="hidden" value={String(report.id)} />

                <label>
                  Next Status
                  <input
                    name="nextStatus"
                    required
                    defaultValue={report.status || "reviewed"}
                    placeholder="reviewed"
                  />
                </label>

                <label>
                  Action
                  <input name="action" defaultValue="none" placeholder="none" />
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
