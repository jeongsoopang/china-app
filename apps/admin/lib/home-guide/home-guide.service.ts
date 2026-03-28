import { requireGrandMasterAccess } from "../auth/grandmaster";
import { createAdminServerSupabaseClient, createAdminServiceClient } from "../supabase/server";

export type HomeGuideContent = {
  title: string;
  body: string;
  image_url: string | null;
  is_visible: boolean;
  updated_at: string | null;
};

export const DEFAULT_HOME_GUIDE_CONTENT: HomeGuideContent = {
  title: "Welcome to LUCL",
  body:
    "Use search to find posts and useful information across LUCL.\n" +
    "Use quick actions to jump to your school, announcements, and your own page.\n" +
    "More guides and tips will be updated here.",
  image_url: null,
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
    normalized.includes("home_guide_content") &&
    (normalized.includes("does not exist") ||
      normalized.includes("relation") ||
      normalized.includes("schema cache"))
  ) {
    return "Home Guide table is missing. Run pending Supabase migrations (including 0013_home_guide_content.sql), then reload this page.";
  }

  if (error instanceof Error && error.message) {
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

export async function fetchHomeGuideContentForAdmin(): Promise<HomeGuideContent> {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const { data, error } = await client
    .from("home_guide_content")
    .select("title, body, image_url, is_visible, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(messageFromError(error, "Failed to load Home guide content."));
  }

  if (!data) {
    return DEFAULT_HOME_GUIDE_CONTENT;
  }

  return {
    title: typeof data.title === "string" ? data.title : DEFAULT_HOME_GUIDE_CONTENT.title,
    body: typeof data.body === "string" ? data.body : DEFAULT_HOME_GUIDE_CONTENT.body,
    image_url: typeof data.image_url === "string" && data.image_url.length > 0 ? data.image_url : null,
    is_visible: typeof data.is_visible === "boolean" ? data.is_visible : true,
    updated_at: typeof data.updated_at === "string" ? data.updated_at : null
  };
}

export async function upsertHomeGuideContent(input: {
  title: string;
  body: string;
  imageUrl: string | null;
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
  const { error } = await client.from("home_guide_content").upsert(
    {
      id: 1,
      title: input.title,
      body: input.body,
      image_url: input.imageUrl,
      is_visible: input.isVisible,
      updated_by: currentUserId
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(messageFromError(error, "Failed to save Home guide content."));
  }
}
