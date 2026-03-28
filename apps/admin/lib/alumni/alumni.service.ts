import { requireGrandMasterAccess } from "../auth/grandmaster";
import { createAdminServerSupabaseClient, createAdminServiceClient } from "../supabase/server";

export type AlumniUniversityOption = {
  id: string;
  slug: string;
  label: string;
};

export type UniversityAlumniContent = {
  title: string;
  body: string;
  is_visible: boolean;
  updated_at: string | null;
};

export const DEFAULT_UNIVERSITY_ALUMNI_CONTENT: UniversityAlumniContent = {
  title: "",
  body: "",
  is_visible: true,
  updated_at: null
};

type UnsafeClient = {
  from: (table: string) => any;
};

function messageFromError(error: unknown, fallback: string): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes("university_alumni_content") &&
    (normalized.includes("does not exist") ||
      normalized.includes("relation") ||
      normalized.includes("schema cache"))
  ) {
    return "Alumni content table is missing. Run pending Supabase migrations and reload this page.";
  }

  if (rawMessage.length > 0) {
    return rawMessage;
  }

  return fallback;
}

export async function fetchUniversitiesForAlumniAdmin(): Promise<AlumniUniversityOption[]> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient() as unknown as UnsafeClient;
  const { data, error } = await client
    .from("universities")
    .select("id, slug, name_ko, name_en, short_name")
    .order("name_ko", { ascending: true });

  if (error) {
    throw new Error(messageFromError(error, "Failed to load universities."));
  }

  const rows = (data ?? []) as Array<{
    id: string | number;
    slug: string | null;
    name_ko: string | null;
    name_en: string | null;
    short_name: string | null;
  }>;

  return rows
    .filter((row) => typeof row.slug === "string" && row.slug.length > 0)
    .map((row) => {
      const id = String(row.id);
      const slug = row.slug ?? id;
      const label = row.name_ko ?? row.name_en ?? row.short_name ?? slug;

      return {
        id,
        slug,
        label
      };
    });
}

export async function fetchUniversityAlumniContentForAdmin(
  universityId: string
): Promise<UniversityAlumniContent> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient() as unknown as UnsafeClient;
  const { data, error } = await client
    .from("university_alumni_content")
    .select("title, body, is_visible, updated_at")
    .eq("university_id", universityId)
    .maybeSingle();

  if (error) {
    throw new Error(messageFromError(error, "Failed to load alumni content."));
  }

  if (!data) {
    return DEFAULT_UNIVERSITY_ALUMNI_CONTENT;
  }

  return {
    title: typeof data.title === "string" ? data.title : "",
    body: typeof data.body === "string" ? data.body : "",
    is_visible: typeof data.is_visible === "boolean" ? data.is_visible : true,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : null
  };
}

export async function upsertUniversityAlumniContent(input: {
  universityId: string;
  title: string;
  body: string;
  isVisible: boolean;
}) {
  await requireGrandMasterAccess();

  const authClient = await createAdminServerSupabaseClient();
  const authResult = await authClient.auth.getUser();
  if (authResult.error) {
    throw authResult.error;
  }

  const currentUserId = authResult.data.user?.id;
  if (!currentUserId) {
    throw new Error("Authenticated admin user not found.");
  }

  const client = createAdminServiceClient() as unknown as UnsafeClient;
  const { error } = await client.from("university_alumni_content").upsert(
    {
      university_id: input.universityId,
      title: input.title,
      body: input.body,
      is_visible: input.isVisible,
      updated_by: currentUserId
    },
    { onConflict: "university_id" }
  );

  if (error) {
    throw new Error(messageFromError(error, "Failed to save alumni content."));
  }
}
