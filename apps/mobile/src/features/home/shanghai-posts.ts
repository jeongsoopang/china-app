import { supabase } from "../../lib/supabase/client";

export type ShanghaiPost = {
  id: number;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  abstract: string | null;
  createdAt: string;
  thumbnailImageUrl: string | null;
  images: { imageUrl: string; sortOrder: number | null }[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
};

function normalizeSearch(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function fetchShanghaiPosts(params: {
  categorySlugs: string[];
  searchText?: string | null;
  limit?: number;
}): Promise<ShanghaiPost[]> {
  const { categorySlugs, searchText, limit = 120 } = params;
  if (categorySlugs.length === 0) {
    return [];
  }

  const normalizedSearch = normalizeSearch(searchText);

  function attemptWithMetadata() {
    let query = supabase
      .from("posts")
      .select(
        `
      id,
      author_id,
      title,
      body,
      abstract,
      thumbnail_image_url,
      like_count,
      comment_count,
      view_count,
      created_at,
      sections!inner ( code ),
      categories!inner ( slug ),
      post_images ( image_url, sort_order )
    `
      )
      .eq("sections.code", "fun")
      .in("categories.slug", categorySlugs)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (normalizedSearch) {
      const escaped = normalizedSearch.replace(/,/g, "\\,").replace(/\./g, "\\.");
      query = query.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%,abstract.ilike.%${escaped}%`);
    }

    return query;
  }

  function attemptWithoutMetadata() {
    let query = supabase
      .from("posts")
      .select(
        `
      id,
      author_id,
      title,
      body,
      like_count,
      comment_count,
      view_count,
      created_at,
      sections!inner ( code ),
      categories!inner ( slug ),
      post_images ( image_url, sort_order )
    `
      )
      .eq("sections.code", "fun")
      .in("categories.slug", categorySlugs)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (normalizedSearch) {
      const escaped = normalizedSearch.replace(/,/g, "\\,").replace(/\./g, "\\.");
      query = query.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%,abstract.ilike.%${escaped}%`);
    }

    return query;
  }

  let data: unknown = null;
  let error: { message: string } | null = null;

  const withMetadata = await attemptWithMetadata();
  data = withMetadata.data;
  error = withMetadata.error ? { message: withMetadata.error.message } : null;

  if (error && /column/i.test(error.message) && /abstract|thumbnail_image_url/i.test(error.message)) {
    const fallback = await attemptWithoutMetadata();
    data = fallback.data;
    error = fallback.error ? { message: fallback.error.message } : null;
  }

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: number;
    author_id: string;
    title: string;
    body: string;
    abstract?: string | null;
    thumbnail_image_url?: string | null;
    like_count: number | null;
    comment_count: number | null;
    view_count: number | null;
    created_at: string;
    post_images: Array<{ image_url: string; sort_order: number | null }> | null;
  }>;

  const mapped: ShanghaiPost[] = rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorName: null,
    title: row.title,
    body: row.body,
    abstract: typeof row.abstract === "string" ? row.abstract : null,
    thumbnailImageUrl: typeof row.thumbnail_image_url === "string" ? row.thumbnail_image_url : null,
    createdAt: row.created_at,
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    viewCount: row.view_count ?? 0,
    images: (row.post_images ?? []).map((image) => ({
      imageUrl: image.image_url,
      sortOrder: image.sort_order ?? null
    }))
  }));

  const authorIds = Array.from(new Set(mapped.map((post) => post.authorId)));
  if (authorIds.length === 0) {
    return mapped;
  }

  const { data: profileRows } = await supabase
    .from("user_profiles")
    .select("id, display_name")
    .in("id", authorIds);

  const displayNameMap = new Map<string, string | null>();
  (profileRows ?? []).forEach((profile) => {
    displayNameMap.set(profile.id, profile.display_name ?? null);
  });

  return mapped.map((post) => ({
    ...post,
    authorName: displayNameMap.get(post.authorId) ?? null
  }));
}

export function rankShanghaiPosts(posts: ShanghaiPost[], limit = 3): ShanghaiPost[] {
  return [...posts]
    .sort((a, b) => {
      const aScore = a.likeCount * 3 + a.commentCount * 2;
      const bScore = b.likeCount * 3 + b.commentCount * 2;
      if (bScore !== aScore) {
        return bScore - aScore;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

export function getPreviewText(abstract: string | null, body: string): string {
  if (abstract && abstract.trim().length > 0) {
    return abstract.trim().length > 140 ? `${abstract.trim().slice(0, 137)}...` : abstract.trim();
  }

  const text = body
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

export function getThumbnailUrl(
  thumbnailImageUrl: string | null,
  body: string,
  images: { imageUrl: string; sortOrder: number | null }[]
): string | null {
  if (thumbnailImageUrl) {
    return thumbnailImageUrl;
  }

  if (images.length > 0) {
    const sorted = [...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return sorted[0]?.imageUrl ?? null;
  }

  const match = /<img\s+[^>]*src=["']([^"']+)["']/i.exec(body);
  return match?.[1] ?? null;
}
