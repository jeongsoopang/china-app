import { requireGrandMasterAccess } from "../auth/grandmaster";
import { createAdminServiceClient } from "../supabase/server";

type QueryError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type CountResult = {
  value: number | null;
  reason: string | null;
};

export type DashboardMetrics = {
  totalUsers: CountResult;
  usersByTier: Record<string, CountResult>;
  todayNewSignups: CountResult;
  todaySchoolVerified: CountResult;
  pendingReports: CountResult;
  todayNewPosts: CountResult;
  eventSponsorCount: CountResult;
  currentTopBannerCount: CountResult;
  generatedAt: string;
};

const dashboardRoles = [
  "bronze",
  "silver",
  "gold",
  "emerald",
  "diamond",
  "grandmaster"
] as const;

type UnsafeClient = {
  from: (table: string) => any;
};

function errorMessageFromUnknown(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const queryError = error as QueryError;
  const joined = `${queryError.code ?? ""} ${queryError.message ?? ""} ${queryError.details ?? ""} ${queryError.hint ?? ""}`.toLowerCase();

  return (
    queryError.code === "PGRST205" ||
    queryError.code === "42P01" ||
    joined.includes("schema cache") ||
    joined.includes("could not find the table") ||
    joined.includes("does not exist")
  );
}

function startAndEndOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

async function countRows(
  client: UnsafeClient,
  table: string,
  applyFilters?: (query: any) => any,
  options?: {
    missingTableReason?: string;
    unavailableReason?: string;
  }
): Promise<CountResult> {
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (applyFilters) {
    query = applyFilters(query);
  }

  const result = await query;

  if (result.error) {
    const missingTable = isMissingTableError(result.error);
    return {
      value: null,
      reason: missingTable
        ? (options?.missingTableReason ?? "Data source is currently unavailable.")
        : (options?.unavailableReason ?? "Metric is temporarily unavailable.")
    };
  }

  return {
    value: typeof result.count === "number" ? result.count : 0,
    reason: null
  };
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient() as unknown as UnsafeClient;
  const { startIso, endIso } = startAndEndOfToday();

  const usersByRoleResult = await client.from("user_profiles").select("role");

  let usersByTier = Object.fromEntries(
    dashboardRoles.map((role) => [role, { value: 0, reason: null } satisfies CountResult])
  ) as Record<string, CountResult>;

  if (usersByRoleResult.error) {
    usersByTier = Object.fromEntries(
      dashboardRoles.map((role) => [
        role,
        {
          value: null,
          reason: "Role count is temporarily unavailable."
        } satisfies CountResult
      ])
    ) as Record<string, CountResult>;
  } else {
    const roleCounter = new Map<string, number>();
    for (const role of dashboardRoles) {
      roleCounter.set(role, 0);
    }

    const rows = (usersByRoleResult.data ?? []) as Array<{ role: string | null }>;
    for (const row of rows) {
      const role =
        row.role === "platinum" ? "diamond" : row.role === "master" ? "grandmaster" : row.role ?? "";
      if (roleCounter.has(role)) {
        roleCounter.set(role, (roleCounter.get(role) ?? 0) + 1);
      }
    }

    usersByTier = Object.fromEntries(
      dashboardRoles.map((role) => [
        role,
        { value: roleCounter.get(role) ?? 0, reason: null } satisfies CountResult
      ])
    ) as Record<string, CountResult>;
  }

  const [
    totalUsers,
    todayNewSignups,
    todaySchoolVerified,
    pendingReports,
    todayNewPosts,
    eventSponsorCount,
    currentTopBannerCount
  ] = await Promise.all([
    countRows(client, "user_profiles"),
    countRows(client, "user_profiles", (query) =>
      query.gte("created_at", startIso).lt("created_at", endIso)
    ),
    countRows(client, "user_school_verifications", (query) =>
      query.eq("status", "verified").gte("verified_at", startIso).lt("verified_at", endIso)
    ),
    countRows(client, "reports", (query) => query.is("reviewed_at", null)),
    countRows(client, "posts", (query) => query.gte("created_at", startIso).lt("created_at", endIso)),
    countRows(client, "event_page_sponsors"),
    countRows(client, "event_page_banners", (query) => query.eq("is_active", true))
  ]);

  return {
    totalUsers,
    usersByTier,
    todayNewSignups,
    todaySchoolVerified,
    pendingReports,
    todayNewPosts,
    eventSponsorCount,
    currentTopBannerCount,
    generatedAt: new Date().toISOString()
  };
}
