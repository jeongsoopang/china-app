import { updateUserProfileAction } from "../../../lib/users/actions";
import { fetchAdminUsers } from "../../../lib/users/users.service";

export const dynamic = "force-dynamic";

const roleOptions = [
  "all",
  "bronze",
  "silver",
  "gold",
  "emerald",
  "diamond",
  "church_master",
  "campus_master",
  "grandmaster"
] as const;

function normalizeRoleForUi(role: string): string {
  if (role === "platinum") {
    return "diamond";
  }
  if (role === "master") {
    return "grandmaster";
  }
  return role;
}

type UsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    userId?: string;
  }>;
};

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = (await searchParams) ?? {};
  const query = params.q ?? "";
  const userId = params.userId ?? "";
  const role = params.role ?? "all";

  let usersError: string | null = null;
  let users = [] as Awaited<ReturnType<typeof fetchAdminUsers>>;

  try {
    users = await fetchAdminUsers({
      query,
      userId,
      role
    });
  } catch (error) {
    usersError = error instanceof Error ? error.message : "Failed to load users.";
  }

  return (
    <section>
      <h2>Users</h2>
      <p>Search users by display name or exact user ID, inspect real names, and update roles.</p>

      <form method="get" className="action-form" style={{ marginBottom: 20 }}>
        <label>
          Display Name Search
          <input name="q" type="text" defaultValue={query} placeholder="Search display name" />
        </label>

        <label>
          User ID Search
          <input
            name="userId"
            type="text"
            defaultValue={userId}
            placeholder="Exact UUID search"
          />
        </label>

        <label>
          Role
          <select name="role" defaultValue={role}>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button type="submit">Search</button>
      </form>

      {usersError ? <p className="error-text">{usersError}</p> : null}

      {!usersError && users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <div className="data-list">
          {users.map((user) => (
            <article key={user.id} className="data-card">
              <header className="data-card-header">
                <h3>{user.display_name}</h3>
                <span className="status-badge">{normalizeRoleForUi(user.role)}</span>
              </header>

              <dl className="data-grid">
                <div>
                  <dt>User ID</dt>
                  <dd>{user.id}</dd>
                </div>
                <div>
                  <dt>Real Name</dt>
                  <dd>{user.real_name ?? "-"}</dd>
                </div>
                <div>
                  <dt>Login Email</dt>
                  <dd>{user.login_email ?? "-"}</dd>
                </div>
                <div>
                  <dt>University</dt>
                  <dd>{user.university_label ?? "-"}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatTime(user.created_at)}</dd>
                </div>
              </dl>

              <form action={updateUserProfileAction} className="action-form">
                <input name="userId" type="hidden" value={user.id} />

                <label>
                  Role
                  <select name="role" defaultValue={normalizeRoleForUi(user.role)}>
                    {roleOptions
                      .filter((option) => option !== "all")
                      .map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                  </select>
                </label>

                <button type="submit">Update Role</button>
              </form>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
