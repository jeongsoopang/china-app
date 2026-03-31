import type { Database, DbUserRole, DbUserTier, UserProfileRow } from "@foryou/types";
import { supabase } from "../../lib/supabase/client";
import type {
  AttachPostImagesResult,
  CategoryOption,
  ComposeSectionCode,
  ComposeSectionOption,
  CreatePostInput,
  CreatePostResult,
  StudyDegree,
  UploadedPostImage,
  UniversityOption,
  VerifiedUniversity
} from "./compose.types";

type CreatePostRpcReturn = Database["public"]["Functions"]["create_post"]["Returns"];
type AttachPostImagesRpcReturn =
  Database["public"]["Functions"]["attach_post_images"]["Returns"];
type AwardPostPointsRpcReturn = Database["public"]["Functions"]["award_post_points"]["Returns"];

type SectionCatalog = Record<ComposeSectionCode, ComposeSectionOption>;
type CategoryCatalog = Record<ComposeSectionCode, CategoryOption[]>;

const SECTION_CATALOG: SectionCatalog = {
  life: {
    code: "life",
    label: "School",
    sectionCode: "life"
  },
  study: {
    code: "study",
    label: "Study",
    sectionCode: "study"
  },
  qa: {
    code: "qa",
    label: "Q&A",
    sectionCode: "qa"
  },
  fun: {
    code: "fun",
    label: "Shanghai",
    sectionCode: "fun"
  }
};

const CATEGORY_CATALOG: CategoryCatalog = {
  life: [
    { slug: "life-facilities", label: "학교시설", sectionCode: "life" },
    { slug: "life-food", label: "식당", sectionCode: "life" },
    { slug: "life-dorm", label: "기숙사", sectionCode: "life" }
  ],
  study: [
    { slug: "study-major", label: "전공정보", sectionCode: "study" },
    { slug: "study-class-review", label: "수업후기", sectionCode: "study" },
    { slug: "study-professor-review", label: "교수후기", sectionCode: "study" },
    { slug: "study-exam-difficulty", label: "시험난이도", sectionCode: "study" },
    { slug: "study-classroom-tips", label: "강의실/수강팁", sectionCode: "study" }
  ],
  qa: [
    { slug: "qa-facilities", label: "시설", sectionCode: "qa" },
    { slug: "qa-dorm", label: "기숙사", sectionCode: "qa" },
    { slug: "qa-study", label: "학업", sectionCode: "qa" }
  ],
  fun: [
    { slug: "fun-food-cafe", label: "Food · 카페", sectionCode: "fun" },
    { slug: "fun-food-chinese", label: "Food · 중식", sectionCode: "fun" },
    { slug: "fun-food-western", label: "Food · 양식", sectionCode: "fun" },
    { slug: "fun-food-korean", label: "Food · 한식", sectionCode: "fun" },
    { slug: "fun-food-japanese", label: "Food · 일식", sectionCode: "fun" },
    { slug: "fun-food-other", label: "Food · Other", sectionCode: "fun" },
    { slug: "fun-place", label: "Place", sectionCode: "fun" },
    { slug: "fun-church-intro", label: "Church · 소개", sectionCode: "fun" },
    { slug: "fun-church-notice", label: "Church · 공지", sectionCode: "fun" }
  ]
};

const CAMPUS_NOTICE_CATEGORY_OPTIONS: CategoryOption[] = [
  { slug: "life-notice", label: "공지", sectionCode: "life" },
  { slug: "life-opportunity", label: "기회의 장", sectionCode: "life" },
  { slug: "life-info-sharing", label: "정보 공유", sectionCode: "life" }
];

const CAMPUS_NOTICE_CATEGORY_SLUGS = new Set(
  CAMPUS_NOTICE_CATEGORY_OPTIONS.map((category) => category.slug)
);

function canUseNoticeCategory(tier: AccessTier | null | undefined): boolean {
  return tier === "campus_master";
}

function parseRpcResponseValue(value: unknown): CreatePostResult {
  if (typeof value === "string") {
    return { postId: value, message: null };
  }

  if (value && typeof value === "object") {
    const maybeRecord = value as Record<string, unknown>;

    const postIdRaw =
      maybeRecord.post_id ??
      maybeRecord.postId ??
      maybeRecord.postid ??
      maybeRecord.id;
    const messageRaw = maybeRecord.message;

    return {
      postId:
        typeof postIdRaw === "string"
          ? postIdRaw
          : typeof postIdRaw === "number"
            ? String(postIdRaw)
            : null,
      message: typeof messageRaw === "string" ? messageRaw : null
    };
  }

  return {
    postId: null,
    message: null
  };
}

function parseCreatePostResponse(data: CreatePostRpcReturn | null): CreatePostResult {
  if (data === null) {
    return {
      postId: null,
      message: "Post created, but no result payload was returned."
    };
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return {
        postId: null,
        message: "Post created, but no result payload was returned."
      };
    }

    return parseRpcResponseValue(data[0]);
  }

  return parseRpcResponseValue(data);
}

export function getComposeSectionOptions(tier: AccessTier): ComposeSectionOption[] {
  if (tier === "church_master") {
    return [SECTION_CATALOG.fun];
  }

  if (tier === "campus_master") {
    return [SECTION_CATALOG.life];
  }

  if (tier === "bronze") {
    return [SECTION_CATALOG.qa];
  }

  return [
    SECTION_CATALOG.life,
    SECTION_CATALOG.study,
    SECTION_CATALOG.qa,
    SECTION_CATALOG.fun
  ];
}

export function getDefaultSection(
  options: ComposeSectionOption[]
): ComposeSectionOption | null {
  if (options.length === 0) {
    return null;
  }

  return options[0] ?? null;
}

export type AccessTier =
  | "bronze"
  | "silver"
  | "gold"
  | "emerald"
  | "diamond"
  | "platinum"
  | "master"
  | "grandmaster"
  | "church_master"
  | "campus_master";

export type PostLanguageCode = "ko" | "en";

export type ShanghaiMainCategoryKey = "food" | "place" | "church";

export function isElevatedTier(tier: AccessTier): boolean {
  return (
    tier === "silver" ||
    tier === "gold" ||
    tier === "emerald" ||
    tier === "diamond" ||
    tier === "platinum" ||
    tier === "master" ||
    tier === "grandmaster" ||
    tier === "church_master" ||
    tier === "campus_master"
  );
}

const TIER_VALUES: AccessTier[] = [
  "bronze",
  "silver",
  "gold",
  "emerald",
  "diamond",
  "platinum",
  "master",
  "grandmaster",
  "church_master",
  "campus_master"
];

function isTierValue(value: string | null | undefined): value is AccessTier {
  return typeof value === "string" && (TIER_VALUES as string[]).includes(value);
}

export function getAccessTier(profile: UserProfileRow): AccessTier {
  const roleTier = isTierValue(profile.role as DbUserRole)
    ? (profile.role as AccessTier)
    : null;
  const explicitTier = isTierValue(profile.tier) ? profile.tier : null;

  return roleTier ?? explicitTier ?? "bronze";
}

export function isChurchMasterProfile(profile: UserProfileRow | null | undefined): boolean {
  if (!profile) {
    return false;
  }

  return profile.role === "church_master" || profile.tier === "church_master";
}

export function isCampusMasterProfile(profile: UserProfileRow | null | undefined): boolean {
  if (!profile) {
    return false;
  }

  return profile.role === "campus_master" || profile.tier === "campus_master";
}

export function isChurchCategorySlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && slug.startsWith("fun-church-");
}

export function isChurchIntroCategorySlug(slug: string | null | undefined): boolean {
  return slug === "fun-church-intro";
}

export function isCampusNoticeCategorySlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && CAMPUS_NOTICE_CATEGORY_SLUGS.has(slug);
}

export function getShanghaiMainCategoryFromSlug(
  slug: string | null | undefined
): ShanghaiMainCategoryKey | null {
  if (!slug) {
    return null;
  }

  if (slug.startsWith("fun-food-")) {
    return "food";
  }

  if (slug === "fun-place") {
    return "place";
  }

  if (slug.startsWith("fun-church-")) {
    return "church";
  }

  return null;
}

export function getShanghaiSubcategoryOptions(mainCategory: ShanghaiMainCategoryKey): CategoryOption[] {
  const all = CATEGORY_CATALOG.fun;
  if (mainCategory === "food") {
    return all.filter((category) => category.slug.startsWith("fun-food-"));
  }

  if (mainCategory === "church") {
    return all.filter((category) => category.slug.startsWith("fun-church-"));
  }

  return all.filter((category) => category.slug === "fun-place");
}

export function getCategoryOptionsForSection(
  sectionCode: ComposeSectionCode,
  tier?: AccessTier | null,
  profile?: UserProfileRow | null
): CategoryOption[] {
  const base = [...(CATEGORY_CATALOG[sectionCode] ?? [])];

  if (sectionCode === "fun") {
    if (isChurchMasterProfile(profile)) {
      return base.filter((category) => category.slug.startsWith("fun-church-"));
    }

    return base.filter((category) => !category.slug.startsWith("fun-church-"));
  }

  if (sectionCode === "life" && isCampusMasterProfile(profile)) {
    return [...CAMPUS_NOTICE_CATEGORY_OPTIONS];
  }

  if (sectionCode === "life" && canUseNoticeCategory(tier)) {
    return [
      ...base,
      ...CAMPUS_NOTICE_CATEGORY_OPTIONS
    ];
  }

  return base;
}

export function isUniversityRequired(
  tier: AccessTier,
  sectionCode: ComposeSectionCode
): boolean {
  return tier === "bronze" && sectionCode === "qa";
}

export function isUniversitySelectorDisabled(sectionCode: ComposeSectionCode): boolean {
  return sectionCode === "fun";
}

export function getUniversityOptionsForTier(
  tier: AccessTier,
  universities: UniversityOption[],
  ownUniversitySlug: string | null
): UniversityOption[] {
  if (tier === "bronze") {
    return universities;
  }

  if (!ownUniversitySlug) {
    return universities;
  }

  return universities.filter((university) => university.slug === ownUniversitySlug);
}

export function normalizeTags(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
}

export async function fetchActiveUniversities(): Promise<UniversityOption[]> {
  const { data, error } = await supabase
    .from("universities")
    .select("id, slug, name:name_ko, short_name")
    .eq("is_active", true)
    .order("name_ko", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as unknown as Array<{
    id: string;
    slug: string;
    name: string;
    short_name: string;
  }>);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name
  }));
}

export async function fetchUniversityById(
  universityId: string
): Promise<VerifiedUniversity | null> {
  const { data, error } = await supabase
    .from("universities")
    .select("id, slug, name:name_ko, short_name")
    .eq("id", universityId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = (data as unknown as {
    id: string;
    slug: string | null;
    name: string | null;
    short_name: string | null;
  } | null);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name
  };
}

export async function enqueuePostTranslation(params: {
  postId: number;
  sourceLanguage: PostLanguageCode;
  targetLanguage: PostLanguageCode;
}): Promise<void> {
  const { postId, sourceLanguage, targetLanguage } = params;
  const { error } = await supabase.rpc("enqueue_post_translation", {
    p_post_id: postId,
    p_source_language: sourceLanguage,
    p_target_language: targetLanguage
  });

  if (error) {
    throw error;
  }
}

export async function createPostViaRpc(input: CreatePostInput): Promise<CreatePostResult> {
  const { data, error } = await supabase.rpc("create_post", {
    p_section_code: input.sectionCode,
    p_category_slug: input.categorySlug,
    p_title: input.title,
    p_body: input.body,
    p_university_slug: input.universitySlug,
    p_location_text: input.locationText,
    p_tags: input.tags
  });

  if (error) {
    throw error;
  }

  console.log("[compose.service] create_post raw response", {
    data
  });

  return parseCreatePostResponse(data);
}

export async function upsertChurchIntroContent(input: {
  title: string;
  body: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase.from("church_page_content").upsert(
    {
      id: 1,
      title: input.title,
      body: input.body,
      updated_by: input.userId
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

export async function fetchChurchIntroContent(): Promise<{
  title: string;
  body: string;
}> {
  const { data, error } = await supabase
    .from("church_page_content")
    .select("title, body")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    title: data?.title ?? "",
    body: data?.body ?? ""
  };
}

export async function updatePostBody(postId: number, body: string): Promise<void> {
  const { error } = await supabase.from("posts").update({ body }).eq("id", postId);

  if (error) {
    throw error;
  }
}

export async function updatePostMetadata(params: {
  postId: number;
  abstract?: string | null;
  thumbnailImageUrl?: string | null;
  thumbnailStoragePath?: string | null;
}): Promise<void> {
  const { postId, abstract, thumbnailImageUrl, thumbnailStoragePath } = params;
  const { error } = await supabase
    .from("posts")
    .update({
      abstract: abstract ?? null,
      thumbnail_image_url: thumbnailImageUrl ?? null,
      thumbnail_storage_path: thumbnailStoragePath ?? null
    })
    .eq("id", postId);

  if (error) {
    throw error;
  }
}

export async function updatePostDegree(
  postId: number,
  degree: StudyDegree | null
): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({
      degree: degree ?? null
    })
    .eq("id", postId);

  if (error) {
    throw error;
  }
}

function parseAttachPostImagesResult(data: AttachPostImagesRpcReturn): AttachPostImagesResult {
  if (typeof data === "string") {
    return {
      attachedCount: null,
      message: data
    };
  }

  if (Array.isArray(data)) {
    const first = data[0];

    if (!first || typeof first !== "object") {
      return {
        attachedCount: null,
        message: null
      };
    }

    return {
      attachedCount:
        typeof first.attached_count === "number"
          ? first.attached_count
          : typeof first.attached_count === "string" && /^\d+$/.test(first.attached_count)
            ? Number(first.attached_count)
            : null,
      message: typeof first.message === "string" ? first.message : null
    };
  }

  if (data && typeof data === "object") {
    return {
      attachedCount:
        typeof data.attached_count === "number"
          ? data.attached_count
          : typeof data.attached_count === "string" && /^\d+$/.test(data.attached_count)
            ? Number(data.attached_count)
            : null,
      message: typeof data.message === "string" ? data.message : null
    };
  }

  return {
    attachedCount: null,
    message: null
  };
}

export async function attachPostImages(
  postId: number,
  uploadedImages: UploadedPostImage[]
): Promise<AttachPostImagesResult> {
  if (uploadedImages.length === 0) {
    return {
      attachedCount: 0,
      message: null
    };
  }

  const { data, error } = await supabase.rpc("attach_post_images", {
    p_post_id: postId,
    p_storage_paths: uploadedImages.map((image) => image.storagePath),
    p_image_urls: uploadedImages.map((image) => image.imageUrl)
  });

  if (error) {
    throw error;
  }

  return parseAttachPostImagesResult(data);
}

export type AwardPostPointsResult = {
  awarded: boolean;
  awardedPoints: number;
  tierAtAward: string | null;
  nextPointTier: string | null;
  totalPoints: number | null;
  isQualified: boolean;
  imageCount: number | null;
  bodyTextLength: number | null;
  message: string | null;
};

function parseAwardPostPointsResult(data: AwardPostPointsRpcReturn): AwardPostPointsResult {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    return {
      awarded: false,
      awardedPoints: 0,
      tierAtAward: null,
      nextPointTier: null,
      totalPoints: null,
      isQualified: false,
      imageCount: null,
      bodyTextLength: null,
      message: null
    };
  }

  return {
    awarded: row.awarded === true,
    awardedPoints: typeof row.awarded_points === "number" ? row.awarded_points : 0,
    tierAtAward: typeof row.tier_at_award === "string" ? row.tier_at_award : null,
    nextPointTier: typeof row.next_point_tier === "string" ? row.next_point_tier : null,
    totalPoints: typeof row.total_points === "number" ? row.total_points : null,
    isQualified: row.is_qualified === true,
    imageCount: typeof row.image_count === "number" ? row.image_count : null,
    bodyTextLength: typeof row.body_text_length === "number" ? row.body_text_length : null,
    message: typeof row.message === "string" ? row.message : null
  };
}

export async function awardPostPoints(postId: number): Promise<AwardPostPointsResult> {
  const { data, error } = await supabase.rpc("award_post_points", {
    p_post_id: postId
  });

  if (error) {
    throw error;
  }

  return parseAwardPostPointsResult(data);
}

export function parsePostId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const numericCandidate = trimmed.match(/\b\d+\b/);
  if (numericCandidate) {
    return Number(numericCandidate[0]);
  }

  return null;
}

export function mapCreatePostError(error: unknown): string {
  const fallback = "Unable to create post right now. Please try again.";

  const rawMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (!rawMessage) {
    return fallback;
  }

  const message = rawMessage.toLowerCase();

  if (message.includes("bronze") && message.includes("1 question") && message.includes("shanghai day")) {
    return "Bronze accounts can post up to 1 question per Shanghai day.";
  }

  if (message.includes("bronze") && message.includes("q&a")) {
    return "Bronze accounts can only create Q&A posts.";
  }

  if (message.includes("own university") || message.includes("verified university")) {
    return "Posting is limited to your verified university (or LIFE).";
  }

  if (message.includes("vlog")) {
    return "VLOG posting is currently unavailable.";
  }

  if (message.includes("church")) {
    return "Church content can only be created by Church-Master.";
  }

  return rawMessage || fallback;
}
