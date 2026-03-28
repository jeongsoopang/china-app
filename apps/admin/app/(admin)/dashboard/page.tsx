import { getAdminCurrentUser } from "../../../lib/auth/current-user";
import { fetchDashboardMetrics } from "../../../lib/dashboard/dashboard.service";

function formatMetricValue(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return value.toLocaleString();
}

function formatTierMetricValue(value: number | null): string {
  if (value === null) {
    return "N/A";
  }

  return value.toLocaleString();
}

function formatMetricReason(reason: string | null): string | null {
  if (!reason) {
    return null;
  }

  return reason;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function DashboardPage() {
  let authSummary = "No active user session.";
  let metricsError: string | null = null;
  let metrics = await fetchDashboardMetrics().catch((error) => {
    metricsError =
      error instanceof Error ? error.message : "Failed to load dashboard metrics.";
    return null;
  });

  try {
    const currentUser = await getAdminCurrentUser();

    if (currentUser) {
      authSummary = `Signed in as ${currentUser.profile.display_name}.`;
    }
  } catch (error) {
    authSummary =
      error instanceof Error
        ? `Auth bootstrap unavailable: ${error.message}`
        : "Auth bootstrap unavailable.";
  }

  return (
    <section>
      <h2>Dashboard</h2>
      <p>Operational metrics and health indicators for today.</p>
      <p>{authSummary}</p>

      {metricsError ? (
        <p className="error-text">
          Metrics are temporarily unavailable. Please refresh shortly.
        </p>
      ) : null}

      {!metrics ? null : (
        <>
          <div className="dashboard-metrics-grid" style={{ marginTop: 16 }}>
            <article className="metric-card">
              <h3>Total Users</h3>
              <p className="metric-value">{formatMetricValue(metrics.totalUsers.value)}</p>
              {formatMetricReason(metrics.totalUsers.reason) ? (
                <p className="muted-text">{formatMetricReason(metrics.totalUsers.reason)}</p>
              ) : null}
            </article>

            <article className="metric-card">
              <h3>Today New Signups</h3>
              <p className="metric-value">{formatMetricValue(metrics.todayNewSignups.value)}</p>
              {formatMetricReason(metrics.todayNewSignups.reason) ? (
                <p className="muted-text">{formatMetricReason(metrics.todayNewSignups.reason)}</p>
              ) : null}
            </article>

            <article className="metric-card">
              <h3>Today School-Verified</h3>
              <p className="metric-value">{formatMetricValue(metrics.todaySchoolVerified.value)}</p>
              {formatMetricReason(metrics.todaySchoolVerified.reason) ? (
                <p className="muted-text">{formatMetricReason(metrics.todaySchoolVerified.reason)}</p>
              ) : null}
            </article>

            <article className="metric-card">
              <h3>Pending Report Review</h3>
              <p className="metric-value">{formatMetricValue(metrics.pendingReports.value)}</p>
              {formatMetricReason(metrics.pendingReports.reason) ? (
                <p className="muted-text">{formatMetricReason(metrics.pendingReports.reason)}</p>
              ) : null}
            </article>

            <article className="metric-card">
              <h3>Today New Posts</h3>
              <p className="metric-value">{formatMetricValue(metrics.todayNewPosts.value)}</p>
              {formatMetricReason(metrics.todayNewPosts.reason) ? (
                <p className="muted-text">{formatMetricReason(metrics.todayNewPosts.reason)}</p>
              ) : null}
            </article>

            <article className="metric-card">
              <h3>Event Sponsor Count</h3>
              <p className="metric-value">{formatMetricValue(metrics.eventSponsorCount.value)}</p>
              {formatMetricReason(metrics.eventSponsorCount.reason) ? (
                <p className="muted-text">{formatMetricReason(metrics.eventSponsorCount.reason)}</p>
              ) : null}
            </article>

            <article className="metric-card">
              <h3>Current Top Banner Count</h3>
              <p className="metric-value">
                {formatMetricValue(metrics.currentTopBannerCount.value)}
              </p>
              {formatMetricReason(metrics.currentTopBannerCount.reason) ? (
                <p className="muted-text">{formatMetricReason(metrics.currentTopBannerCount.reason)}</p>
              ) : null}
            </article>
          </div>

          <article className="data-card dashboard-tier-card" style={{ marginTop: 16 }}>
            <header className="data-card-header">
              <h3>User Count by Tier</h3>
            </header>
            <dl className="dashboard-tier-grid">
              {Object.entries(metrics.usersByTier).map(([tier, count]) => (
                <div key={tier} className="dashboard-tier-item">
                  <dt className="dashboard-tier-label">{tier}</dt>
                  <dd className="dashboard-tier-value">{formatTierMetricValue(count.value)}</dd>
                  {formatMetricReason(count.reason) ? (
                    <p className="muted-text">{formatMetricReason(count.reason)}</p>
                  ) : null}
                </div>
              ))}
            </dl>
            <p className="muted-text">Snapshot generated at {formatTimestamp(metrics.generatedAt)}.</p>
          </article>
        </>
      )}
    </section>
  );
}
