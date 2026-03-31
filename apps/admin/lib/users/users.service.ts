import { createAdminServiceClient } from "../supabase/server";
import { requireGrandMasterAccess } from "../auth/grandmaster";

export type AdminUserListFilters = {
  query?: string;
  role?: string | "all";
  userId?: string;
};

export type AdminUserRow = {
  id: string;
  display_name: string;
  real_name: string | null;
  login_email: string | null;
  verified_university_id: string | null;
  university_label: string | null;
  role: string;
  created_at: string;
};

export type AdminUserUpdateInput = {
  userId: string;
  role: string;
};

export type AdminUserDeleteInput = {
  userId: string;
};

type RawUserProfileRow = {
  id: string;
  display_name: string | null;
  real_name: string | null;
  verified_university_id: string | null;
  role: string | null;
  created_at: string;
};

type UniversityLookupRow = {
  id: string;
  name_ko: string | null;
  name_en: string | null;
  short_name: string | null;
};

function normalizeQuery(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

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

export async function fetchAdminUsers(
  filters: AdminUserListFilters = {}
): Promise<AdminUserRow[]> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient();
  const profilesClient = (client as unknown as {
    from: (table: string) => any;
    auth: typeof client.auth;
  });

  let query = profilesClient
    .from("user_profiles")
    .select("id, display_name, real_name, verified_university_id, role, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.role && filters.role !== "all") {
    if (filters.role === "diamond") {
      query = query.in("role", ["diamond", "platinum"]);
    } else if (filters.role === "grandmaster") {
      query = query.in("role", ["grandmaster", "master"]);
    } else {
      query = query.eq("role", filters.role);
    }
  }

  const userIdQuery = normalizeQuery(filters.userId);
  if (userIdQuery) {
    query = query.eq("id", userIdQuery);
  }

  const searchQuery = normalizeQuery(filters.query);
  if (searchQuery) {
    query = query.ilike("display_name", `%${searchQuery}%`);
  }

  const usersResult = await query;

  if (usersResult.error) {
    throw new Error(errorMessageFromUnknown(usersResult.error, "Failed to load users."));
  }

  const users = (usersResult.data ?? []) as RawUserProfileRow[];
  const usersById = new Map(users.map((user) => [user.id, user]));
  const loginEmailMap = new Map<string, string | null>();

  if (users.length > 0) {
    const authUsersResult = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (authUsersResult.error) {
      throw new Error(
        errorMessageFromUnknown(authUsersResult.error, "Failed to load auth users.")
      );
    }

    for (const authUser of authUsersResult.data.users) {
      if (usersById.has(authUser.id)) {
        loginEmailMap.set(authUser.id, authUser.email ?? null);
      }
    }
  }

  const universityIds = Array.from(
    new Set(
      users
        .map((user) => user.verified_university_id)
        .filter((value): value is string => Boolean(value))
    )
  );

  const universityMap = new Map<string, string>();

  if (universityIds.length > 0) {
    const universitiesResult = await client
      .from("universities")
      .select("id, name_ko, name_en, short_name")
      .in("id", universityIds);

    if (universitiesResult.error) {
      throw new Error(
        errorMessageFromUnknown(universitiesResult.error, "Failed to load universities.")
      );
    }

    const universityRows = (universitiesResult.data ?? []) as unknown as UniversityLookupRow[];

    for (const university of universityRows) {
      const label =
        university.name_ko ??
        university.name_en ??
        university.short_name ??
        university.id;

      universityMap.set(university.id, label);
    }
  }

  return users.map((user) => ({
    id: user.id,
    display_name: user.display_name ?? "-",
    real_name: user.real_name ?? null,
    login_email: loginEmailMap.get(user.id) ?? null,
    verified_university_id: user.verified_university_id ?? null,
    university_label: user.verified_university_id
      ? universityMap.get(user.verified_university_id) ?? null
      : null,
    role: String(user.role ?? "bronze"),
    created_at: user.created_at
  }));
}

const allowedRoles = new Set([
  "bronze",
  "silver",
  "gold",
  "emerald",
  "diamond",
  "platinum",
  "church_master",
  "campus_master",
  "master",
  "grandmaster"
]);

function isValidRole(value: string): boolean {
  return allowedRoles.has(value);
}

export async function updateAdminUser(input: AdminUserUpdateInput): Promise<void> {
  const actor = await requireGrandMasterAccess();

  if (!isValidRole(input.role)) {
    throw new Error("Invalid role.");
  }

  const client = createAdminServiceClient();

  const existingResult = await client
    .from("user_profiles")
    .select("id, role")
    .eq("id", input.userId)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(errorMessageFromUnknown(existingResult.error, "Failed to load user."));
  }

  const existing = existingResult.data;
  if (!existing) {
    throw new Error("User not found.");
  }

  const updateResult = await client
    .from("user_profiles")
    .update({
      role: input.role as never
    })
    .eq("id", input.userId)
    .select("id, role")
    .maybeSingle();

  if (updateResult.error) {
    if (input.role === "diamond") {
      const fallbackUpdateResult = await client
        .from("user_profiles")
        .update({
          role: "platinum" as never
        })
        .eq("id", input.userId)
        .select("id, role")
        .maybeSingle();

      if (fallbackUpdateResult.error) {
        throw new Error(errorMessageFromUnknown(fallbackUpdateResult.error, "Failed to update user."));
      }
    } else if (input.role === "grandmaster") {
      const fallbackUpdateResult = await client
        .from("user_profiles")
        .update({
          role: "master" as never
        })
        .eq("id", input.userId)
        .select("id, role")
        .maybeSingle();

      if (fallbackUpdateResult.error) {
        throw new Error(errorMessageFromUnknown(fallbackUpdateResult.error, "Failed to update user."));
      }
    } else {
      throw new Error(errorMessageFromUnknown(updateResult.error, "Failed to update user."));
    }
  }

  const changedFields: string[] = [];
  if (String(existing.role) !== input.role) {
    changedFields.push("role");
  }

  console.info(
    JSON.stringify({
      event: "admin_user_update",
      actorUserId: actor.authUser.id,
      targetUserId: input.userId,
      changedFields,
      at: new Date().toISOString()
    })
  );
}

export async function deleteAdminUser(input: AdminUserDeleteInput): Promise<void> {
  const actor = await requireGrandMasterAccess();
  const client = createAdminServiceClient();

  if (input.userId === actor.authUser.id) {
    throw new Error("You cannot delete the currently signed-in admin account.");
  }

  const existingResult = await client
    .from("user_profiles")
    .select("id")
    .eq("id", input.userId)
    .maybeSingle();

  if (existingResult.error) {
    throw new Error(errorMessageFromUnknown(existingResult.error, "Failed to load user."));
  }

  if (!existingResult.data) {
    throw new Error("User not found.");
  }

  const deleteResult = await client.auth.admin.deleteUser(input.userId, false);

  if (deleteResult.error) {
    throw new Error(errorMessageFromUnknown(deleteResult.error, "Failed to delete user account."));
  }

  console.info(
    JSON.stringify({
      event: "admin_user_delete",
      actorUserId: actor.authUser.id,
      targetUserId: input.userId,
      at: new Date().toISOString()
    })
  );
}
