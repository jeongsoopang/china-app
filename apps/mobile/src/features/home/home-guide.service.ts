import { supabase } from "../../lib/supabase/client";

export type HomeGuideContent = {
  title: string;
  body: string;
  imageUrl: string | null;
  isVisible: boolean;
};

export const DEFAULT_HOME_GUIDE_CONTENT: HomeGuideContent = {
  title: "Welcome to LUCL",
  body:
    "Use search to find posts and useful information across LUCL.\n" +
    "Use quick actions to jump to your school, announcements, and your own page.\n" +
    "More guides and tips will be updated here.",
  imageUrl: null,
  isVisible: true
};

type UnsafeClient = {
  from: (table: string) => any;
};

export async function fetchHomeGuideContent(): Promise<HomeGuideContent> {
  const client = supabase as unknown as UnsafeClient;
  const { data, error } = await client
    .from("home_guide_content")
    .select("title, body, image_url, is_visible")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_HOME_GUIDE_CONTENT;
  }

  if (data.is_visible === false) {
    return {
      ...DEFAULT_HOME_GUIDE_CONTENT,
      isVisible: false
    };
  }

  const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "";
  const body = typeof data.body === "string" && data.body.trim().length > 0 ? data.body.trim() : "";
  const imageUrl =
    typeof data.image_url === "string" && data.image_url.trim().length > 0 ? data.image_url.trim() : null;

  return {
    title: title || DEFAULT_HOME_GUIDE_CONTENT.title,
    body: body || DEFAULT_HOME_GUIDE_CONTENT.body,
    imageUrl,
    isVisible: true
  };
}
