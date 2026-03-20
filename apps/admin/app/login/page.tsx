import { redirect } from "next/navigation";
import { signInAdminAction, signOutAdminAction } from "../../lib/auth/actions";
import { getGrandMasterAccessState } from "../../lib/auth/grandmaster";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const accessState = await getGrandMasterAccessState();

  if (accessState.status === "allow") {
    redirect("/dashboard");
  }

  return (
    <main>
      <h1>ForYou Admin</h1>
      <section className="auth-card">
        <h2>Sign In</h2>
        <p>Sign in with your admin email and password.</p>

        {params.error ? <p className="error-text">{params.error}</p> : null}

        <form action={signInAdminAction} className="auth-form">
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>

          <button type="submit">Sign In</button>
        </form>

        <p className="muted-text">
          If sign-in fails, verify the email/password in Supabase Authentication for this project.
        </p>

        {accessState.currentUser ? (
          <form action={signOutAdminAction}>
            <button type="submit">Sign Out Current Session</button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
