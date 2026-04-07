import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import { Link, useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent
} from "react-native-gesture-handler";
import { PUBLIC_WEB_LINKS } from "../../src/config/public-links";
import { deleteMyAccount } from "../../src/features/auth/account-deletion.service";
import { mapAuthError } from "../../src/features/auth/auth.service";
import { useAuthSession } from "../../src/features/auth/auth-session";
import { useAppLanguage } from "../../src/features/language/app-language";
import { supabase } from "../../src/lib/supabase/client";
import { CityHeroHeader } from "../../src/ui/city-hero-header";
import { TierMarker, normalizeTierForDisplay, resolveTierMarkerValue } from "../../src/ui/tier-marker";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

type VerifiedUniversitySummary = {
  name: string;
  shortName: string | null;
};

type FeedbackDraft = {
  email: string;
  subject: string;
  body: string;
};

type MyPostPreview = {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
};

type SelectedProfileImage = {
  localUri: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
};

const PROFILE_IMAGES_BUCKET = "post-images";
const PROFILE_IMAGE_CACHE_CONTROL_SECONDS = "31536000";
const MOOD_CARD_BACKGROUND_ASPECT_RATIO = 1.1;
const AVATAR_CROP_FRAME_WIDTH = 260;
const AVATAR_CROP_FRAME_HEIGHT = 260;
const BACKGROUND_CROP_FRAME_WIDTH = 264;
const BACKGROUND_CROP_FRAME_HEIGHT = Math.round(
  BACKGROUND_CROP_FRAME_WIDTH / MOOD_CARD_BACKGROUND_ASPECT_RATIO
);
const PROFILE_CROP_MIN_ZOOM = 1;
const PROFILE_CROP_MAX_ZOOM = 3.5;
const AVATAR_UPLOAD_MAX_LONG_EDGE = 1080;
const BACKGROUND_UPLOAD_MAX_LONG_EDGE = 1600;
const SETTINGS_SHEET_MAX_HEIGHT = Math.round(Dimensions.get("window").height * 0.62);
const SETTINGS_SCROLL_MAX_HEIGHT = Math.round(Dimensions.get("window").height * 0.36);
type CropTarget = "avatar" | "background";

type CropFramePreset = {
  width: number;
  height: number;
  borderRadius: number;
  hint: string;
};

type CropOffset = {
  x: number;
  y: number;
};

type CropMetrics = {
  frameWidth: number;
  frameHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  maxOffsetX: number;
  maxOffsetY: number;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function inferProfileImageExtension(image: SelectedProfileImage): string {
  const fromName = image.fileName.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) {
    return fromName;
  }

  const fromMime = image.mimeType.split("/").pop()?.toLowerCase();
  if (fromMime) {
    if (fromMime === "jpeg") {
      return "jpg";
    }

    return fromMime;
  }

  return "jpg";
}

function createProfileImageStoragePath(
  userId: string,
  image: SelectedProfileImage,
  kind: CropTarget
): string {
  const safeUserId = sanitizeSegment(userId);
  const extension = inferProfileImageExtension(image);
  const folder = kind === "background" ? "backgrounds" : "avatars";
  return `${safeUserId}/${folder}/${Date.now()}.${extension}`;
}

function toSelectedProfileImage(asset: ImagePicker.ImagePickerAsset): SelectedProfileImage {
  const fallbackName = `avatar-${Date.now()}.jpg`;
  const width = typeof asset.width === "number" && asset.width > 0 ? asset.width : 1;
  const height = typeof asset.height === "number" && asset.height > 0 ? asset.height : 1;

  return {
    localUri: asset.uri,
    fileName: asset.fileName ?? fallbackName,
    mimeType: asset.mimeType ?? "image/jpeg",
    width,
    height
  };
}

async function readSelectedProfileImage(image: SelectedProfileImage): Promise<ArrayBuffer | Blob> {
  if (Platform.OS === "web") {
    const response = await fetch(image.localUri);
    if (!response.ok) {
      throw new Error("선택한 이미지를 읽을 수 없습니다.");
    }

    return await response.blob();
  }

  const base64 = await FileSystem.readAsStringAsync(image.localUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  return decode(base64);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildCropMetrics(
  image: SelectedProfileImage,
  zoom: number,
  frameWidth: number,
  frameHeight: number
): CropMetrics {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const baseScale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const renderedWidth = sourceWidth * baseScale * zoom;
  const renderedHeight = sourceHeight * baseScale * zoom;
  const maxOffsetX = Math.max((renderedWidth - frameWidth) / 2, 0);
  const maxOffsetY = Math.max((renderedHeight - frameHeight) / 2, 0);

  return {
    frameWidth,
    frameHeight,
    sourceWidth,
    sourceHeight,
    renderedWidth,
    renderedHeight,
    maxOffsetX,
    maxOffsetY
  };
}

function clampCropOffset(offset: CropOffset, metrics: CropMetrics): CropOffset {
  return {
    x: clamp(offset.x, -metrics.maxOffsetX, metrics.maxOffsetX),
    y: clamp(offset.y, -metrics.maxOffsetY, metrics.maxOffsetY)
  };
}

function getCropRect(metrics: CropMetrics, offset: CropOffset) {
  const left = (metrics.frameWidth - metrics.renderedWidth) / 2 + offset.x;
  const top = (metrics.frameHeight - metrics.renderedHeight) / 2 + offset.y;
  const widthInSource = (metrics.frameWidth / metrics.renderedWidth) * metrics.sourceWidth;
  const heightInSource = (metrics.frameHeight / metrics.renderedHeight) * metrics.sourceHeight;
  const originX = clamp((-left / metrics.renderedWidth) * metrics.sourceWidth, 0, metrics.sourceWidth - 1);
  const originY = clamp((-top / metrics.renderedHeight) * metrics.sourceHeight, 0, metrics.sourceHeight - 1);
  const cropWidth = clamp(widthInSource, 1, metrics.sourceWidth - originX);
  const cropHeight = clamp(heightInSource, 1, metrics.sourceHeight - originY);

  return {
    originX: Math.round(originX),
    originY: Math.round(originY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };
}

function getResizeDimensionsForMaxLongEdge(params: {
  width: number;
  height: number;
  maxLongEdge: number;
}): { width: number; height: number } | null {
  const { width, height, maxLongEdge } = params;
  const longEdge = Math.max(width, height);

  if (longEdge <= maxLongEdge) {
    return null;
  }

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function getUserNameFromSession(auth: ReturnType<typeof useAuthSession>): string {
  return (
    auth.user?.profile?.display_name ??
    (typeof auth.user?.authUser.user_metadata?.display_name === "string"
      ? auth.user.authUser.user_metadata.display_name
      : null) ??
    "-"
  );
}

function getDeviceLabel(): string {
  if (Platform.OS === "web") {
    return globalThis.navigator?.userAgent ?? "Web Browser";
  }

  if (Platform.OS === "ios") {
    return "iPhone / iOS Device";
  }

  if (Platform.OS === "android") {
    return "Android Device";
  }

  return `${Platform.OS} Device`;
}

function stripBodyPreview(body: string): string {
  if (!body) {
    return "";
  }

  return body
    .replace(/<img\s+[^>]*>/gi, " ")
    .replace(/<\/?p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

type BronzeQuota = {
  remainingQuestions: number;
  remainingComments: number;
};

function getShanghaiDayUtcRange(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "01");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "01");

  const startUtc = new Date(Date.UTC(year, month - 1, day, -8, 0, 0, 0));
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  return {
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
    endUtc
  };
}

async function fetchBronzeQuota(): Promise<BronzeQuota> {
  const rpcClient = supabase as typeof supabase & {
    rpc: (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const { data, error } = await rpcClient.rpc("get_my_bronze_quota");

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { remaining_questions?: unknown; remaining_comments?: unknown }
    | null
    | undefined;

  const remainingQuestions =
    typeof row?.remaining_questions === "number" ? row.remaining_questions : 1;
  const remainingComments =
    typeof row?.remaining_comments === "number" ? row.remaining_comments : 5;

  return {
    remainingQuestions,
    remainingComments
  };
}

function getTierAccent(tierValue: string) {
  const normalized = tierValue.trim().toLowerCase();

  if (normalized === "bronze") {
    return {
      borderColor: "#8a5a2b",
      labelColor: "#7a4d24",
      valueColor: "#5f3816"
    };
  }

  if (normalized === "silver") {
    return {
      borderColor: "#7b8794",
      labelColor: "#66707a",
      valueColor: "#4b5560"
    };
  }

  if (normalized === "gold") {
    return {
      borderColor: "#a87b12",
      labelColor: "#8f6810",
      valueColor: "#6f4f0c"
    };
  }

  if (normalized === "emerald") {
    return {
      borderColor: "#1f7a5a",
      labelColor: "#176148",
      valueColor: "#124d3a"
    };
  }

  if (normalized === "platinum" || normalized === "diamond") {
    return {
      borderColor: "#355c9a",
      labelColor: "#2f538a",
      valueColor: "#233f69"
    };
  }

  if (normalized === "master") {
    return {
      borderColor: "#5f3dc4",
      labelColor: "#5335ad",
      valueColor: "#41288a"
    };
  }

  if (normalized === "grandmaster") {
    return {
      borderColor: "#8f1f1f",
      labelColor: "#7a1a1a",
      valueColor: "#5f1414"
    };
  }

  if (normalized === "church_master") {
    return {
      borderColor: "#1f7a4f",
      labelColor: "#18623f",
      valueColor: "#124d31"
    };
  }

  return {
    borderColor: colors.border,
    labelColor: colors.textMuted,
    valueColor: colors.textPrimary
  };
}

function TierSummaryCard({ value }: { value: string }) {
  const accent = getTierAccent(value);
  const displayValue = value.replace(/_/g, " ");

  return (
    <View style={[styles.summaryMiniCard, styles.tierSummaryCard, { borderColor: accent.borderColor }]}>
      <Text
        style={[
          styles.summaryLabel,
          {
            color: accent.labelColor
          }
        ]}
      >
        Tier
      </Text>
      <Text
        style={[
          styles.summaryValue,
          styles.tierSummaryValue,
          {
            color: accent.valueColor
          }
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.86}
        ellipsizeMode="tail"
      >
        {displayValue}
      </Text>
    </View>
  );
}

function BronzeTokenCard({
  remainingQuestions,
  remainingComments
}: {
  remainingQuestions: number;
  remainingComments: number;
}) {
  return (
    <View style={styles.summaryMiniCard}>
      <Text style={styles.summaryLabel}>Token</Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 10,
          lineHeight: 12,
          color: colors.textMuted
        }}
      >
        남은 질문 {remainingQuestions}개{"\n"}남은 답글 {remainingComments}개
      </Text>
    </View>
  );
}

export default function MeScreen() {
  const auth = useAuthSession();
  const { languageMode, resolvedLanguage, setLanguageMode } = useAppLanguage();
  const [localError, setLocalError] = useState<string | null>(null);
  const [verifiedUniversity, setVerifiedUniversity] = useState<VerifiedUniversitySummary | null>(null);
  const [isLoadingUniversity, setIsLoadingUniversity] = useState(false);
  const [universityError, setUniversityError] = useState<string | null>(null);

  const [myPosts, setMyPosts] = useState<MyPostPreview[]>([]);
  const [isLoadingMyPosts, setIsLoadingMyPosts] = useState(false);
  const [myPostsError, setMyPostsError] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [bronzeQuota, setBronzeQuota] = useState<BronzeQuota | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMyInfoOpen, setIsMyInfoOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [pendingSettingsModal, setPendingSettingsModal] = useState<"myInfo" | "profile" | null>(null);
  const [profileModalStep, setProfileModalStep] = useState<"form" | "crop">("form");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isPrivateProfile, setIsPrivateProfile] = useState(false);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null);
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null>(null);
  const [profileBackgroundUrlOverride, setProfileBackgroundUrlOverride] = useState<string | null>(null);
  const [selectedProfileImage, setSelectedProfileImage] = useState<SelectedProfileImage | null>(null);
  const [selectedProfileBackgroundImage, setSelectedProfileBackgroundImage] =
    useState<SelectedProfileImage | null>(null);
  const [isProfileBackgroundImageLoaded, setIsProfileBackgroundImageLoaded] = useState(false);
  const [isAvatarImageLoaded, setIsAvatarImageLoaded] = useState(false);
  const [isProfilePreviewImageLoaded, setIsProfilePreviewImageLoaded] = useState(false);
  const [isBackgroundPreviewImageLoaded, setIsBackgroundPreviewImageLoaded] = useState(false);
  const [cropSourceImage, setCropSourceImage] = useState<SelectedProfileImage | null>(null);
  const [cropTarget, setCropTarget] = useState<CropTarget>("avatar");
  const [cropZoom, setCropZoom] = useState<number>(PROFILE_CROP_MIN_ZOOM);
  const [cropOffset, setCropOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft | null>(null);
  const [isFeedbackFallbackOpen, setIsFeedbackFallbackOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const isKo = resolvedLanguage === "ko";

  const isSigningOut = auth.action === "signing_out";
  const authUserId = auth.user?.authUser.id ?? null;

  async function onSignOut() {
    if (isSigningOut) {
      return;
    }

    setLocalError(null);

    try {
      await auth.signOut();
    } catch (error) {
      setLocalError(mapAuthError(error));
    }
  }

  const sessionDisplayName = getUserNameFromSession(auth);
  const displayName = displayNameOverride ?? sessionDisplayName;
  const metadataAvatarUrl =
    typeof auth.user?.authUser.user_metadata?.avatar_url === "string"
      ? auth.user.authUser.user_metadata.avatar_url
      : null;
  const metadataProfileBackgroundUrl =
    typeof auth.user?.authUser.user_metadata?.profile_background_url === "string"
      ? auth.user.authUser.user_metadata.profile_background_url
      : typeof auth.user?.authUser.user_metadata?.background_url === "string"
        ? auth.user.authUser.user_metadata.background_url
        : null;
  const profileAvatarUrl =
    avatarUrlOverride ?? auth.user?.profile?.avatar_url ?? metadataAvatarUrl ?? null;
  const profileBackgroundUrl = profileBackgroundUrlOverride ?? metadataProfileBackgroundUrl ?? null;
  const profileHeroBackgroundImageUri =
    selectedProfileBackgroundImage?.localUri ?? profileBackgroundUrl ?? null;
  const profileHeroAvatarImageUri = profileAvatarUrl;
  const profileModalAvatarPreviewUri =
    selectedProfileImage?.localUri ?? profileAvatarUrl ?? null;
  const profileModalBackgroundPreviewUri =
    selectedProfileBackgroundImage?.localUri ?? profileBackgroundUrl ?? null;

  const email = auth.user?.authUser.email ?? "-";
  const role = auth.user?.profile?.role ?? "-";
  const tier = auth.user?.profile?.tier ?? null;
  const points = typeof auth.user?.profile?.points === "number" ? auth.user.profile.points : 0;
  const verifiedSchoolEmail = auth.user?.profile?.verified_school_email ?? null;
  const verifiedUniversityId = auth.user?.profile?.verified_university_id ?? null;
  const isSchoolVerified = Boolean(verifiedSchoolEmail && verifiedUniversityId);
  const metadataPrivateProfile = auth.user?.authUser.user_metadata?.private_profile === true;
  const profilePrivacyFromSession =
    ((auth.user?.profile as (Record<string, unknown> & { is_private_profile?: unknown }) | null)
      ?.is_private_profile === true) ||
    metadataPrivateProfile;

  const effectiveTier = useMemo(() => {
    const roleTier = resolveTierMarkerValue(role, role);
    if (roleTier) {
      return roleTier;
    }

    if (tier) {
      return tier;
    }

    return "bronze";
  }, [role, tier]);
  const canonicalTier = normalizeTierForDisplay(effectiveTier);
  const isBronzeTier = canonicalTier === "bronze";

  const loadBronzeQuota = useCallback(async () => {
    if (!authUserId || !isBronzeTier) {
      setBronzeQuota(null);
      return;
    }

    try {
      const quota = await fetchBronzeQuota();
      setBronzeQuota(quota);
    } catch (error) {
      setBronzeQuota({
        remainingQuestions: 1,
        remainingComments: 5
      });
    }
  }, [authUserId, isBronzeTier]);

  const avatarLetter = useMemo(() => {
    const base = displayName !== "-" ? displayName : email;
    return base.trim().charAt(0).toUpperCase() || "U";
  }, [displayName, email]);
  const cropDragStartRef = useRef<CropOffset>({ x: 0, y: 0 });
  const cropPreset = useMemo<CropFramePreset>(() => {
    if (cropTarget === "background") {
      return {
        width: BACKGROUND_CROP_FRAME_WIDTH,
        height: BACKGROUND_CROP_FRAME_HEIGHT,
        borderRadius: radius.md,
        hint: "무드 카드 프레임에서 이미지를 드래그하고 확대/축소한 뒤 적용하세요."
      };
    }

    return {
      width: AVATAR_CROP_FRAME_WIDTH,
      height: AVATAR_CROP_FRAME_HEIGHT,
      borderRadius: radius.pill,
      hint: "원형 프레임에서 이미지를 드래그하고 확대/축소한 뒤 적용하세요."
    };
  }, [cropTarget]);

  const cropMetrics = useMemo(() => {
    if (!cropSourceImage) {
      return null;
    }

    return buildCropMetrics(cropSourceImage, cropZoom, cropPreset.width, cropPreset.height);
  }, [cropPreset.height, cropPreset.width, cropSourceImage, cropZoom]);

  const onCropGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (!cropMetrics) {
        return;
      }

      const { translationX, translationY } = event.nativeEvent;
      const nextOffset = clampCropOffset(
        {
          x: cropDragStartRef.current.x + translationX,
          y: cropDragStartRef.current.y + translationY
        },
        cropMetrics
      );

      setCropOffset(nextOffset);
    },
    [cropMetrics]
  );

  const onCropHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      const { state } = event.nativeEvent;

      if (state === State.BEGAN) {
        cropDragStartRef.current = cropOffset;
      }

      if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
        cropDragStartRef.current = cropOffset;
      }
    },
    [cropOffset]
  );

  useEffect(() => {
    setProfileNameDraft(displayName !== "-" ? displayName : "");
  }, [displayName]);

  useEffect(() => {
    if (profileAvatarUrl) {
      void Image.prefetch(profileAvatarUrl);
    }
  }, [profileAvatarUrl]);

  useEffect(() => {
    if (profileBackgroundUrl) {
      void Image.prefetch(profileBackgroundUrl);
    }
  }, [profileBackgroundUrl]);

  useEffect(() => {
    setIsProfileBackgroundImageLoaded(profileHeroBackgroundImageUri ? false : true);
  }, [profileHeroBackgroundImageUri]);

  useEffect(() => {
    setIsAvatarImageLoaded(profileHeroAvatarImageUri ? false : true);
  }, [profileHeroAvatarImageUri]);

  useEffect(() => {
    setIsProfilePreviewImageLoaded(profileModalAvatarPreviewUri ? false : true);
  }, [profileModalAvatarPreviewUri]);

  useEffect(() => {
    setIsBackgroundPreviewImageLoaded(profileModalBackgroundPreviewUri ? false : true);
  }, [profileModalBackgroundPreviewUri]);

  useEffect(() => {
    setIsPrivateProfile(profilePrivacyFromSession);
  }, [profilePrivacyFromSession]);

  useEffect(() => {
    let cancelled = false;

    async function loadVerifiedUniversity() {
      setVerifiedUniversity(null);
      setUniversityError(null);

      if (!verifiedUniversityId) {
        return;
      }

      setIsLoadingUniversity(true);

      const { data, error } = await supabase
        .from("universities")
        .select("name:name_ko, short_name")
        .eq("id", verifiedUniversityId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        setUniversityError(error.message);
        setIsLoadingUniversity(false);
        return;
      }

      const universityRow = data as unknown as {
        name: string | null;
        short_name: string | null;
      } | null;

      setVerifiedUniversity(
        universityRow
          ? {
              name: universityRow.name ?? "University",
              shortName: universityRow.short_name ?? null
            }
          : null
      );
      setIsLoadingUniversity(false);
    }

    void loadVerifiedUniversity();

    return () => {
      cancelled = true;
    };
  }, [verifiedUniversityId]);

  const loadMyPosts = useCallback(async () => {
    setMyPostsError(null);
    setMyPosts([]);

    if (!authUserId) {
      return;
    }

    setIsLoadingMyPosts(true);

    const { data, error } = await supabase
      .from("posts")
      .select("id, title, body, created_at, like_count, comment_count, view_count")
      .eq("author_id", authUserId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      setMyPostsError(error.message);
      setIsLoadingMyPosts(false);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: number;
      title: string;
      body: string;
      created_at: string;
      like_count: number | null;
      comment_count: number | null;
      view_count: number | null;
    }>;

    setMyPosts(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        likeCount: row.like_count ?? 0,
        commentCount: row.comment_count ?? 0,
        viewCount: row.view_count ?? 0
      }))
    );
    setIsLoadingMyPosts(false);
  }, [authUserId]);

  const loadFollowerCount = useCallback(async () => {
    if (!authUserId) {
      setFollowerCount(0);
      return;
    }

    const tableClient = supabase as unknown as {
      from: (table: string) => {
        select: (query: string, options?: Record<string, unknown>) => any;
      };
    };

    const { count, error } = await tableClient
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", authUserId);

    if (error) {
      setFollowerCount(0);
      return;
    }

    setFollowerCount(typeof count === "number" ? count : 0);
  }, [authUserId]);

  useEffect(() => {
    void loadMyPosts();
  }, [loadMyPosts]);

  useEffect(() => {
    if (isSettingsOpen || !pendingSettingsModal) {
      return;
    }

    const timer = setTimeout(() => {
      if (pendingSettingsModal === "myInfo") {
        setIsMyInfoOpen(true);
      } else if (pendingSettingsModal === "profile") {
        setProfileModalStep("form");
        setIsProfileOpen(true);
      }
      setPendingSettingsModal(null);
    }, 180);

    return () => clearTimeout(timer);
  }, [isSettingsOpen, pendingSettingsModal]);

  useFocusEffect(
    useCallback(() => {
      void loadMyPosts();
      void loadBronzeQuota();
      void loadFollowerCount();
    }, [loadBronzeQuota, loadFollowerCount, loadMyPosts])
  );

  useEffect(() => {
    void loadFollowerCount();
  }, [loadFollowerCount]);

  useEffect(() => {
    if (!authUserId || !isBronzeTier) {
      setBronzeQuota(null);
      return;
    }

    void loadBronzeQuota();

    const { endUtc } = getShanghaiDayUtcRange();
    const delay = Math.max(1000, endUtc.getTime() - Date.now() + 1000);

    const timer = setTimeout(() => {
      void loadBronzeQuota();
    }, delay);

    return () => clearTimeout(timer);
  }, [authUserId, isBronzeTier, loadBronzeQuota]);

  function buildFeedbackDraft(): FeedbackDraft {
    const userNameValue = displayName !== "-" ? displayName : "";
    const universityValue =
      verifiedUniversity?.shortName ?? verifiedUniversity?.name ?? (verifiedUniversityId ?? "");
    const osValue = `${Platform.OS} ${String(Platform.Version ?? "")}`;
    const deviceValue = getDeviceLabel();

    return {
      email: "lucl.service@gmail.com",
      subject: "[LUCL] Feedback",
      body: [
        "",
        "",
        "---",
        "App Version : 20260314",
        `Device: ${deviceValue}`,
        `OS: ${osValue}`,
        `User Name : ${userNameValue}`,
        `University: ${universityValue}`,
        "---"
      ].join("\n")
    };
  }

  async function openFeedbackEmail() {
    setLocalError(null);

    const draft = buildFeedbackDraft();
    setFeedbackDraft(draft);

    try {
      const mailtoUrl =
        `mailto:${draft.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;

      const canOpen = await Linking.canOpenURL(mailtoUrl).catch(() => false);

      if (!canOpen) {
        setIsFeedbackFallbackOpen(true);
        return;
      }

      await Linking.openURL(mailtoUrl);
      setIsSettingsOpen(false);
    } catch {
      setIsFeedbackFallbackOpen(true);
    }
  }

  async function openPublicPage(url: string) {
    setLocalError(null);

    try {
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (!canOpen) {
        setLocalError(
          isKo
            ? "링크를 열 수 없습니다. 브라우저에서 직접 접속해주세요."
            : "Unable to open the link. Please open it directly in your browser."
        );
        return;
      }

      await Linking.openURL(url);
      setIsSettingsOpen(false);
    } catch {
      setLocalError(
        isKo
          ? "링크를 열 수 없습니다. 브라우저에서 직접 접속해주세요."
          : "Unable to open the link. Please open it directly in your browser."
      );
    }
  }

  async function confirmDeleteAccount() {
    if (isDeletingAccount) {
      return;
    }

    setLocalError(null);
    setIsDeletingAccount(true);

    try {
      await deleteMyAccount();
      setIsSettingsOpen(false);
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    } catch (error) {
      setLocalError(toErrorMessage(error, isKo ? "계정 삭제에 실패했습니다." : "Failed to delete account."));
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function saveProfileSettings() {
    if (!auth.user?.authUser) {
      return;
    }

    setLocalError(null);
    setIsSavingProfile(true);

    try {
      const nextName = profileNameDraft.trim();
      let nextAvatarUrl = profileAvatarUrl;
      let nextProfileBackgroundUrl = profileBackgroundUrl;

      if (selectedProfileImage) {
        const profileImageData = await readSelectedProfileImage(selectedProfileImage);
        const storagePath = createProfileImageStoragePath(
          auth.user.authUser.id,
          selectedProfileImage,
          "avatar"
        );

        const uploadResult = await supabase.storage
          .from(PROFILE_IMAGES_BUCKET)
          .upload(storagePath, profileImageData, {
            contentType: selectedProfileImage.mimeType,
            cacheControl: PROFILE_IMAGE_CACHE_CONTROL_SECONDS,
            upsert: false
          });

        if (uploadResult.error) {
          throw uploadResult.error;
        }

        const publicUrlResult = supabase.storage
          .from(PROFILE_IMAGES_BUCKET)
          .getPublicUrl(storagePath);
        nextAvatarUrl = publicUrlResult.data.publicUrl;
      }

      if (selectedProfileBackgroundImage) {
        const backgroundImageData = await readSelectedProfileImage(selectedProfileBackgroundImage);
        const storagePath = createProfileImageStoragePath(
          auth.user.authUser.id,
          selectedProfileBackgroundImage,
          "background"
        );

        const uploadResult = await supabase.storage
          .from(PROFILE_IMAGES_BUCKET)
          .upload(storagePath, backgroundImageData, {
            contentType: selectedProfileBackgroundImage.mimeType,
            cacheControl: PROFILE_IMAGE_CACHE_CONTROL_SECONDS,
            upsert: false
          });

        if (uploadResult.error) {
          throw uploadResult.error;
        }

        const publicUrlResult = supabase.storage
          .from(PROFILE_IMAGES_BUCKET)
          .getPublicUrl(storagePath);
        nextProfileBackgroundUrl = publicUrlResult.data.publicUrl;
      }

      const normalizedCurrentName = sessionDisplayName === "-" ? "" : sessionDisplayName.trim();
      const normalizedNextName = nextName;
      const normalizedCurrentAvatarUrl = metadataAvatarUrl ?? auth.user?.profile?.avatar_url ?? null;
      const normalizedCurrentBackgroundUrl = metadataProfileBackgroundUrl ?? null;
      const shouldUpdateAuthMetadata =
        normalizedNextName !== normalizedCurrentName ||
        nextAvatarUrl !== normalizedCurrentAvatarUrl ||
        nextProfileBackgroundUrl !== normalizedCurrentBackgroundUrl;

      if (shouldUpdateAuthMetadata) {
        const result = await supabase.auth.updateUser({
          data: {
            display_name: normalizedNextName || null,
            avatar_url: nextAvatarUrl ?? null,
            profile_background_url: nextProfileBackgroundUrl ?? null
          }
        });

        if (result.error) {
          throw result.error;
        }
      }

      const tableClient = supabase as unknown as {
        from: (table: string) => {
          select: (query: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
            };
          };
          update: (payload: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };

      const { data: profileRow } = await tableClient
        .from("user_profiles")
        .select("*")
        .eq("id", auth.user.authUser.id)
        .maybeSingle();

      if (profileRow) {
        const profileUpdatePayload: Record<string, unknown> = {};
        if ("display_name" in profileRow) {
          profileUpdatePayload.display_name = normalizedNextName || sessionDisplayName || "-";
        }
        if ("avatar_url" in profileRow) {
          profileUpdatePayload.avatar_url = nextAvatarUrl ?? null;
        }
        if ("profile_background_url" in profileRow) {
          profileUpdatePayload.profile_background_url = nextProfileBackgroundUrl ?? null;
        }
        if ("background_url" in profileRow) {
          profileUpdatePayload.background_url = nextProfileBackgroundUrl ?? null;
        }

        if (Object.keys(profileUpdatePayload).length > 0) {
          const { error: profileUpdateError } = await tableClient
            .from("user_profiles")
            .update(profileUpdatePayload)
            .eq("id", auth.user.authUser.id);

          if (profileUpdateError) {
            throw new Error(profileUpdateError.message);
          }
        }
      }

      setDisplayNameOverride(nextName || "-");
      setAvatarUrlOverride(nextAvatarUrl);
      setProfileBackgroundUrlOverride(nextProfileBackgroundUrl);
      setSelectedProfileImage(null);
      setSelectedProfileBackgroundImage(null);
      setIsProfileOpen(false);
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("[saveProfileSettings] failed:", error);
      setLocalError(mapAuthError(error));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function saveProfilePrivacy(nextValue: boolean) {
    if (!authUserId || isSavingPrivacy) {
      return;
    }

    setLocalError(null);
    setIsSavingPrivacy(true);
    setIsPrivateProfile(nextValue);

    try {
      const tableClient = supabase as unknown as {
        from: (table: string) => {
          select: (query: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
            };
          };
          update: (payload: Record<string, unknown>) => {
            eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };

      const { data: profileRow } = await tableClient
        .from("user_profiles")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      const privacyColumn = profileRow
        ? (["is_private_profile", "is_private", "private_profile"].find((key) => key in profileRow) ?? null)
        : null;

      if (privacyColumn) {
        const { error: profileError } = await tableClient
          .from("user_profiles")
          .update({ [privacyColumn]: nextValue })
          .eq("id", authUserId);

        if (profileError) {
          throw new Error(profileError.message);
        }
      }

      const metadataResult = await supabase.auth.updateUser({
        data: {
          private_profile: nextValue
        }
      });

      if (metadataResult.error) {
        throw metadataResult.error;
      }
    } catch (error) {
      setIsPrivateProfile((current) => !current);
      setLocalError(mapAuthError(error));
    } finally {
      setIsSavingPrivacy(false);
    }
  }

  async function pickImageForCrop(target: CropTarget) {
    setLocalError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLocalError("갤러리 권한이 필요합니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
      allowsMultipleSelection: false
    });

    if (result.canceled) {
      return;
    }

    const selected = result.assets[0];
    if (!selected) {
      return;
    }

    const nextImage = toSelectedProfileImage(selected);
    setCropTarget(target);
    setCropSourceImage(nextImage);
    setCropZoom(PROFILE_CROP_MIN_ZOOM);
    setCropOffset({ x: 0, y: 0 });
    setProfileModalStep("crop");
  }

  async function pickProfileImage() {
    await pickImageForCrop("avatar");
  }

  async function pickProfileBackgroundImage() {
    await pickImageForCrop("background");
  }

  function updateCropZoom(nextZoom: number) {
    if (!cropSourceImage) {
      return;
    }

    const safeZoom = clamp(nextZoom, PROFILE_CROP_MIN_ZOOM, PROFILE_CROP_MAX_ZOOM);
    const nextMetrics = buildCropMetrics(
      cropSourceImage,
      safeZoom,
      cropPreset.width,
      cropPreset.height
    );
    setCropOffset((previous) => clampCropOffset(previous, nextMetrics));
    setCropZoom(safeZoom);
  }

  function resetCropEditor() {
    setCropSourceImage(null);
    setCropTarget("avatar");
    setCropZoom(PROFILE_CROP_MIN_ZOOM);
    setCropOffset({ x: 0, y: 0 });
  }

  function closeProfileModal() {
    if (isSavingProfile || isApplyingCrop) {
      return;
    }

    setProfileModalStep("form");
    resetCropEditor();
    setIsProfileOpen(false);
  }

  function backToProfileForm() {
    if (isApplyingCrop) {
      return;
    }

    setProfileModalStep("form");
    resetCropEditor();
  }

  async function applyCropAndUseImage() {
    if (!cropSourceImage || !cropMetrics) {
      return;
    }

    setLocalError(null);
    setIsApplyingCrop(true);

    try {
      const safeOffset = clampCropOffset(cropOffset, cropMetrics);
      const cropRect = getCropRect(cropMetrics, safeOffset);
      const maxLongEdge =
        cropTarget === "background" ? BACKGROUND_UPLOAD_MAX_LONG_EDGE : AVATAR_UPLOAD_MAX_LONG_EDGE;
      const resize = getResizeDimensionsForMaxLongEdge({
        width: cropRect.width,
        height: cropRect.height,
        maxLongEdge
      });
      const actions: Array<
        | { crop: { originX: number; originY: number; width: number; height: number } }
        | { resize: { width: number; height: number } }
      > = [{ crop: cropRect }];

      if (resize) {
        actions.push({ resize });
      }

      const result = await manipulateAsync(
        cropSourceImage.localUri,
        actions,
        { compress: 0.92, format: SaveFormat.JPEG }
      );

      if (cropTarget === "background") {
        setSelectedProfileBackgroundImage({
          localUri: result.uri,
          fileName: `background-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          width: result.width,
          height: result.height
        });
      } else {
        setSelectedProfileImage({
          localUri: result.uri,
          fileName: `avatar-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          width: result.width,
          height: result.height
        });
      }
      setProfileModalStep("form");
      resetCropEditor();
    } catch (error) {
      if (error instanceof Error && error.message) {
        setLocalError(error.message);
      } else {
        setLocalError("이미지 크롭에 실패했습니다.");
      }
    } finally {
      setIsApplyingCrop(false);
    }
  }

  if (auth.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <CityHeroHeader
          title="My"
          height={164}
          imageOffsetY={-10}
          contentOffsetY={8}
        />
        <View style={styles.centeredBody}>
          <Text style={styles.helperText}>Loading account state...</Text>
        </View>
      </View>
    );
  }

  if (!auth.isSignedIn || !auth.user) {
    return (
      <View style={styles.centeredContainer}>
        <CityHeroHeader
          title="My"
          height={164}
          imageOffsetY={-10}
          contentOffsetY={8}
        />
        <View style={styles.centeredBody}>
          <Text style={styles.helperText}>
            Sign in to view your account and access school verification.
          </Text>
          <Link
            asChild
            href={{
              pathname: "/auth/sign-in",
              params: { redirectTo: "/(tabs)/me" }
            }}
          >
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>Sign In</Text>
            </Pressable>
          </Link>
          <Link
            asChild
            href={{
              pathname: "/auth/sign-up",
              params: { redirectTo: "/(tabs)/me" }
            }}
          >
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>Sign Up</Text>
            </Pressable>
          </Link>
          {auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}
        </View>
      </View>
    );
  }

  const schoolLabel =
    isLoadingUniversity
      ? isKo ? "불러오는 중..." : "Loading..."
      : verifiedUniversity?.shortName ??
        verifiedUniversity?.name ??
        (verifiedUniversityId ? (isKo ? "인증됨" : "Verified") : isKo ? "연결 안 됨" : "Not linked");

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <CityHeroHeader
          title={isKo ? "내 정보" : "My"}
          height={164}
          imageOffsetY={-10}
          contentOffsetY={8}
        />

        <View style={styles.pageBody}>
          <View style={styles.profileHeroStack}>
            <View style={styles.profileBackgroundCard} pointerEvents="none">
              {profileHeroBackgroundImageUri ? (
                <View style={styles.profileBackgroundImageContainer}>
                  {!isProfileBackgroundImageLoaded ? (
                    <View style={styles.imageLoadingOverlay}>
                      <Text style={styles.imageLoadingLabel}>Loading image...</Text>
                    </View>
                  ) : null}
                  <Image
                    source={{ uri: profileHeroBackgroundImageUri }}
                    style={[
                      styles.profileBackgroundImage,
                      !isProfileBackgroundImageLoaded && styles.imageHidden
                    ]}
                    resizeMode="cover"
                    onLoadStart={() => setIsProfileBackgroundImageLoaded(false)}
                    onLoadEnd={() => setIsProfileBackgroundImageLoaded(true)}
                    onError={() => setIsProfileBackgroundImageLoaded(true)}
                  />
                </View>
              ) : (
                <View style={styles.profileBackgroundFallback}>
                  <View style={styles.profileBackgroundFallbackTone} />
                </View>
              )}
            </View>

            <Pressable onPress={() => setIsSettingsOpen(true)} style={styles.settingsHeroButton}>
              <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
            </Pressable>

          <View style={styles.profileOverlayContent}>
            <View style={styles.profileHeroTop}>
              <View style={styles.avatarCircle}>
                {profileHeroAvatarImageUri ? (
                  <>
                    {!isAvatarImageLoaded ? (
                      <View style={styles.avatarLoadingPlaceholder}>
                        <Text style={styles.imageLoadingLabel}>...</Text>
                      </View>
                    ) : null}
                    <Image
                      source={{ uri: profileHeroAvatarImageUri }}
                      style={[styles.avatarImage, !isAvatarImageLoaded && styles.imageHidden]}
                      resizeMode="cover"
                      onLoadStart={() => setIsAvatarImageLoaded(false)}
                      onLoadEnd={() => setIsAvatarImageLoaded(true)}
                      onError={() => setIsAvatarImageLoaded(true)}
                    />
                  </>
                ) : (
                  <Text style={styles.avatarLabel}>{avatarLetter}</Text>
                )}
              </View>
              <View style={styles.profileHeroText}>
                <View style={styles.identityTextCard}>
                  <View style={styles.displayNameRow}>
                    <TierMarker value={canonicalTier} size={28} />
                    <Text style={styles.displayName} numberOfLines={1}>
                      {displayName}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.profileSummaryPrimaryRow}>
              <TierSummaryCard value={canonicalTier} />
              <SummaryCard label="Points" value={String(points)} />
              <SummaryCard label={isKo ? "학교" : "School"} value={schoolLabel} />
              <SummaryCard label={isKo ? "팔로워" : "Followers"} value={String(followerCount)} />
            </View>
            {isBronzeTier ? (
              <View style={styles.bronzeTokenInline}>
                <Text style={styles.bronzeTokenInlineText}>
                  {isKo
                    ? `토큰 질문 ${bronzeQuota?.remainingQuestions ?? 1} · 답글 ${bronzeQuota?.remainingComments ?? 5}`
                    : `Token Questions ${bronzeQuota?.remainingQuestions ?? 1} · Replies ${
                        bronzeQuota?.remainingComments ?? 5
                      }`}
                </Text>
              </View>
            ) : null}
            </View>
          </View>

        <View style={styles.infoCard}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionTitle}>{isKo ? "내가 쓴 글" : "My Posts"}</Text>
            <Link
              asChild
              href={{
                pathname: "/my-posts",
                params: { returnTo: "/me" }
              }}
            >
              <Pressable style={styles.moreButton}>
                <Text style={styles.moreButtonLabel}>{isKo ? "더보기" : "See more"}</Text>
              </Pressable>
            </Link>
          </View>

          {isLoadingMyPosts ? <Text style={styles.helperInlineText}>Loading posts...</Text> : null}
          {myPostsError ? <Text style={styles.errorText}>{myPostsError}</Text> : null}
          {!isLoadingMyPosts && myPosts.length === 0 && !myPostsError ? (
            <Text style={styles.helperInlineText}>
              {isKo ? "아직 작성한 글이 없습니다." : "No posts yet."}
            </Text>
          ) : null}

          {myPosts.map((post) => {
            const preview = stripBodyPreview(post.body);
            return (
              <Link key={post.id} asChild href={`/posts/${post.id}`}>
                <Pressable style={styles.myPostCard}>
                  <Text style={styles.myPostTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  <Text style={styles.myPostDate}>{formatDate(post.createdAt)}</Text>
                  {preview ? (
                    <Text style={styles.myPostPreview} numberOfLines={2}>
                      {preview}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      marginTop: 8
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Ionicons name="heart-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.myPostDate}>{post.likeCount}</Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.myPostDate}>{post.commentCount}</Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.myPostDate}>{isKo ? `조회 ${post.viewCount}` : `Views ${post.viewCount}`}</Text>
                    </View>
                  </View>
                </Pressable>
              </Link>
            );
          })}
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>{isKo ? "작업" : "Actions"}</Text>

          {!isSchoolVerified ? (
            <Link asChild href="/verification/school">
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonLabel}>
                  {isKo ? "학교 인증" : "School Verification"}
                </Text>
              </Pressable>
            </Link>
          ) : (
            <Text style={styles.helperInlineText}>
              {isKo ? "학교 인증이 완료되었습니다." : "Your school verification is complete."}
            </Text>
          )}

          <Pressable
            disabled={isSigningOut}
            onPress={onSignOut}
            style={[styles.secondaryButton, isSigningOut && styles.buttonDisabled]}
          >
            <Text style={styles.secondaryButtonLabel}>
              {isSigningOut ? (isKo ? "로그아웃 중..." : "Signing Out...") : isKo ? "로그아웃" : "Sign Out"}
            </Text>
          </Pressable>
        </View>

        {universityError ? <Text style={styles.errorText}>{universityError}</Text> : null}
        {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
          {!localError && auth.errorMessage ? <Text style={styles.errorText}>{auth.errorMessage}</Text> : null}
        </View>
      </ScrollView>

      <Modal visible={isSettingsOpen} transparent animationType="fade" onRequestClose={() => setIsSettingsOpen(false)}>
        <Pressable style={styles.settingsModalBackdrop} onPress={() => setIsSettingsOpen(false)}>
          <Pressable style={styles.settingsSheet} onPress={() => {}}>
            <View style={styles.settingsSheetHeader}>
              <Text style={styles.settingsSheetTitle}>{isKo ? "설정" : "Settings"}</Text>
              <Pressable
                style={styles.settingsCloseButton}
                onPress={() => setIsSettingsOpen(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.settingsScrollArea}
              contentContainerStyle={styles.settingsScrollContent}
              showsVerticalScrollIndicator
            >
              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  setPendingSettingsModal("myInfo");
                  setIsSettingsOpen(false);
                }}
              >
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="person-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "내 정보" : "My Info"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo
                      ? "프로필 및 학교 인증 정보를 확인합니다."
                      : "Check your profile and school verification info."}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  setPendingSettingsModal("profile");
                  setIsSettingsOpen(false);
                }}
              >
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "프로필 설정" : "Profile Settings"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo ? "사용자명을 변경할 수 있습니다." : "You can change your user name."}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <View style={styles.settingsRow}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "알림" : "Notifications"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo
                      ? "알림을 놓치지 않도록 알림을 허용하세요"
                      : "Allow notifications so you don't miss updates."}
                  </Text>
                </View>
                <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="language-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>Language</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo ? "앱 표시 언어를 선택합니다." : "Choose app display language."}
                  </Text>
                  <View style={styles.languageOptionRow}>
                    <Pressable
                      onPress={() => void setLanguageMode("system")}
                      style={[
                        styles.languageOptionChip,
                        languageMode === "system" && styles.languageOptionChipSelected
                      ]}
                    >
                      <Text
                        style={[
                          styles.languageOptionChipLabel,
                          languageMode === "system" && styles.languageOptionChipLabelSelected
                        ]}
                      >
                        System
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void setLanguageMode("ko")}
                      style={[
                        styles.languageOptionChip,
                        languageMode === "ko" && styles.languageOptionChipSelected
                      ]}
                    >
                      <Text
                        style={[
                          styles.languageOptionChipLabel,
                          languageMode === "ko" && styles.languageOptionChipLabelSelected
                        ]}
                      >
                        한국어
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void setLanguageMode("en")}
                      style={[
                        styles.languageOptionChip,
                        languageMode === "en" && styles.languageOptionChipSelected
                      ]}
                    >
                      <Text
                        style={[
                          styles.languageOptionChipLabel,
                          languageMode === "en" && styles.languageOptionChipLabelSelected
                        ]}
                      >
                        English
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.settingsRow}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "비공개 프로필" : "Private Profile"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo
                      ? "비공개 시 팔로워만 내 프로필을 볼 수 있습니다."
                      : "When private, only followers can view your profile."}
                  </Text>
                </View>
                <Switch
                  value={isPrivateProfile}
                  onValueChange={(value) => {
                    void saveProfilePrivacy(value);
                  }}
                  disabled={isSavingPrivacy}
                />
              </View>
              <Pressable style={styles.settingsRow} onPress={openFeedbackEmail}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "문의하기" : "Contact Us"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo ? "버그 신고 및 기능 요청" : "Report bugs or request features"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  void openPublicPage(PUBLIC_WEB_LINKS.privacy);
                }}
              >
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "개인정보처리방침" : "Privacy Policy"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo ? "웹에서 정책을 확인합니다." : "View the policy on the web."}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  void openPublicPage(PUBLIC_WEB_LINKS.terms);
                }}
              >
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "이용약관" : "Terms of Service"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo ? "서비스 이용약관을 확인합니다." : "Read the service terms."}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  void openPublicPage(PUBLIC_WEB_LINKS.support);
                }}
              >
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="help-circle-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "고객지원" : "Support"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo ? "고객지원 및 문의 페이지를 엽니다." : "Open the support and contact page."}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  void openPublicPage(PUBLIC_WEB_LINKS.deleteAccount);
                }}
              >
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="trash-outline" size={18} color={colors.textPrimary} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsRowTitle}>{isKo ? "계정 삭제 요청" : "Delete Account Request"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo ? "계정 삭제 요청 안내 페이지를 엽니다." : "Open the account deletion request page."}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>

              <Pressable
                style={styles.settingsRow}
                onPress={() => {
                  Alert.alert(
                    isKo ? "계정 삭제 확인" : "Confirm Account Deletion",
                    isKo
                      ? "계정을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?"
                      : "Deleted accounts cannot be recovered. Do you want to continue?",
                    [
                      {
                        text: isKo ? "취소" : "Cancel",
                        style: "cancel"
                      },
                      {
                        text: isKo ? "삭제하기" : "Delete",
                        style: "destructive",
                        onPress: () => {
                          void confirmDeleteAccount();
                        }
                      }
                    ]
                  );
                }}
              >
                <View style={styles.settingsIconWrap}>
                  <Ionicons name="warning-outline" size={18} color={colors.error} />
                </View>
                <View style={styles.settingsRowTextBlock}>
                  <Text style={styles.settingsDangerRowTitle}>{isKo ? "계정 삭제하기" : "Delete Account"}</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    {isKo
                      ? "계정을 복구할 수 없도록 삭제합니다."
                      : "Delete your account permanently and irreversibly."}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isMyInfoOpen} transparent animationType="fade" onRequestClose={() => setIsMyInfoOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsMyInfoOpen(false)}>
          <Pressable style={styles.profileModalCard} onPress={() => {}}>
            <Text style={styles.settingsSheetTitle}>My Info</Text>

            <View style={styles.myInfoCard}>
              <Text style={styles.myInfoTitle}>{isKo ? "프로필 정보" : "Profile Information"}</Text>
              <InfoRow label="User Name" value={displayName} />
              <InfoRow label="Email" value={email} />
              <InfoRow label="Verified Email" value={verifiedSchoolEmail ?? "-"} />
              <InfoRow
                label="Verified University"
                value={
                  isLoadingUniversity
                    ? "Loading..."
                    : verifiedUniversity?.shortName ??
                      verifiedUniversity?.name ??
                      (verifiedUniversityId ?? "-")
                }
              />
              <InfoRow label="School Verified" value={isSchoolVerified ? "Yes" : "No"} />
            </View>

            <View style={styles.profileModalActions}>
              <Pressable style={styles.primaryButtonCompact} onPress={() => setIsMyInfoOpen(false)}>
                <Text style={styles.primaryButtonLabel}>{isKo ? "닫기" : "Close"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={isProfileOpen} transparent animationType="fade" onRequestClose={closeProfileModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeProfileModal}>
          <Pressable style={styles.profileModalCard} onPress={() => {}}>
            <Text style={styles.settingsSheetTitle}>
              {profileModalStep === "crop"
                ? cropTarget === "background"
                  ? "배경 이미지 조절"
                  : "프로필 이미지 조절"
                : "프로필 설정"}
            </Text>

            {profileModalStep === "form" ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>User Name</Text>
                  <TextInput
                    value={profileNameDraft}
                    onChangeText={setProfileNameDraft}
                    placeholder="Enter your user name"
                    placeholderTextColor="#94a3b8"
                    style={styles.fieldInput}
                  />
                </View>

                <View style={styles.profileImagePlaceholderBox}>
                  <Text style={styles.profileImagePlaceholderTitle}>프로필 이미지</Text>
                  <View style={styles.profileImagePreviewWrap}>
                    {profileModalAvatarPreviewUri ? (
                      <View style={styles.profilePreviewImageContainer}>
                        {!isProfilePreviewImageLoaded ? (
                          <View style={styles.imageLoadingOverlay}>
                            <Text style={styles.imageLoadingLabel}>Loading image...</Text>
                          </View>
                        ) : null}
                        <Image
                          source={{ uri: profileModalAvatarPreviewUri }}
                          style={[styles.profileImagePreview, !isProfilePreviewImageLoaded && styles.imageHidden]}
                          resizeMode="cover"
                          onLoadStart={() => setIsProfilePreviewImageLoaded(false)}
                          onLoadEnd={() => setIsProfilePreviewImageLoaded(true)}
                          onError={() => setIsProfilePreviewImageLoaded(true)}
                        />
                      </View>
                    ) : (
                      <Text style={styles.avatarLabel}>{avatarLetter}</Text>
                    )}
                  </View>
                  <Pressable style={styles.secondaryButtonCompact} onPress={pickProfileImage}>
                    <Text style={styles.secondaryButtonLabel}>이미지 선택</Text>
                  </Pressable>
                  <Text style={styles.profileImagePlaceholderBody}>
                    이미지 선택 후 같은 모달 안에서 원형 영역을 조절할 수 있습니다.
                  </Text>
                </View>

                <View style={styles.profileImagePlaceholderBox}>
                  <Text style={styles.profileImagePlaceholderTitle}>배경 카드 이미지</Text>
                  <View style={styles.profileBackgroundPreviewWrap}>
                    {profileModalBackgroundPreviewUri ? (
                      <View style={styles.profilePreviewImageContainer}>
                        {!isBackgroundPreviewImageLoaded ? (
                          <View style={styles.imageLoadingOverlay}>
                            <Text style={styles.imageLoadingLabel}>Loading image...</Text>
                          </View>
                        ) : null}
                        <Image
                          source={{ uri: profileModalBackgroundPreviewUri }}
                          style={[
                            styles.profileBackgroundPreview,
                            !isBackgroundPreviewImageLoaded && styles.imageHidden
                          ]}
                          resizeMode="cover"
                          onLoadStart={() => setIsBackgroundPreviewImageLoaded(false)}
                          onLoadEnd={() => setIsBackgroundPreviewImageLoaded(true)}
                          onError={() => setIsBackgroundPreviewImageLoaded(true)}
                        />
                      </View>
                    ) : (
                      <Text style={styles.profileBackgroundEmptyText}>Mood Card</Text>
                    )}
                  </View>
                  <Pressable style={styles.secondaryButtonCompact} onPress={pickProfileBackgroundImage}>
                    <Text style={styles.secondaryButtonLabel}>배경 이미지 선택</Text>
                  </Pressable>
                  <Text style={styles.profileImagePlaceholderBody}>
                    무드 카드 비율에 맞춰 드래그/확대하여 배경 이미지를 저장합니다.
                  </Text>
                </View>

                {localError ? <Text style={styles.profileModalErrorText}>{localError}</Text> : null}

                <View style={styles.profileModalActions}>
                  <Pressable style={styles.secondaryButtonCompact} onPress={closeProfileModal}>
                    <Text style={styles.secondaryButtonLabel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButtonCompact, isSavingProfile && styles.buttonDisabled]}
                    onPress={saveProfileSettings}
                    disabled={isSavingProfile}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isSavingProfile ? "Saving..." : "Save"}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.cropModalHint}>{cropPreset.hint}</Text>

                <View style={styles.cropStageWrap}>
                  <PanGestureHandler
                    onGestureEvent={onCropGestureEvent}
                    onHandlerStateChange={onCropHandlerStateChange}
                  >
                    <View
                      style={[
                        styles.cropFrame,
                        {
                          width: cropPreset.width,
                          height: cropPreset.height,
                          borderRadius: cropPreset.borderRadius
                        }
                      ]}
                    >
                      {cropMetrics && cropSourceImage ? (
                        <View style={styles.cropImageCenter} pointerEvents="none">
                          <Image
                            source={{ uri: cropSourceImage.localUri }}
                            style={[
                              styles.cropMovingImage,
                              {
                                width: cropMetrics.renderedWidth,
                                height: cropMetrics.renderedHeight,
                                transform: [{ translateX: cropOffset.x }, { translateY: cropOffset.y }]
                              }
                            ]}
                            resizeMode="cover"
                          />
                        </View>
                      ) : null}
                    </View>
                  </PanGestureHandler>
                </View>

                <View style={styles.cropZoomRow}>
                  <Pressable
                    style={styles.cropZoomButton}
                    onPress={() => updateCropZoom(cropZoom - 0.2)}
                    disabled={cropZoom <= PROFILE_CROP_MIN_ZOOM}
                  >
                    <Ionicons name="remove" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={styles.cropZoomLabel}>{Math.round(cropZoom * 100)}%</Text>
                  <Pressable
                    style={styles.cropZoomButton}
                    onPress={() => updateCropZoom(cropZoom + 0.2)}
                    disabled={cropZoom >= PROFILE_CROP_MAX_ZOOM}
                  >
                    <Ionicons name="add" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable
                    style={styles.secondaryButtonCompact}
                    onPress={() => {
                      setCropOffset({ x: 0, y: 0 });
                      updateCropZoom(PROFILE_CROP_MIN_ZOOM);
                    }}
                  >
                    <Text style={styles.secondaryButtonLabel}>초기화</Text>
                  </Pressable>
                </View>

                <View style={styles.profileModalActions}>
                  <Pressable style={styles.secondaryButtonCompact} onPress={backToProfileForm}>
                    <Text style={styles.secondaryButtonLabel}>취소</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryButtonCompact, isApplyingCrop && styles.buttonDisabled]}
                    onPress={applyCropAndUseImage}
                    disabled={isApplyingCrop}
                  >
                    <Text style={styles.primaryButtonLabel}>
                      {isApplyingCrop ? "Applying..." : "적용"}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={isFeedbackFallbackOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFeedbackFallbackOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsFeedbackFallbackOpen(false)}>
          <Pressable style={styles.feedbackModalCard} onPress={() => {}}>
            <Text style={styles.settingsSheetTitle}>{isKo ? "문의하기" : "Contact Us"}</Text>
            <Text style={styles.feedbackFallbackHint}>
              {isKo
                ? "현재 환경에서는 메일 앱을 바로 열 수 없습니다.\n아래 정보를 복사해서 직접 보내면 됩니다."
                : "Your mail app cannot be opened in this environment.\nPlease copy the details below and send manually."}
            </Text>

            <View style={styles.feedbackBlock}>
              <Text style={styles.feedbackBlockLabel}>To</Text>
              <Text selectable style={styles.feedbackBlockValue}>
                {feedbackDraft?.email ?? "lucl.service@gmail.com"}
              </Text>
            </View>

            <View style={styles.feedbackBlock}>
              <Text style={styles.feedbackBlockLabel}>Subject</Text>
              <Text selectable style={styles.feedbackBlockValue}>
                {feedbackDraft?.subject ?? "[LUCL] Feedback"}
              </Text>
            </View>

            <View style={styles.feedbackBlock}>
              <Text style={styles.feedbackBlockLabel}>Body</Text>
              <Text selectable style={styles.feedbackBlockValueMultiline}>
                {feedbackDraft?.body ?? ""}
              </Text>
            </View>

            <View style={styles.profileModalActions}>
              <Pressable
                style={styles.secondaryButtonCompact}
                onPress={() => setIsFeedbackFallbackOpen(false)}
              >
                <Text style={styles.secondaryButtonLabel}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SummaryCard({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.summaryPill, wide ? styles.summaryPillWide : null]}>
      <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.lg,
    backgroundColor: colors.background
  },
  pageBody: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.md
  },
  centeredContainer: {
    flex: 1,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  centeredBody: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md
  },
  screenHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32
  },
  heading: {
    fontSize: typography.titleLarge,
    fontWeight: "700",
    color: colors.textPrimary
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  helperText: {
    fontSize: typography.body,
    lineHeight: 22,
    color: colors.textSecondary
  },
  helperInlineText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  profileHeroStack: {
    position: "relative",
    minHeight: 340
  },
  profileBackgroundCard: {
    width: "100%",
    aspectRatio: MOOD_CARD_BACKGROUND_ASPECT_RATIO,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    shadowColor: "#0b1e38",
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2
  },
  profileBackgroundImage: {
    width: "100%",
    height: "100%"
  },
  profileBackgroundImageContainer: {
    width: "100%",
    height: "100%"
  },
  profileBackgroundFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e9eef7"
  },
  profileBackgroundFallbackTone: {
    width: "84%",
    height: "72%",
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.35)"
  },
  settingsHeroButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.54)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)"
  },
  profileOverlayContent: {
    position: "absolute",
    bottom: "14%",
    left: "8%",
    width: "68%",
    minWidth: 232,
    maxWidth: 280,
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 4
  },
  profileHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 44
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarLoadingPlaceholder: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted
  },
  avatarLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accent
  },
  profileHeroText: {
    flexShrink: 1,
    alignSelf: "flex-start",
    gap: 0
  },
  identityTextCard: {
    alignSelf: "flex-start",
    borderRadius: 12,
    maxWidth: 176,
    backgroundColor: "rgba(255,255,255,0.80)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  displayNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  displayName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary
  },
  profileSummaryPrimaryRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 3
  },
  profileSummarySecondaryRow: {
    flexDirection: "row",
    gap: 4,
    alignSelf: "flex-start"
  },
  bronzeTokenInline: {
    marginTop: 1
  },
  bronzeTokenInlineText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "600"
  },
  summaryPill: {
    width: 72,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 1,
    justifyContent: "space-between"
  },
  summaryPillWide: {
    width: 112
  },
  summaryMiniCard: {
    width: 50,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between"
  },
  tierSummaryCard: {
    width: 74,
    paddingHorizontal: 6
  },
  summaryLabel: {
    fontSize: 9,
    color: colors.textMuted
  },
  summaryValue: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.textPrimary
  },
  tierSummaryValue: {
    fontSize: 10.5
  },
  followActionCard: {
    minWidth: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4
  },
  followActionCardDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted
  },
  followActionLabelDisabled: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted
  },
  infoCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  actionsCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#0b1e38",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  moreButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  moreButtonLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textPrimary
  },
  myPostCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    gap: 4
  },
  myPostTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  myPostDate: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  myPostPreview: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18
  },
  infoRow: {
    gap: 4,
    paddingVertical: 4
  },
  infoLabel: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  infoValue: {
    fontSize: typography.body,
    color: colors.textPrimary
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#0b1e38",
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  primaryButtonCompact: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  primaryButtonLabel: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: typography.bodySmall
  },
  secondaryButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  secondaryButtonCompact: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  dangerButtonCompact: {
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.bodySmall
  },
  dangerButtonLabel: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: typography.bodySmall
  },
  buttonDisabled: {
    opacity: 0.6
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.28)",
    justifyContent: "center",
    padding: spacing.lg
  },
  settingsModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.56)",
    justifyContent: "center",
    padding: spacing.lg
  },
  settingsSheet: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    maxHeight: SETTINGS_SHEET_MAX_HEIGHT
  },
  settingsSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  settingsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border
  },
  settingsScrollArea: {
    maxHeight: SETTINGS_SCROLL_MAX_HEIGHT
  },
  settingsScrollContent: {
    paddingBottom: spacing.xs
  },
  myInfoCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    gap: 4
  },
  myInfoTitle: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4
  },
  profileModalCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md
  },
  feedbackModalCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md
  },
  cropModalHint: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary
  },
  cropStageWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  cropFrame: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden"
  },
  cropImageCenter: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  cropMovingImage: {
    position: "absolute"
  },
  cropZoomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  cropZoomButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  cropZoomLabel: {
    minWidth: 56,
    textAlign: "center",
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  settingsSheetTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 8
  },
  settingsIconWrap: {
    width: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  settingsRowTextBlock: {
    flex: 1,
    gap: 2
  },
  settingsRowTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  settingsDangerRowTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.error
  },
  settingsRowSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  languageOptionRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  languageOptionChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface
  },
  languageOptionChipSelected: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary
  },
  languageOptionChipLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textPrimary
  },
  languageOptionChipLabelSelected: {
    color: "#f8fafc"
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textMuted
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface
  },
  profileImagePlaceholderBox: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4
  },
  profileImagePlaceholderTitle: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  profileImagePlaceholderBody: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    lineHeight: 18
  },
  profileImagePreviewWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileImagePreview: {
    width: "100%",
    height: "100%"
  },
  profilePreviewImageContainer: {
    width: "100%",
    height: "100%"
  },
  profileBackgroundPreviewWrap: {
    width: 132,
    height: Math.round(132 / MOOD_CARD_BACKGROUND_ASPECT_RATIO),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileBackgroundPreview: {
    width: "100%",
    height: "100%"
  },
  imageLoadingOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    zIndex: 1
  },
  imageLoadingLabel: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  imageHidden: {
    opacity: 0
  },
  profileBackgroundEmptyText: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textMuted
  },
  feedbackFallbackHint: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20
  },
  feedbackBlock: {
    gap: 4,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border
  },
  feedbackBlockLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textMuted
  },
  feedbackBlockValue: {
    fontSize: typography.bodySmall,
    color: colors.textPrimary
  },
  feedbackBlockValueMultiline: {
    fontSize: typography.caption,
    lineHeight: 18,
    color: colors.textPrimary
  },
  profileModalErrorText: {
    fontSize: typography.bodySmall,
    color: colors.error,
    lineHeight: 20
  },
  profileModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  }
});
