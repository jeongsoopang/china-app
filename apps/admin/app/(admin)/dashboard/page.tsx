import { getAdminCurrentUser } from "../../../lib/auth/current-user";

export default async function DashboardPage() {
  let authSummary = "No active user session.";

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
      <p>Operational metrics and health indicators placeholder.</p>
      <p>{authSummary}</p>
    </section>
  );
}
