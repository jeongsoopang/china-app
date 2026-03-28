import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAdminAction } from "../../lib/auth/actions";
import { getGrandMasterAccessState } from "../../lib/auth/grandmaster";

function getReasonTitle(reason: string): string {
  switch (reason) {
    case "missing_env":
      return "Missing configuration";
    case "not_signed_in":
      return "Not signed in";
    case "wrong_user_id":
      return "Wrong account";
    case "role_mismatch":
      return "Role mismatch";
    default:
      return "Access denied";
  }
}

function getReasonDescription(reason: string): string {
  switch (reason) {
    case "missing_env":
      return "ADMIN_GRANDMASTER_USER_ID is not set on this admin app environment.";
    case "not_signed_in":
      return "You must sign in first.";
    case "wrong_user_id":
      return "The signed-in user id does not match ADMIN_GRANDMASTER_USER_ID.";
    case "role_mismatch":
      return "The signed-in account id matches, but user_profiles.role is not 'grandmaster'.";
    default:
      return "Access is restricted.";
  }
}

export default async function AccessDeniedPage() {
  const accessState = await getGrandMasterAccessState();

  if (accessState.status === "allow") {
    redirect("/dashboard");
  }

  return (
    <main>
      <h1>LUCL Admin</h1>
      <section className="auth-card">
        <h2>{getReasonTitle(accessState.reason)}</h2>
        <p>{getReasonDescription(accessState.reason)}</p>

        <dl className="data-grid">
          <div>
            <dt>Expected GrandMaster User ID</dt>
            <dd>{accessState.expectedUserId ?? "(missing)"}</dd>
          </div>
          <div>
            <dt>Current Auth User ID</dt>
            <dd>{accessState.currentUser?.authUser.id ?? "(not signed in)"}</dd>
          </div>
          <div>
            <dt>Current Profile Role</dt>
            <dd>{accessState.currentUser ? String(accessState.currentUser.profile.role) : "-"}</dd>
          </div>
        </dl>

        <div className="auth-actions">
          {accessState.currentUser ? (
            <form action={signOutAdminAction}>
              <button type="submit">Sign Out</button>
            </form>
          ) : (
            <Link href="/login">Go to Sign In</Link>
          )}
        </div>
      </section>
    </main>
  );
}
