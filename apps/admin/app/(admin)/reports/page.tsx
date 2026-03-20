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

function stripHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function previewText(value: string | null, maxLength = 180): string {
  if (!value) {
    return "-";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}…`;
}

const moderationActionOptions = [
  { value: "request_revision", label: "Request Revision" },
  { value: "hide", label: "Hide Content" },
  { value: "delete", label: "Delete Content" }
] as const;

export default async function ReportsPage() {
  let reportsError: string | null = null;
  let reports = [] as Awaited<ReturnType<typeof fetchReports>>;

  try {
    reports = await fetchReports();
  } catch (error) {
    reportsError = error instanceof Error ? error.message : "Failed to load reports.";
  }

  return (
    <section>
      <h2>Reports</h2>
      <p>Review user reports, inspect the original content, and apply moderation actions.</p>

      {reportsError ? <p className="error-text">{reportsError}</p> : null}

      {!reportsError && reports.length === 0 ? (
        <p>No reports available.</p>
      ) : (
        <div className="data-list">
          {reports.map((report) => {
            const plainPostBody = stripHtml(report.target_post_body);
            const hasOriginalPostBody =
              report.target_type === "post" && Boolean(plainPostBody && plainPostBody.length > 0);

            return (
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
                  <div>
                    <dt>Action Taken</dt>
                    <dd>{report.action_taken ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Reporter</dt>
                    <dd>
                      {report.reporter_display_name ?? "-"}
                      <br />
                      <span className="muted-text">{report.reporter_email ?? "-"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Target Author</dt>
                    <dd>
                      {report.target_author_display_name ?? "-"}
                      <br />
                      <span className="muted-text">{report.target_author_email ?? "-"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Post Title</dt>
                    <dd>{report.target_post_title ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Post Status</dt>
                    <dd>{report.target_post_status ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Post Preview</dt>
                    <dd>{previewText(plainPostBody)}</dd>
                  </div>
                </dl>

                <div
                  style={{
                    marginTop: 16,
                    marginBottom: 16,
                    padding: 12,
                    border: "1px solid #dbe3ef",
                    borderRadius: 12,
                    background: "#f8fbff"
                  }}
                >
                  <strong style={{ display: "block", marginBottom: 8 }}>Original Content</strong>

                  {hasOriginalPostBody ? (
                    <details>
                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                        View original post body
                      </summary>
                      <div
                        style={{
                          marginTop: 12,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.65,
                          color: "#243447"
                        }}
                      >
                        {plainPostBody}
                      </div>
                    </details>
                  ) : report.target_type === "comment" ? (
                    <p className="muted-text" style={{ margin: 0 }}>
                      Original comment body is not loaded in the current admin query yet.
                    </p>
                  ) : (
                    <p className="muted-text" style={{ margin: 0 }}>
                      No original body available.
                    </p>
                  )}
                </div>

                <form action={reviewReportAction} className="action-form">
                  <input name="reportId" type="hidden" value={String(report.id)} />

                  <label>
                    Next Status
                    <select
                      name="nextStatus"
                      defaultValue={report.status === "open" ? "reviewed" : report.status}
                    >
                      {Array.from(new Set(["reviewed", "actioned", "dismissed", "open"])).map(
                        (status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label>
                    Action
                    <select name="action" defaultValue="request_revision">
                      {moderationActionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button type="submit">Apply Action</button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
