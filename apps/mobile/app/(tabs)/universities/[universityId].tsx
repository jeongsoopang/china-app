import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, type ImageSourcePropType, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../../src/features/auth/auth-session";
import { supabase } from "../../../src/lib/supabase/client";
import { TierMarker, resolveTierMarkerValue } from "../../../src/ui/tier-marker";
import { colors, radius, spacing, typography } from "../../../src/ui/theme";

type UniversityRow = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
};

type UniversityPost = {
  id: number;
  authorId: string;
  authorName: string | null;
  authorTier: string | null;
  title: string;
  body: string;
  abstract: string | null;
  thumbnailImageUrl: string | null;
  degree: "bachelor" | "master" | "phd" | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  section: { slug: string | null } | null;
  category: { slug: string | null } | null;
  images: { imageUrl: string; sortOrder: number | null }[];
};

type AlumniContent = {
  title: string;
  body: string;
  isVisible: boolean;
};

type SectionFilter = "all" | "life" | "study" | "qa" | "notice" | "alumni";
type NoticeCategoryFilter = "all" | "life-notice" | "life-opportunity" | "life-info-sharing";
type CampusSlug = "minhang" | "xuhui" | "medical" | "putuo" | "hongkou" | "songjiang";
type ViewerTier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "master"
  | "grandmaster"
  | "admin"
  | "campus_master"
  | "church_master";


const UNIVERSITY_CHINESE_NAME_BY_SHORT: Record<string, string> = {
  sjtu: "上海交通大学",
  ecnu: "华东师范大学",
  sisu: "上海外国语大学",
  tongji: "同济大学",
  fudan: "复旦大学",
  sufe: "上海财经大学"
};


const STUDY_DEGREE_CARDS = [
  {
    degree: "bachelor",
    label: "学士 Bachelor",
    imageSource: require("../../../assets/study/study-bachelor.png")
  },
  {
    degree: "master",
    label: "硕士 Master",
    imageSource: require("../../../assets/study/study-master.png")
  },
  {
    degree: "phd",
    label: "博士 PhD",
    imageSource: require("../../../assets/study/study-phd.png")
  }
] as const;

const QA_CATEGORY_CARDS = [
  {
    slug: "qa-facilities",
    label: "시설"
  },
  {
    slug: "qa-dorm",
    label: "기숙사"
  },
  {
    slug: "qa-study",
    label: "학업"
  }
] as const;

const CAMPUS_NOTICE_CATEGORY_SLUGS = [
  "life-notice",
  "life-opportunity",
  "life-info-sharing"
] as const;

const NOTICE_CATEGORY_FILTER_OPTIONS: Array<{ value: NoticeCategoryFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "life-notice", label: "공지" },
  { value: "life-opportunity", label: "기회의 장" },
  { value: "life-info-sharing", label: "정보 공유" }
];

const SJTU_CAMPUS_CARDS: Array<{
  slug: CampusSlug;
  label: string;
  imageSource: ImageSourcePropType;
}> = [
  {
    slug: "minhang",
    label: "민항",
    imageSource: require("../../../assets/universities/sjtu/minhang-card.png")
  },
  {
    slug: "xuhui",
    label: "쉬후이",
    imageSource: require("../../../assets/universities/sjtu/xuhui-card.png")
  },
  {
    slug: "medical",
    label: "의학원",
    imageSource: require("../../../assets/universities/sjtu/medical-card.png")
  }
];

const ECNU_CAMPUS_CARDS: Array<{
  slug: CampusSlug;
  label: string;
  imageSource: ImageSourcePropType;
}> = [
  {
    slug: "putuo",
    label: "Putuo",
    imageSource: require("../../../assets/universities/ecnu/putuo-card.png")
  },
  {
    slug: "minhang",
    label: "Minhang",
    imageSource: require("../../../assets/universities/ecnu/minhang-card.png")
  }
];

const SISU_CAMPUS_CARDS: Array<{
  slug: CampusSlug;
  label: string;
  imageSource: ImageSourcePropType;
}> = [
  {
    slug: "hongkou",
    label: "Hongkou",
    imageSource: require("../../../assets/universities/sisu/hongkou-card.png")
  },
  {
    slug: "songjiang",
    label: "Songjiang",
    imageSource: require("../../../assets/universities/sisu/songjiang-card.png")
  }
];

function prefetchRemoteImages(urls: Array<string | null | undefined>) {
  urls
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .forEach((url) => {
      void Image.prefetch(url);
    });
}

export default function UniversityDetailScreen() {
  const auth = useAuthSession();
  const router = useRouter();
  const { universityId, section, campusSlug } = useLocalSearchParams<{
    universityId: string;
    section?: string;
    campusSlug?: string;
  }>();
  const [university, setUniversity] = useState<UniversityRow | null>(null);
  const [posts, setPosts] = useState<UniversityPost[]>([]);
  const initialSectionFilter = useMemo<SectionFilter>(() => {
    const raw = Array.isArray(section) ? section[0] : section;
    if (raw === "life" || raw === "study" || raw === "qa" || raw === "notice" || raw === "alumni") {
      return raw;
    }
    return "all";
  }, [section]);

  const [filter, setFilter] = useState<SectionFilter>(initialSectionFilter);
  const [noticeCategoryFilter, setNoticeCategoryFilter] = useState<NoticeCategoryFilter>("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [alumniContent, setAlumniContent] = useState<AlumniContent | null>(null);
  const [isAlumniLoading, setIsAlumniLoading] = useState<boolean>(false);
  const [alumniError, setAlumniError] = useState<string | null>(null);
  const [viewerUniversityId, setViewerUniversityId] = useState<string | null>(null);
  const [viewerTier, setViewerTier] = useState<ViewerTier | null>(null);
  const [isViewerUniversityLoading, setIsViewerUniversityLoading] = useState<boolean>(true);

  const resolvedUniversityId = useMemo(() => {
    if (!universityId) {
      return null;
    }

    return Array.isArray(universityId) ? universityId[0] : universityId;
  }, [universityId]);
  const resolvedCampusSlug = useMemo(() => {
    const raw = Array.isArray(campusSlug) ? campusSlug[0] : campusSlug;
    if (
      raw === "minhang" ||
      raw === "xuhui" ||
      raw === "medical" ||
      raw === "putuo" ||
      raw === "hongkou" ||
      raw === "songjiang"
    ) {
      return raw;
    }
    return null;
  }, [campusSlug]);

  useEffect(() => {
    setFilter(initialSectionFilter);
    setNoticeCategoryFilter("all");
  }, [initialSectionFilter]);

  const universityChineseName = useMemo(() => {
    const key = university?.slug?.trim().toLowerCase() ?? "";
    return UNIVERSITY_CHINESE_NAME_BY_SHORT[key] ?? null;
  }, [university?.slug]);
  const universityKey = useMemo(() => {
    return university?.slug?.trim().toLowerCase() ?? university?.shortName?.trim().toLowerCase() ?? "";
  }, [university?.shortName, university?.slug]);

  const isSjtuUniversity = universityKey === "sjtu";
  const isEcnuUniversity = universityKey === "ecnu";
  const isSisuUniversity = universityKey === "sisu";

  const campusCards = useMemo(() => {
    if (isSjtuUniversity) {
      return SJTU_CAMPUS_CARDS;
    }
    if (isEcnuUniversity) {
      return ECNU_CAMPUS_CARDS;
    }
    if (isSisuUniversity) {
      return SISU_CAMPUS_CARDS;
    }
    return [];
  }, [isEcnuUniversity, isSisuUniversity, isSjtuUniversity]);

  const hasCampusLanding = campusCards.length > 0;
  const isCampusLanding = hasCampusLanding && !resolvedCampusSlug;
  const isSjtuCampusLanding = isSjtuUniversity && !resolvedCampusSlug;

  const campusLabel = useMemo(() => {
    if (resolvedCampusSlug === "minhang" && isSjtuUniversity) {
      return "민항";
    }
    if (resolvedCampusSlug === "xuhui") {
      return "쉬후이";
    }
    if (resolvedCampusSlug === "medical") {
      return "의학원";
    }
    if (resolvedCampusSlug === "putuo") {
      return "Putuo";
    }
    if (resolvedCampusSlug === "hongkou") {
      return "Hongkou";
    }
    if (resolvedCampusSlug === "songjiang") {
      return "Songjiang";
    }
    if (resolvedCampusSlug === "minhang" && (isEcnuUniversity || isSisuUniversity)) {
      return "Minhang";
    }
    return null;
  }, [isEcnuUniversity, isSisuUniversity, isSjtuUniversity, resolvedCampusSlug]);

  const currentUniversityBasePath = useMemo(() => {
    if (!resolvedUniversityId) {
      return "/universities";
    }

    if (resolvedCampusSlug) {
      return `/universities/${resolvedUniversityId}/campus/${resolvedCampusSlug}`;
    }

    return `/universities/${resolvedUniversityId}`;
  }, [resolvedCampusSlug, resolvedUniversityId]);

  const currentUniversityReturnTo = useMemo(() => {
    const currentFilter = filter === "all" ? "all" : filter;
    return `${currentUniversityBasePath}?section=${currentFilter}`;
  }, [currentUniversityBasePath, filter]);
  const sjtuLandingReturnTo = useMemo(() => {
    if (!resolvedUniversityId) {
      return "/(tabs)";
    }

    return `/universities/${resolvedUniversityId}`;
  }, [resolvedUniversityId]);

  const onCampusGoBack = useCallback(() => {
    if (resolvedUniversityId) {
      router.replace(`/universities/${resolvedUniversityId}` as never);
      return;
    }

    router.replace("/(tabs)" as never);
  }, [resolvedUniversityId, router]);

  const currentUniversityId =
    university?.id != null ? String(university.id) : null;

  const isBronzeViewer = viewerTier === "bronze";
  const isViewerGrandmaster = viewerTier === "grandmaster" || viewerTier === "admin";
  const canViewCampusNotice =
    !isViewerUniversityLoading &&
    !isBronzeViewer &&
    (isViewerGrandmaster ||
      (Boolean(viewerUniversityId) &&
        Boolean(currentUniversityId) &&
        viewerUniversityId === currentUniversityId));

  const noticeLocked =
    filter === "notice" &&
    !isViewerUniversityLoading &&
    !canViewCampusNotice;
  const canViewAlumni =
    !isViewerUniversityLoading &&
    Boolean(viewerUniversityId) &&
    Boolean(currentUniversityId) &&
    viewerUniversityId === currentUniversityId;
  const alumniLocked =
    filter === "alumni" &&
    !isViewerUniversityLoading &&
    !canViewAlumni;

  useEffect(() => {
    let cancelled = false;

    const toViewerTier = (value: string | null | undefined): ViewerTier | null => {
      const normalized = value?.trim().toLowerCase() ?? null;
      if (
        normalized === "bronze" ||
        normalized === "silver" ||
        normalized === "gold" ||
        normalized === "platinum" ||
        normalized === "master" ||
        normalized === "grandmaster" ||
        normalized === "admin" ||
        normalized === "campus_master" ||
        normalized === "church_master"
      ) {
        return normalized;
      }

      return null;
    };

    async function loadViewerUniversity() {
      if (isCampusLanding) {
        setViewerUniversityId(null);
        setViewerTier(null);
        setIsViewerUniversityLoading(false);
        return;
      }

      setIsViewerUniversityLoading(true);

      const sessionProfile = auth.user?.profile;
      if (sessionProfile) {
        const sessionTier =
          toViewerTier(sessionProfile.role) ??
          toViewerTier(sessionProfile.tier);

        if (!cancelled) {
          setViewerUniversityId(
            sessionProfile.verified_university_id != null
              ? String(sessionProfile.verified_university_id)
              : null
          );
          setViewerTier(sessionTier);
          setIsViewerUniversityLoading(false);
        }
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (authError || !authData.user) {
        setViewerUniversityId(null);
        setViewerTier(null);
        setIsViewerUniversityLoading(false);
        return;
      }

      const withTierResult = await supabase
        .from("user_profiles")
        .select("verified_university_id, role, tier")
        .eq("id", authData.user.id)
        .maybeSingle();

      let profile = withTierResult.data as
        | {
            verified_university_id: string | number | null;
            role?: string | null;
            tier?: string | null;
          }
        | null;
      let profileError = withTierResult.error;

      if (profileError && /column/i.test(profileError.message) && /tier/i.test(profileError.message)) {
        const withoutTierResult = await supabase
          .from("user_profiles")
          .select("verified_university_id, role")
          .eq("id", authData.user.id)
          .maybeSingle();
        profile = withoutTierResult.data;
        profileError = withoutTierResult.error;
      }

      if (cancelled) {
        return;
      }

      if (profileError) {
        setViewerUniversityId(null);
        setViewerTier(null);
        setIsViewerUniversityLoading(false);
        return;
      }

      const profileRow = profile as
        | {
            verified_university_id: string | number | null;
            role?: string | null;
            tier?: string | null;
          }
        | null;

      setViewerUniversityId(
        profileRow?.verified_university_id != null
          ? String(profileRow.verified_university_id)
          : null
      );
      const metadata = authData.user.user_metadata as Record<string, unknown> | null;
      const appMetadata = authData.user.app_metadata as Record<string, unknown> | null;
      const metadataRole =
        typeof metadata?.role === "string" ? metadata.role : null;
      const metadataTier =
        typeof metadata?.tier === "string" ? metadata.tier : null;
      const appMetadataRole =
        typeof appMetadata?.role === "string" ? appMetadata.role : null;
      const appMetadataTier =
        typeof appMetadata?.tier === "string" ? appMetadata.tier : null;

      const normalizedTier: ViewerTier | null =
        toViewerTier(profileRow?.role) ??
        toViewerTier(profileRow?.tier) ??
        toViewerTier(metadataRole) ??
        toViewerTier(metadataTier) ??
        toViewerTier(appMetadataRole) ??
        toViewerTier(appMetadataTier);

      setViewerTier(normalizedTier);
      setIsViewerUniversityLoading(false);
    }

    void loadViewerUniversity();

    return () => {
      cancelled = true;
    };
  }, [auth.user?.profile, isCampusLanding]);

  useEffect(() => {
    let cancelled = false;

    async function loadUniversity() {
      if (!resolvedUniversityId) {
        setErrorMessage("Invalid university identifier.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const { data: bySlug, error: slugError } = await supabase
        .from("universities")
        .select("id, name_ko, name_en, short_name, slug")
        .eq("slug", resolvedUniversityId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (slugError) {
        setErrorMessage(slugError.message);
        setIsLoading(false);
        return;
      }

      const bySlugRow = bySlug as unknown as {
        id: string;
        name_ko: string;
        short_name: string | null;
        slug: string;
      } | null;

      if (bySlugRow) {
        setUniversity({
          id: bySlugRow.id,
          name: bySlugRow.name_ko,
          shortName: bySlugRow.short_name ?? null,
          slug: bySlugRow.slug
        });
        setIsLoading(false);
        return;
      }

      const numericUniversityId = /^\d+$/.test(resolvedUniversityId)
        ? Number(resolvedUniversityId)
        : null;

      if (numericUniversityId === null) {
        setErrorMessage("University not found.");
        setIsLoading(false);
        return;
      }

      const { data: byId, error: idError } = await supabase
        .from("universities")
        .select("id, name_ko, name_en, short_name, slug")
        .eq("id", resolvedUniversityId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (idError) {
        setErrorMessage(idError.message);
        setIsLoading(false);
        return;
      }

      if (!byId) {
        setErrorMessage("University not found.");
        setIsLoading(false);
        return;
      }

      const byIdRow = byId as unknown as {
        id: string;
        name_ko: string;
        short_name: string | null;
        slug: string;
      };

      setUniversity({
        id: byIdRow.id,
        name: byIdRow.name_ko,
        shortName: byIdRow.short_name ?? null,
        slug: byIdRow.slug
      });
      setIsLoading(false);
    }

    void loadUniversity();

    return () => {
      cancelled = true;
    };
  }, [resolvedUniversityId]);

  const postQueryLimit = isSjtuCampusLanding ? 3 : 30;

  const loadPosts = useCallback(async () => {
    if (!university) {
      return;
    }

    if (filter === "alumni") {
      setPosts([]);
      setPostsError(null);
      setIsLoading(false);
      return;
    }

    if (filter === "notice" && (isViewerUniversityLoading || !canViewCampusNotice)) {
      setPosts([]);
      setPostsError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setPostsError(null);

    const attemptWithMetadata = async () => {
      let query = supabase
        .from("posts")
        .select(
          `
          id,
          author_id,
          category_id,
          title,
          body,
          abstract,
          thumbnail_image_url,
          degree,
          like_count,
          comment_count,
          view_count,
          created_at,
          sections!inner ( code ),
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("university_id", university.id)
        .order("created_at", { ascending: false })
        .limit(postQueryLimit);

      if (filter === "notice") {
        query = query
          .eq("sections.code", "life")
          .in("categories.slug", [...CAMPUS_NOTICE_CATEGORY_SLUGS]);
      } else if (filter === "all") {
        query = query
          .in("sections.code", ["life", "study", "qa"])
          .neq("categories.slug", "life-notice")
          .neq("categories.slug", "life-opportunity")
          .neq("categories.slug", "life-info-sharing");
      } else if (filter === "life") {
        query = query
          .eq("sections.code", "life")
          .neq("categories.slug", "life-notice")
          .neq("categories.slug", "life-opportunity")
          .neq("categories.slug", "life-info-sharing");
      } else {
        query = query.eq("sections.code", filter);
      }

      return query;
    };

    const attemptWithoutMetadata = async () => {
      let query = supabase
        .from("posts")
        .select(
          `
          id,
          author_id,
          category_id,
          title,
          body,
          degree,
          like_count,
          comment_count,
          view_count,
          created_at,
          sections!inner ( code ),
          categories ( slug ),
          post_images ( image_url, sort_order )
        `
        )
        .eq("university_id", university.id)
        .order("created_at", { ascending: false })
        .limit(postQueryLimit);

      if (filter === "notice") {
        query = query
          .eq("sections.code", "life")
          .in("categories.slug", [...CAMPUS_NOTICE_CATEGORY_SLUGS]);
      } else if (filter === "all") {
        query = query
          .in("sections.code", ["life", "study", "qa"])
          .neq("categories.slug", "life-notice")
          .neq("categories.slug", "life-opportunity")
          .neq("categories.slug", "life-info-sharing");
      } else if (filter === "life") {
        query = query
          .eq("sections.code", "life")
          .neq("categories.slug", "life-notice")
          .neq("categories.slug", "life-opportunity")
          .neq("categories.slug", "life-info-sharing");
      } else {
        query = query.eq("sections.code", filter);
      }

      return query;
    };

    let data: unknown = null;
    let error: { message: string } | null = null;

    const withMetadata = await attemptWithMetadata();
    data = withMetadata.data;
    error = withMetadata.error ? { message: withMetadata.error.message } : null;

    if (error && /column/i.test(error.message) && /abstract|thumbnail_image_url/i.test(error.message)) {
      const withoutMetadata = await attemptWithoutMetadata();
      data = withoutMetadata.data;
      error = withoutMetadata.error ? { message: withoutMetadata.error.message } : null;
    }

    if (error) {
      setPostsError(error.message);
      setPosts([]);
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: number;
      author_id: string;
      category_id: number | null;
      title: string;
      body: string;
      abstract?: string | null;
      thumbnail_image_url?: string | null;
      degree?: string | null;
      like_count: number | null;
      comment_count: number | null;
      view_count: number | null;
      created_at: string;
      sections: { code: string | null } | null;
      categories: { slug: string | null } | null;
      post_images: Array<{ image_url: string; sort_order: number | null }> | null;
    }>;

    const { data: noticeCategoryRows } = await supabase
      .from("categories")
      .select("id, slug")
      .in("slug", [...CAMPUS_NOTICE_CATEGORY_SLUGS]);

    const noticeCategoryIds = new Set(
      ((noticeCategoryRows ?? []) as Array<{ id: string | number }>).map((row) => String(row.id))
    );
    const noticeCategorySlugById = new Map<string, string>();
    ((noticeCategoryRows ?? []) as Array<{ id: string | number; slug: string | null }>).forEach((row) => {
      if (typeof row.slug === "string") {
        noticeCategorySlugById.set(String(row.id), row.slug);
      }
    });

    const mapped: UniversityPost[] = rows.map((row) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: null,
      authorTier: null,
      title: row.title,
      body: row.body,
      abstract: typeof row.abstract === "string" ? row.abstract : null,
      thumbnailImageUrl:
        typeof row.thumbnail_image_url === "string" ? row.thumbnail_image_url : null,
      degree:
        row.degree === "bachelor" || row.degree === "master" || row.degree === "phd"
          ? row.degree
          : null,
      likeCount: row.like_count ?? 0,
      commentCount: row.comment_count ?? 0,
      viewCount: row.view_count ?? 0,
      createdAt: row.created_at,
      section: row.sections ? { slug: row.sections.code ?? null } : null,
      category: row.categories ? { slug: row.categories.slug ?? null } : null,
      images: ((row.post_images ?? []) as Array<{ image_url: string; sort_order: number | null }>).map(
        (image: { image_url: string; sort_order: number | null }) => ({
          imageUrl: image.image_url,
          sortOrder: image.sort_order ?? null
        })
      )
    }));

    const campusScopedRows =
      hasCampusLanding && resolvedCampusSlug
        ? rows
        : rows;

    const filteredRows = campusScopedRows.filter((row) => {
      const noticeSlugFromJoin =
        typeof row.categories?.slug === "string" ? row.categories.slug : null;
      const noticeSlugFromCategoryId =
        row.category_id != null ? noticeCategorySlugById.get(String(row.category_id)) ?? null : null;
      const resolvedNoticeSlug = noticeSlugFromJoin ?? noticeSlugFromCategoryId;
      const isNoticeRow =
        (row.category_id != null && noticeCategoryIds.has(String(row.category_id))) ||
        (resolvedNoticeSlug !== null &&
          CAMPUS_NOTICE_CATEGORY_SLUGS.includes(
            resolvedNoticeSlug as (typeof CAMPUS_NOTICE_CATEGORY_SLUGS)[number]
          ));

      if (isSjtuCampusLanding) {
        return !isNoticeRow;
      }

      if (filter === "notice") {
        if (!isNoticeRow) {
          return false;
        }

        if (noticeCategoryFilter === "all") {
          return true;
        }

        return resolvedNoticeSlug === noticeCategoryFilter;
      }

      if (filter === "all" || filter === "life") {
        return !isNoticeRow;
      }

      return true;
    });

    const allowedIds = new Set(filteredRows.map((row) => row.id));

    const initialPosts = mapped
      .filter((row) => allowedIds.has(row.id))
      .map((row) => ({
        ...row,
        authorName: null,
        authorTier: null
      }));

    setPosts(initialPosts);
    setIsLoading(false);

    const authorIds = Array.from(new Set(initialPosts.map((row) => row.authorId)));
    if (authorIds.length === 0) {
      return;
    }

    const withTierProfilesResult = await supabase
      .from("user_profiles")
      .select("id, display_name, tier, role")
      .in("id", authorIds);

    let profileData = (withTierProfilesResult.data ?? null) as
      | Array<{
          id: string;
          display_name?: string | null;
          tier?: string | null;
          role?: string | null;
        }>
      | null;
    let profileError = withTierProfilesResult.error;

    if (profileError && /column/i.test(profileError.message) && /tier/i.test(profileError.message)) {
      const withoutTierProfilesResult = await supabase
        .from("user_profiles")
        .select("id, display_name, role")
        .in("id", authorIds);
      profileData = (withoutTierProfilesResult.data ?? null) as
        | Array<{
            id: string;
            display_name?: string | null;
            tier?: string | null;
            role?: string | null;
          }>
        | null;
      profileError = withoutTierProfilesResult.error;
    }

    if (profileError) {
      return;
    }

    const displayNameMap = new Map<string, string | null>();
    const tierMap = new Map<string, string | null>();
    (profileData ?? []).forEach((profile) => {
      displayNameMap.set(profile.id, profile.display_name ?? null);
      const tierValue = resolveTierMarkerValue(profile.tier, profile.role);
      tierMap.set(profile.id, tierValue);
    });

    setPosts((current) =>
      current.map((row) => ({
        ...row,
        authorName: displayNameMap.get(row.authorId) ?? row.authorName ?? null,
        authorTier: tierMap.get(row.authorId) ?? row.authorTier ?? null
      }))
    );
  }, [
    canViewCampusNotice,
    filter,
    noticeCategoryFilter,
    isViewerUniversityLoading,
    postQueryLimit,
    university,
    isSjtuUniversity,
    resolvedCampusSlug,
    isSjtuCampusLanding
  ]);

  const loadAlumniContent = useCallback(async () => {
    if (!university) {
      return;
    }

    if (filter !== "alumni") {
      return;
    }

    if (isViewerUniversityLoading || !canViewAlumni) {
      setAlumniContent(null);
      setAlumniError(null);
      setIsAlumniLoading(false);
      return;
    }

    setIsAlumniLoading(true);
    setAlumniError(null);

    const client = supabase as unknown as {
      from: (table: string) => any;
    };

    const { data, error } = await client
      .from("university_alumni_content")
      .select("title, body, is_visible")
      .eq("university_id", university.id)
      .maybeSingle();

    if (error) {
      setAlumniContent(null);
      setAlumniError(error.message);
      setIsAlumniLoading(false);
      return;
    }

    const title = typeof data?.title === "string" ? data.title.trim() : "";
    const body = typeof data?.body === "string" ? data.body.trim() : "";
    const isVisible = typeof data?.is_visible === "boolean" ? data.is_visible : true;

    if (!data || !isVisible || (title.length === 0 && body.length === 0)) {
      setAlumniContent(null);
      setIsAlumniLoading(false);
      return;
    }

    setAlumniContent({
      title,
      body,
      isVisible
    });
    setIsAlumniLoading(false);
  }, [canViewAlumni, filter, isViewerUniversityLoading, university]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    void loadAlumniContent();
  }, [loadAlumniContent]);

  useEffect(() => {
    const urls = posts
      .slice(0, isSjtuCampusLanding ? 3 : 6)
      .map((post) => getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images));

    prefetchRemoteImages(urls);
  }, [isSjtuCampusLanding, posts]);

  const universityReturnTo = currentUniversityReturnTo;
  const onPressAuthorIdentity = useCallback(
    (authorId: string) => {
      router.push({
        pathname: "/users/[userId]",
        params: {
          userId: authorId,
          returnTo: currentUniversityReturnTo
        }
      });
    },
    [currentUniversityReturnTo, router]
  );

  const studyDegreeCounts = useMemo(() => {
    return posts.reduce(
      (acc, post) => {
        if (post.section?.slug !== "study" || !post.degree) {
          return acc;
        }

        acc[post.degree] += 1;
        return acc;
      },
      {
        bachelor: 0,
        master: 0,
        phd: 0
      } as Record<"bachelor" | "master" | "phd", number>
    );
  }, [posts]);

  const qaCategoryCounts = useMemo(() => {
    return posts.reduce(
      (acc, post) => {
        if (post.section?.slug !== "qa") {
          return acc;
        }

        const slug = post.category?.slug;
        if (slug === "qa-facilities" || slug === "qa-dorm" || slug === "qa-study") {
          acc[slug] += 1;
        }

        return acc;
      },
      {
        "qa-facilities": 0,
        "qa-dorm": 0,
        "qa-study": 0
      } as Record<"qa-facilities" | "qa-dorm" | "qa-study", number>
    );
  }, [posts]);

  const recentQaPosts = useMemo(() => {
    return posts.filter((post) => post.section?.slug === "qa").slice(0, 4);
  }, [posts]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {resolvedCampusSlug ? (
        <SafeAreaView style={styles.campusBackSafeArea}>
          <View style={styles.screenHeaderRow}>
            <Pressable onPress={onCampusGoBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              <Text style={styles.backButtonLabel}>Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      ) : null}

      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.heading}>
            {university?.name ?? "University"}
            {universityChineseName ? (
              <Text style={styles.subHeading}> {universityChineseName}</Text>
            ) : null}
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/universities/[universityId]/search",
                params: {
                  universityId: resolvedUniversityId ?? "",
                  returnTo: currentUniversityReturnTo
                }
              })
            }
            style={styles.searchIconButton}
          >
            <Ionicons name="search-outline" size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
        {campusLabel && !isCampusLanding ? <Text style={styles.metaText}>Campus · {campusLabel}</Text> : null}
      </View>

      {!resolvedCampusSlug ? (
        <View style={styles.noticeHeroWrap}>
          <Pressable
            onPress={() => {
              if (isBronzeViewer) {
                return;
              }

              if (hasCampusLanding) {
                router.push({
                  pathname: "/universities/[universityId]/campus/[campusSlug]",
                  params: {
                    universityId: resolvedUniversityId ?? "",
                    campusSlug:
                      isSjtuUniversity ? "minhang" :
                      isEcnuUniversity ? "putuo" :
                      isSisuUniversity ? "hongkou" :
                      "minhang",
                    section: "notice",
                    returnTo: `/universities/${resolvedUniversityId ?? ""}`
                  }
                });
                return;
              }

              router.push({
                pathname: "/universities/[universityId]",
                params: {
                  universityId: resolvedUniversityId ?? "",
                  section: "notice"
                }
              });
            }}
            disabled={isViewerUniversityLoading || isBronzeViewer}
            style={[
              styles.noticeHeroButton,
              (isViewerUniversityLoading || isBronzeViewer) && styles.noticeHeroButtonDisabled
            ]}
          >
            <View style={styles.noticeHeroButtonContent}>
              <Ionicons name="notifications-outline" size={20} color={colors.background} />
              <Text style={styles.noticeHeroButtonLabel}>캠퍼스 공지</Text>
            </View>
          </Pressable>

          {isBronzeViewer ? (
            <Text style={styles.noticeHeroHelper}>Bronze 등급은 캠퍼스 공지를 열람할 수 없습니다.</Text>
          ) : null}
        </View>
      ) : null}

      {isCampusLanding ? (
        <View style={styles.campusRow}>
          {campusCards.map((campus) => (
            <Link
              key={campus.slug}
              asChild
              href={{
                pathname: "/universities/[universityId]/campus/[campusSlug]",
                params: {
                  universityId: resolvedUniversityId ?? "",
                  campusSlug: campus.slug,
                  returnTo: `/universities/${resolvedUniversityId ?? ""}`
                }
              }}
            >
              <Pressable style={styles.campusCard}>
                <View style={styles.campusCardImagePlaceholder}>
                  <Image
                    source={campus.imageSource}
                    style={styles.campusCardImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.campusCardLabel}>{campus.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}

      {isCampusLanding ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Recent Postings</Text>
          {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {postsError ? <Text style={styles.errorText}>{postsError}</Text> : null}
          {!isLoading && posts.length === 0 && !errorMessage && !postsError ? (
            <Text style={styles.metaText}>No posts yet.</Text>
          ) : null}
          {posts.slice(0, 3).map((post) => {
            const previewText = getPreviewText(post.abstract, post.body);
            const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
            const labelParts = [post.section?.slug, post.category?.slug].filter(Boolean).join(" · ");
            const createdLabel = formatDate(post.createdAt);

            return (
              <Link
                key={`sjtu-landing-${post.id}`}
                asChild
                href={{
                  pathname: "/posts/[postId]",
                  params: {
                    postId: String(post.id),
                    returnTo: `/universities/${resolvedUniversityId ?? ""}`
                  }
                }}
              >
                <Pressable style={styles.postCard}>
                  {thumbnailUrl ? (
                    <Image
                      source={{ uri: thumbnailUrl }}
                      style={styles.postThumbnail}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  ) : null}
                  <View style={styles.postContent}>
                    <Text style={styles.postTitle} numberOfLines={2}>
                      {post.title}
                    </Text>
                    {labelParts ? <Text style={styles.postMeta}>{labelParts}</Text> : null}
                    {previewText ? (
                      <Text style={styles.postPreview} numberOfLines={2}>
                        {previewText}
                      </Text>
                    ) : null}
                    <Text style={styles.postMeta}>{createdLabel}</Text>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        onPressAuthorIdentity(post.authorId);
                      }}
                      style={styles.postAuthorButton}
                    >
                      <TierMarker value={post.authorTier} size={18} />
                      <Text style={styles.postAuthorName} numberOfLines={1}>
                        {post.authorName ?? "Unknown"}
                      </Text>
                    </Pressable>
                    <View style={styles.postEngagementRow}>
                      <View style={styles.postEngagementItem}>
                        <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.postMeta}>{post.likeCount}</Text>
                      </View>
                      <View style={styles.postEngagementItem}>
                        <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.postMeta}>{post.commentCount}</Text>
                      </View>
                      <View style={styles.postEngagementItem}>
                        <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.postMeta}>Views {post.viewCount}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Link>
            );
          })}
        </View>
      ) : null}

      {!isCampusLanding ? (
        <View style={styles.filterRow}>
        {([
          { value: "all", label: "All" },
          { value: "life", label: "School" },
          { value: "study", label: "Study" },
          { value: "qa", label: "Q&A" },
          { value: "notice", label: "캠퍼스 공지" },
          { value: "alumni", label: "Alumni" }
        ] as const).map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              if (option.value === "notice") {
                setFilter("notice");
                setNoticeCategoryFilter("all");
                return;
              }

              setFilter(option.value);
              setNoticeCategoryFilter("all");
            }}
            style={[
              styles.filterChip,
              filter === option.value && styles.filterChipSelected
            ]}
          >
            <Text
              style={[
                styles.filterChipLabel,
                filter === option.value && styles.filterChipLabelSelected
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
        </View>
      ) : null}

      {!isCampusLanding && filter === "notice" ? (
        <>
          <View style={styles.noticeCategoryDivider} />
          <View style={styles.noticeCategoryFilterRow}>
            {NOTICE_CATEGORY_FILTER_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setNoticeCategoryFilter(option.value)}
                style={[
                  styles.filterChip,
                  noticeCategoryFilter === option.value && styles.filterChipSelected
                ]}
              >
                <Text
                  style={[
                    styles.filterChipLabel,
                    noticeCategoryFilter === option.value && styles.filterChipLabelSelected
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {!isCampusLanding && filter !== "alumni" && isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
      {!isCampusLanding && filter === "notice" && isViewerUniversityLoading ? (
        <Text style={styles.metaText}>Checking announcement access...</Text>
      ) : null}
      {!isCampusLanding && filter === "alumni" && isViewerUniversityLoading ? (
        <Text style={styles.metaText}>Checking alumni page access...</Text>
      ) : null}
      {!isCampusLanding && filter === "alumni" && isAlumniLoading ? (
        <Text style={styles.metaText}>Loading alumni content...</Text>
      ) : null}
      {!isCampusLanding && errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      {!isCampusLanding && postsError ? <Text style={styles.errorText}>{postsError}</Text> : null}
      {!isCampusLanding && filter === "alumni" && alumniError ? <Text style={styles.errorText}>{alumniError}</Text> : null}
      {!isCampusLanding && filter === "notice" && noticeLocked ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 120,
            paddingHorizontal: spacing.lg
          }}
        >
          <Ionicons name="lock-closed" size={56} color={colors.textMuted} />
          <Text
            style={{
              marginTop: spacing.md,
              color: colors.textMuted,
              fontSize: 15,
              textAlign: "center"
            }}
          >
            {isBronzeViewer
              ? "Bronze 등급은 캠퍼스 공지를 열람할 수 없습니다."
              : "You can only view your campus announcement."}
          </Text>
        </View>
      ) : null}
      {!isCampusLanding && filter === "alumni" && alumniLocked ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 120,
            paddingHorizontal: spacing.lg
          }}
        >
          <Ionicons name="lock-closed" size={56} color={colors.textMuted} />
          <Text
            style={{
              marginTop: spacing.md,
              color: colors.textMuted,
              fontSize: 15,
              textAlign: "center"
            }}
          >
            You can only view your university alumni page.
          </Text>
        </View>
      ) : null}
      {!isLoading &&
      !isCampusLanding &&
      filter !== "study" &&
      filter !== "alumni" &&
      !(filter === "notice" && (isViewerUniversityLoading || noticeLocked)) &&
      posts.length === 0 &&
      !errorMessage &&
      !postsError ? (
        <Text style={styles.metaText}>No posts yet.</Text>
      ) : null}

      {!isSjtuCampusLanding &&
      filter === "alumni" &&
      !isViewerUniversityLoading &&
      !alumniLocked ? (
        <View style={styles.alumniSheetFrame}>
          <View style={styles.alumniSheetPaper}>
            <View style={styles.alumniHeaderBand}>
              <View style={styles.alumniHeaderRuleStrong} />
              <View style={styles.alumniHeaderRuleSoft} />
            </View>

            {alumniContent ? (
              <View style={styles.alumniBodyWrap}>
                {alumniContent.title.length > 0 ? (
                  <Text style={styles.alumniTitle}>{alumniContent.title}</Text>
                ) : null}
                <View style={styles.alumniParagraphRule} />
                <Text style={styles.alumniBody}>{alumniContent.body}</Text>
              </View>
            ) : (
              <View style={styles.alumniEmptyWrap}>
                <Text style={styles.metaText}>No alumni letter published yet.</Text>
              </View>
            )}

            <View style={styles.alumniFooterBand}>
              <View style={styles.alumniFooterRule} />
            </View>
          </View>
        </View>
      ) : null}

      {!isSjtuCampusLanding && filter === "study" ? (
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "stretch",
              gap: spacing.sm
            }}
          >
            {STUDY_DEGREE_CARDS.map((card) => (
              <Link
                key={card.degree}
                asChild
                href={{
                  pathname: "/universities/[universityId]/study/[degree]",
                  params: {
                    universityId: resolvedUniversityId ?? "",
                    degree: card.degree,
                    returnTo: `${currentUniversityBasePath}?section=study`
                  }
                }}
              >
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.xs,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <Image
                    source={card.imageSource}
                    resizeMode="contain"
                    style={{
                      width: 72,
                      height: 92
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.textPrimary,
                      textAlign: "center",
                      lineHeight: 16
                    }}
                  >
                    {card.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      fontWeight: "600"
                    }}
                  >
                    {studyDegreeCounts[card.degree]} Postings
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.body,
                fontWeight: "700",
                color: colors.textPrimary
              }}
            >
              Recent Postings
            </Text>

            {posts.slice(0, 4).map((post) => {
              const previewText = getPreviewText(post.abstract, post.body);
              const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
              const labelParts = [post.section?.slug, post.category?.slug].filter(Boolean).join(" · ");
              const createdLabel = formatDate(post.createdAt);

              return (
                <Link
                  key={`study-recent-${post.id}`}
                  asChild
                  href={{
                    pathname: "/posts/[postId]",
                    params: {
                      postId: String(post.id),
                      returnTo: universityReturnTo
                    }
                  }}
                >
                  <Pressable style={styles.postCard}>
                    {thumbnailUrl ? (
                      <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} />
                    ) : null}
                    <View style={styles.postContent}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {post.title}
                      </Text>
                      {labelParts ? <Text style={styles.postMeta}>{labelParts}</Text> : null}
                      {previewText ? (
                        <Text style={styles.postPreview} numberOfLines={2}>
                          {previewText}
                        </Text>
                      ) : null}
                      <Text style={styles.postMeta}>{createdLabel}</Text>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          onPressAuthorIdentity(post.authorId);
                        }}
                        style={styles.postAuthorButton}
                      >
                        <TierMarker value={post.authorTier} size={18} />
                        <Text style={styles.postAuthorName} numberOfLines={1}>
                          {post.authorName ?? "Unknown"}
                        </Text>
                      </Pressable>
                      <View style={styles.postEngagementRow}>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.postMeta}>{post.likeCount}</Text>
                        </View>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.postMeta}>{post.commentCount}</Text>
                        </View>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.postMeta}>Views {post.viewCount}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>
      ) : null}

      {!isSjtuCampusLanding && filter === "qa" ? (
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "stretch",
              gap: spacing.sm
            }}
          >
            {QA_CATEGORY_CARDS.map((card) => (
              <Link
                key={card.slug}
                asChild
                href={{
                  pathname: "/universities/[universityId]/qa/[categorySlug]",
                  params: {
                    universityId: resolvedUniversityId ?? "",
                    categorySlug: card.slug,
                    returnTo: `${currentUniversityBasePath}?section=qa`
                  }
                }}
              >
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.xs,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.textPrimary,
                      textAlign: "center"
                    }}
                  >
                    {card.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      fontWeight: "600"
                    }}
                  >
                    {qaCategoryCounts[card.slug]} Postings
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text
              style={{
                fontSize: typography.body,
                fontWeight: "700",
                color: colors.textPrimary
              }}
            >
              Recent Q&A
            </Text>

            {recentQaPosts.length === 0 ? (
              <Text style={styles.metaText}>No posts yet.</Text>
            ) : null}

            {recentQaPosts.map((post) => {
              const previewText = getPreviewText(post.abstract, post.body);
              const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
              const labelParts = [post.section?.slug, post.category?.slug].filter(Boolean).join(" · ");
              const createdLabel = formatDate(post.createdAt);

              return (
                <Link
                  key={`qa-recent-${post.id}`}
                  asChild
                  href={{
                    pathname: "/qa/[qaId]",
                    params: {
                      qaId: String(post.id),
                      universityId: resolvedUniversityId ?? "",
                      returnTo: currentUniversityReturnTo
                    }
                  }}
                >
                  <Pressable style={styles.postCard}>
                    {thumbnailUrl ? (
                      <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} />
                    ) : null}
                    <View style={styles.postContent}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {post.title}
                      </Text>
                      {labelParts ? <Text style={styles.postMeta}>{labelParts}</Text> : null}
                      {previewText ? (
                        <Text style={styles.postPreview} numberOfLines={2}>
                          {previewText}
                        </Text>
                      ) : null}
                      <Text style={styles.postMeta}>{createdLabel}</Text>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          onPressAuthorIdentity(post.authorId);
                        }}
                        style={styles.postAuthorButton}
                      >
                        <TierMarker value={post.authorTier} size={18} />
                        <Text style={styles.postAuthorName} numberOfLines={1}>
                          {post.authorName ?? "Unknown"}
                        </Text>
                      </Pressable>
                      <View style={styles.postEngagementRow}>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.postMeta}>{post.likeCount}</Text>
                        </View>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.postMeta}>{post.commentCount}</Text>
                        </View>
                        <View style={styles.postEngagementItem}>
                          <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.postMeta}>Views {post.viewCount}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        </View>
      ) : null}

      {!isSjtuCampusLanding &&
      filter !== "study" &&
      filter !== "qa" &&
      filter !== "alumni" &&
      !(filter === "notice" && noticeLocked) &&
      posts.map((post) => {
        const previewText = getPreviewText(post.abstract, post.body);
        const thumbnailUrl = getThumbnailUrl(post.thumbnailImageUrl, post.body, post.images);
        const labelParts = [post.section?.slug, post.category?.slug].filter(Boolean).join(" · ");
        const createdLabel = formatDate(post.createdAt);

        return (
          <Link
            key={post.id}
            asChild
            href={{
              pathname: "/posts/[postId]",
              params: {
                postId: String(post.id),
                returnTo: universityReturnTo
              }
            }}
          >
            <Pressable style={styles.postCard}>
              {thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} style={styles.postThumbnail} />
              ) : null}
              <View style={styles.postContent}>
                <Text style={styles.postTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                {labelParts ? <Text style={styles.postMeta}>{labelParts}</Text> : null}
                {previewText ? (
                  <Text style={styles.postPreview} numberOfLines={3}>
                    {previewText}
                  </Text>
                ) : null}
                <Text style={styles.postMeta}>{createdLabel}</Text>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    onPressAuthorIdentity(post.authorId);
                  }}
                  style={styles.postAuthorButton}
                >
                  <TierMarker value={post.authorTier} size={18} />
                  <Text style={styles.postAuthorName} numberOfLines={1}>
                    {post.authorName ?? "Unknown"}
                  </Text>
                </Pressable>
                <View style={styles.postEngagementRow}>
                  <View style={styles.postEngagementItem}>
                    <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.postMeta}>{post.likeCount}</Text>
                  </View>
                  <View style={styles.postEngagementItem}>
                    <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.postMeta}>{post.commentCount}</Text>
                  </View>
                  <View style={styles.postEngagementItem}>
                    <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.postMeta}>Views {post.viewCount}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function getPreviewText(abstract: string | null, body: string): string {
  if (abstract && abstract.trim().length > 0) {
    return abstract.trim().length > 160 ? `${abstract.trim().slice(0, 157)}...` : abstract.trim();
  }

  if (!body) {
    return "";
  }

  const text = body
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function getThumbnailUrl(
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

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  campusBackSafeArea: {
    paddingTop: spacing.xs
  },
  screenHeaderRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  backButtonLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary
  },
  header: {
    gap: 3,
    marginBottom: spacing.xs
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  heading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1
  },
  searchIconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  subHeading: {
    fontSize: typography.body,
    fontWeight: "500",
    color: colors.textSecondary
  },
  metaText: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  },
  noticeHeroWrap: {
    gap: spacing.xs
  },
  noticeHeroButton: {
    width: "100%",
    borderRadius: radius.lg,
    backgroundColor: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0b1e38",
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  noticeHeroButtonDisabled: {
    opacity: 0.45
  },
  noticeHeroButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  noticeHeroButtonLabel: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: "700"
  },
  noticeHeroHelper: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  noticeCategoryFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  noticeCategoryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    opacity: 0.8
  },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.surface,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  filterChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  filterChipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textPrimary
  },
  filterChipLabelSelected: {
    color: "#f8fafc"
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  alumniSheetFrame: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "#b29872",
    backgroundColor: "#e6d8be",
    padding: 4,
    shadowColor: "#6b5538",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4
  },
  alumniSheetPaper: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(120,95,61,0.36)",
    backgroundColor: "#f7efdf",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm
  },
  alumniHeaderBand: {
    gap: 4,
    paddingTop: 2,
    paddingBottom: spacing.sm
  },
  alumniHeaderRuleStrong: {
    height: 1,
    backgroundColor: "rgba(114,88,56,0.42)"
  },
  alumniHeaderRuleSoft: {
    height: 1,
    backgroundColor: "rgba(143,117,84,0.22)"
  },
  alumniBodyWrap: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs
  },
  alumniTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4a3722",
    letterSpacing: 0.3,
    lineHeight: 23
  },
  alumniParagraphRule: {
    height: 1,
    backgroundColor: "rgba(133,106,73,0.26)",
    marginVertical: 2
  },
  alumniBody: {
    fontSize: 13,
    lineHeight: 21,
    color: "#59452e"
  },
  alumniEmptyWrap: {
    borderWidth: 1,
    borderColor: "rgba(138,112,74,0.18)",
    backgroundColor: "rgba(255,255,255,0.34)",
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  alumniFooterBand: {
    paddingTop: spacing.md
  },
  alumniFooterRule: {
    height: 1,
    backgroundColor: "rgba(114,88,56,0.32)"
  },
  campusRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  campusCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.xs
  },
  campusCardImagePlaceholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.sm,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs
  },
  campusCardLabel: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postCard: {
    flexDirection: "row",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  postThumbnail: {
    width: 96,
    height: 96,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted
  },
  postContent: {
    flex: 1,
    gap: 4
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postMeta: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  postAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  postAuthorButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  postAuthorName: {
    flexShrink: 1,
    fontSize: typography.caption,
    color: colors.textSecondary
  },
  postEngagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  postEngagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  postPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 19
  },  campusCardImage: {
    width: "100%",
    height: "100%"
  }
});
