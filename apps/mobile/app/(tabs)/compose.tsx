import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import {
  getShanghaiMainCategoryFromSlug,
  getShanghaiSubcategoryOptions
} from "../../src/features/compose/compose.service";
import { useComposePost } from "../../src/features/compose/use-compose-post";
import { useAppLanguage, type ResolvedAppLanguage } from "../../src/features/language/app-language";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

const STUDY_DEGREES = [
  { value: "bachelor" },
  { value: "master" },
  { value: "phd" }
] as const;

type ComposeLanguageValue = {
  ko: string;
  en: string;
};

const SECTION_LABELS: Record<string, ComposeLanguageValue> = {
  life: { ko: "학교", en: "School" },
  study: { ko: "학업", en: "Study" },
  qa: { ko: "질문", en: "Q&A" },
  fun: { ko: "상하이", en: "Shanghai" }
};

const CATEGORY_LABELS: Record<string, ComposeLanguageValue> = {
  "life-facilities": { ko: "학교시설", en: "Facilities" },
  "life-food": { ko: "식당", en: "Dining" },
  "life-dorm": { ko: "기숙사", en: "Dormitory" },
  "life-notice": { ko: "공지", en: "Notices" },
  "life-opportunity": { ko: "기회의 장", en: "Opportunities" },
  "life-info-sharing": { ko: "정보 공유", en: "Info Sharing" },
  "study-major": { ko: "전공정보", en: "Major Info" },
  "study-class-review": { ko: "수업후기", en: "Class Review" },
  "study-professor-review": { ko: "교수후기", en: "Professor Review" },
  "study-exam-difficulty": { ko: "시험난이도", en: "Exam Difficulty" },
  "study-classroom-tips": { ko: "강의실/수강팁", en: "Class Tips" },
  "qa-facilities": { ko: "시설", en: "Facilities" },
  "qa-dorm": { ko: "기숙사", en: "Dormitory" },
  "qa-study": { ko: "학업", en: "Study" },
  "fun-food-cafe": { ko: "카페", en: "Cafe" },
  "fun-food-chinese": { ko: "중식", en: "Chinese" },
  "fun-food-western": { ko: "양식", en: "Western" },
  "fun-food-korean": { ko: "한식", en: "Korean" },
  "fun-food-japanese": { ko: "일식", en: "Japanese" },
  "fun-food-other": { ko: "기타", en: "Other" },
  "fun-place": { ko: "장소", en: "Place" },
  "fun-church-intro": { ko: "교회 소개", en: "Church Intro" },
  "fun-church-notice": { ko: "교회 공지", en: "Church Notice" }
};

const DEGREE_LABELS: Record<string, ComposeLanguageValue> = {
  bachelor: { ko: "학사", en: "Bachelor" },
  master: { ko: "석사", en: "Master" },
  phd: { ko: "박사", en: "PhD" }
};

const RUNTIME_MESSAGE_MAP: Record<string, ComposeLanguageValue> = {
  "Sign in to create a post.": { ko: "게시글을 작성하려면 로그인하세요.", en: "Sign in to create a post." },
  "Profile is still loading.": { ko: "프로필 정보를 불러오는 중입니다.", en: "Profile is still loading." },
  "Composer is loading.": { ko: "작성 화면을 준비하고 있습니다.", en: "Composer is loading." },
  "Select a post type.": { ko: "게시 유형을 선택하세요.", en: "Select a post type." },
  "No categories are available for the selected post type.": {
    ko: "선택한 게시 유형에 사용할 카테고리가 없습니다.",
    en: "No categories are available for the selected post type."
  },
  "Select a category.": { ko: "카테고리를 선택하세요.", en: "Select a category." },
  "Only Church-Master can create or edit Church content.": {
    ko: "교회 콘텐츠는 Church-Master만 작성하거나 수정할 수 있습니다.",
    en: "Only Church-Master can create or edit Church content."
  },
  "Campus-Master can only compose School notice.": {
    ko: "Campus-Master는 학교 공지만 작성할 수 있습니다.",
    en: "Campus-Master can only compose School notice."
  },
  "Campus-Master can only compose campus notice.": {
    ko: "Campus-Master는 캠퍼스 공지 카테고리만 작성할 수 있습니다.",
    en: "Campus-Master can only compose campus notice."
  },
  "Only Campus-Master can compose campus notice.": {
    ko: "캠퍼스 공지는 Campus-Master만 작성할 수 있습니다.",
    en: "Only Campus-Master can compose campus notice."
  },
  "Title is required.": { ko: "제목을 입력해주세요.", en: "Title is required." },
  "Abstract is required.": { ko: "요약을 입력해주세요.", en: "Abstract is required." },
  "Add at least one paragraph or image.": {
    ko: "문단 또는 이미지를 1개 이상 추가해주세요.",
    en: "Add at least one paragraph or image."
  },
  "Select a degree for Study posts.": { ko: "학업 게시글의 학위를 선택해주세요.", en: "Select a degree for Study posts." },
  "Select a university for this post.": { ko: "이 게시글의 학교를 선택해주세요.", en: "Select a university for this post." },
  "University list is unavailable. Try again shortly.": {
    ko: "학교 목록을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.",
    en: "University list is unavailable. Try again shortly."
  },
  "Select a university or switch to Shanghai.": {
    ko: "학교를 선택하거나 상하이 섹션으로 전환해주세요.",
    en: "Select a university or switch to Shanghai."
  },
  "University selection is required for Bronze Q&A posts.": {
    ko: "브론즈 Q&A 게시글은 학교 선택이 필요합니다.",
    en: "University selection is required for Bronze Q&A posts."
  },
  "Church intro card updated successfully.": { ko: "교회 소개 카드가 업데이트되었습니다.", en: "Church intro card updated successfully." },
  "Post created successfully.": { ko: "게시글이 작성되었습니다.", en: "Post created successfully." },
  "Post created, but image attachment was skipped due to invalid post ID.": {
    ko: "게시글은 작성되었지만 잘못된 게시글 ID로 인해 이미지 첨부는 건너뛰었습니다.",
    en: "Post created, but image attachment was skipped due to invalid post ID."
  },
  "Post saved, but points award skipped because create_post returned an invalid post id.": {
    ko: "게시글은 저장되었지만 create_post가 잘못된 ID를 반환해 포인트 지급은 건너뛰었습니다.",
    en: "Post saved, but points award skipped because create_post returned an invalid post id."
  },
  "Unable to create post right now. Please try again.": {
    ko: "지금은 게시글을 작성할 수 없습니다. 잠시 후 다시 시도해주세요.",
    en: "Unable to create post right now. Please try again."
  },
  "Bronze accounts can post up to 1 question per Shanghai day.": {
    ko: "브론즈 계정은 상하이 하루 기준 질문을 최대 1개만 작성할 수 있습니다.",
    en: "Bronze accounts can post up to 1 question per Shanghai day."
  },
  "Bronze accounts can only create Q&A posts.": {
    ko: "브론즈 계정은 Q&A 게시글만 작성할 수 있습니다.",
    en: "Bronze accounts can only create Q&A posts."
  },
  "Posting is limited to your verified university (or LIFE).": {
    ko: "작성 가능 학교는 인증된 학교(또는 LIFE)로 제한됩니다.",
    en: "Posting is limited to your verified university (or LIFE)."
  },
  "VLOG posting is currently unavailable.": {
    ko: "VLOG 게시는 현재 사용할 수 없습니다.",
    en: "VLOG posting is currently unavailable."
  },
  "Church content can only be created by Church-Master.": {
    ko: "교회 콘텐츠는 Church-Master만 작성할 수 있습니다.",
    en: "Church content can only be created by Church-Master."
  }
};

function pickLanguageText(language: ResolvedAppLanguage, value: ComposeLanguageValue): string {
  return language === "ko" ? value.ko : value.en;
}

function localizeRuntimeMessage(message: string | null | undefined, language: ResolvedAppLanguage): string | null {
  if (!message) {
    return null;
  }

  if (message.startsWith("Points +")) {
    return language === "ko" ? `포인트 지급: ${message.replace("Points +", "+")}` : message;
  }

  const mapped = RUNTIME_MESSAGE_MAP[message];
  if (mapped) {
    return pickLanguageText(language, mapped);
  }

  return message;
}

export default function ComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ presetSection?: string | string[]; presetCategory?: string | string[] }>();
  const auth = useAuthSession();
  const { resolvedLanguage } = useAppLanguage();
  const isKo = resolvedLanguage === "ko";
  const verifiedEmail = auth.user?.profile?.verified_school_email ?? null;
  const verifiedUniversityId = auth.user?.profile?.verified_university_id ?? null;
  const isVerified = Boolean(verifiedEmail && verifiedUniversityId);

  const {
    state,
    isLoading,
    canSubmit,
    universityRequired,
    universitySelectorDisabled,
    universitySelectionLocked,
    publishDisabledReason,
    verifiedUniversity,
    setTitle,
    setAbstract,
    setLocationText,
    setTagsInput,
    selectSection,
    selectCategory,
    selectDegree,
    selectUniversity,
    updateParagraphText,
    addParagraphAfter,
    insertImageAfter,
    selectThumbnail,
    removeBlock,
    submit
  } = useComposePost({ profile: auth.user?.profile ?? null });

  const appliedPresetKeyRef = useRef<string | null>(null);
  const handledCreatedPostRouteRef = useRef<string | null>(null);
  const rawPresetSection = params.presetSection;
  const rawPresetCategory = params.presetCategory;
  const presetSection = Array.isArray(rawPresetSection) ? rawPresetSection[0] : rawPresetSection;
  const presetCategory = Array.isArray(rawPresetCategory) ? rawPresetCategory[0] : rawPresetCategory;

  useEffect(() => {
    const presetKey = `${presetSection ?? ""}|${presetCategory ?? ""}`;

    if (appliedPresetKeyRef.current === presetKey) {
      return;
    }

    if (state.action === "bootstrapping") {
      return;
    }

    if (
      presetSection &&
      (presetSection === "life" || presetSection === "study" || presetSection === "qa" || presetSection === "fun") &&
      state.selectedSectionCode !== presetSection
    ) {
      selectSection(presetSection);
      return;
    }

    if (presetCategory) {
      if (state.categoryOptions.some((category) => category.slug === presetCategory)) {
        selectCategory(presetCategory);
        appliedPresetKeyRef.current = presetKey;
      }
      return;
    }

    appliedPresetKeyRef.current = presetKey;
  }, [presetCategory, presetSection, selectCategory, selectSection, state.action, state.categoryOptions, state.selectedSectionCode]);

  useEffect(() => {
    if (!state.createdPostRoute) {
      return;
    }

    if (handledCreatedPostRouteRef.current === state.createdPostRoute) {
      return;
    }

    handledCreatedPostRouteRef.current = state.createdPostRoute;
    void auth.refresh();
    router.replace(state.createdPostRoute as never);
  }, [auth.refresh, router, state.createdPostRoute]);

  const isBootstrapping = state.action === "bootstrapping";
  const isSubmitting = state.action === "submitting";
  const isSelectingImages = state.action === "selecting_images";
  const selectedShanghaiMainCategory = useMemo(() => {
    if (state.selectedSectionCode !== "fun") {
      return null;
    }
    return getShanghaiMainCategoryFromSlug(state.selectedCategorySlug);
  }, [state.selectedCategorySlug, state.selectedSectionCode]);

  const shanghaiSubcategories = useMemo(() => {
    if (state.selectedSectionCode !== "fun" || !selectedShanghaiMainCategory) {
      return [];
    }

    const allowedSlugs = new Set(state.categoryOptions.map((category) => category.slug));
    return getShanghaiSubcategoryOptions(selectedShanghaiMainCategory).filter((category) =>
      allowedSlugs.has(category.slug)
    );
  }, [selectedShanghaiMainCategory, state.categoryOptions, state.selectedSectionCode]);

  const visibleShanghaiMainCategories = useMemo(() => {
    if (state.selectedSectionCode !== "fun") {
      return [] as Array<{ key: "food" | "place" | "church" }>;
    }

    const hasFood = state.categoryOptions.some((category) => category.slug.startsWith("fun-food-"));
    const hasPlace = state.categoryOptions.some((category) => category.slug === "fun-place");
    const hasChurch = state.categoryOptions.some((category) => category.slug.startsWith("fun-church-"));

    const result: Array<{ key: "food" | "place" | "church" }> = [];
    if (hasFood) {
      result.push({ key: "food" });
    }
    if (hasPlace) {
      result.push({ key: "place" });
    }
    if (hasChurch) {
      result.push({ key: "church" });
    }

    return result;
  }, [state.categoryOptions, state.selectedSectionCode]);

  const localizedPublishDisabledReason = useMemo(
    () => localizeRuntimeMessage(publishDisabledReason, resolvedLanguage),
    [publishDisabledReason, resolvedLanguage]
  );
  const localizedInfoMessage = useMemo(
    () => localizeRuntimeMessage(state.infoMessage, resolvedLanguage),
    [resolvedLanguage, state.infoMessage]
  );
  const localizedErrorMessage = useMemo(
    () => localizeRuntimeMessage(state.errorMessage, resolvedLanguage),
    [resolvedLanguage, state.errorMessage]
  );

  function getSectionLabel(code: string, fallbackLabel: string): string {
    const mapped = SECTION_LABELS[code];
    return mapped ? pickLanguageText(resolvedLanguage, mapped) : fallbackLabel;
  }

  function getCategoryLabel(slug: string, fallbackLabel: string): string {
    const mapped = CATEGORY_LABELS[slug];
    return mapped ? pickLanguageText(resolvedLanguage, mapped) : fallbackLabel;
  }

  function getDegreeLabel(value: string): string {
    const mapped = DEGREE_LABELS[value];
    return mapped ? pickLanguageText(resolvedLanguage, mapped) : value;
  }

  function getShanghaiMainCategoryLabel(value: "food" | "place" | "church"): string {
    if (value === "food") {
      return isKo ? "음식" : "Food";
    }
    if (value === "place") {
      return isKo ? "장소" : "Place";
    }
    return isKo ? "교회" : "Church";
  }

  if (auth.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.heading}>{isKo ? "새 글 작성" : "New Post"}</Text>
        <Text style={styles.text}>{isKo ? "세션을 확인하는 중..." : "Checking session..."}</Text>
      </View>
    );
  }

  if (!auth.isSignedIn) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.heading}>{isKo ? "새 글 작성" : "New Post"}</Text>
        <Text style={styles.errorText}>{isKo ? "게시글을 작성하려면 로그인하세요." : "Sign in to create a post."}</Text>
        <Link
          asChild
          href={{
            pathname: "/auth/sign-in",
            params: { redirectTo: "/(tabs)/compose" }
          }}
        >
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>{isKo ? "로그인" : "Sign In"}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.heading}>{isKo ? "새 글 작성" : "New Post"}</Text>
        <Text style={styles.text}>{isKo ? "작성 정보를 불러오는 중..." : "Loading composer context..."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{isKo ? "새 글 작성" : "New Post"}</Text>
      <Text style={styles.metaText}>{isKo ? "학교 인증:" : "School verified:"} {isVerified ? (isKo ? "예" : "Yes") : (isKo ? "아니요" : "No")}</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "게시 유형" : "Post Type"}</Text>
        {state.sectionOptions.length === 0 ? (
          <Text style={styles.helperText}>
            {isKo ? "이 계정에서 사용할 수 있는 게시 유형이 없습니다." : "No post types are available for this account."}
          </Text>
        ) : null}
        <View style={styles.optionWrap}>
          {state.sectionOptions.map((option) => {
            const selected = state.selectedSectionCode === option.code;

            return (
              <Pressable
                key={option.code}
                disabled={isLoading}
                onPress={() => selectSection(option.code)}
                style={[styles.optionChip, selected && styles.optionChipSelected]}
              >
                <Text style={[styles.optionChipLabel, selected && styles.optionChipLabelSelected]}>
                  {getSectionLabel(option.code, option.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {state.selectedSectionCode === "study" ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>{isKo ? "학위" : "Degree"}</Text>
          <Text style={styles.helperText}>
            {isKo ? "학업 카테고리 선택 전에 학위를 먼저 선택하세요." : "Select the degree before choosing a study category."}
          </Text>
          <View style={styles.optionWrap}>
            {STUDY_DEGREES.map((option) => {
              const selected = state.selectedDegree === option.value;

              return (
                <Pressable
                  key={option.value}
                  disabled={isLoading}
                  onPress={() => selectDegree(option.value)}
                  style={[styles.optionChip, selected && styles.optionChipSelected]}
                >
                  <Text style={[styles.optionChipLabel, selected && styles.optionChipLabelSelected]}>
                    {getDegreeLabel(option.value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "카테고리" : "Category"}</Text>
        {state.selectedSectionCode && state.categoryOptions.length === 0 ? (
          <Text style={styles.helperText}>
            {isKo ? "이 섹션에서 사용할 수 있는 카테고리가 없습니다." : "No categories available for this section."}
          </Text>
        ) : null}

        {state.selectedSectionCode === "fun" ? (
          <>
            <Text style={styles.helperText}>{isKo ? "상하이 카테고리를 선택하세요." : "Select Shanghai category."}</Text>
            <View style={styles.optionWrap}>
              {visibleShanghaiMainCategories.map((main) => {
                const isSelected = selectedShanghaiMainCategory === main.key;
                return (
                  <Pressable
                    key={main.key}
                    disabled={isLoading}
                    onPress={() => {
                      const allowedSlugs = new Set(state.categoryOptions.map((category) => category.slug));
                      const defaults = getShanghaiSubcategoryOptions(main.key).filter((category) =>
                        allowedSlugs.has(category.slug)
                      );
                      if (defaults.length > 0) {
                        selectCategory(defaults[0].slug);
                      }
                    }}
                    style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                  >
                    <Text style={[styles.optionChipLabel, isSelected && styles.optionChipLabelSelected]}>
                      {getShanghaiMainCategoryLabel(main.key)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedShanghaiMainCategory === "church" || selectedShanghaiMainCategory === "food" ? (
              <View style={styles.optionWrap}>
                {shanghaiSubcategories.map((option) => {
                  const selected = state.selectedCategorySlug === option.slug;
                  const label = getCategoryLabel(option.slug, option.label);
                  return (
                    <Pressable
                      key={`${option.sectionCode}-${option.slug}`}
                      disabled={isLoading}
                      onPress={() => selectCategory(option.slug)}
                      style={[styles.optionChip, selected && styles.optionChipSelected]}
                    >
                      <Text style={[styles.optionChipLabel, selected && styles.optionChipLabelSelected]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {state.selectedCategorySlug === "fun-church-intro" ? (
              <Text style={styles.helperText}>
                {isKo
                  ? "교회 소개는 여러 게시글 대신 대표 소개 카드 1개를 저장합니다."
                  : "Church Intro saves one canonical intro card instead of creating multiple posts."}
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.optionWrap}>
            {state.categoryOptions.map((option) => {
              const selected = state.selectedCategorySlug === option.slug;

              return (
                <Pressable
                  key={`${option.sectionCode}-${option.slug}`}
                  disabled={isLoading}
                  onPress={() => selectCategory(option.slug)}
                  style={[styles.optionChip, selected && styles.optionChipSelected]}
                >
                  <Text style={[styles.optionChipLabel, selected && styles.optionChipLabelSelected]}>
                    {getCategoryLabel(option.slug, option.label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "학교" : "University"}</Text>

        {state.selectedSectionCode === "fun" ? (
          <Text style={styles.helperText}>{isKo ? "상하이 게시글은 학교 선택이 필요하지 않습니다." : "Shanghai posts do not use university."}</Text>
        ) : null}

        {state.selectedSectionCode !== "fun" && verifiedUniversityId ? (
          <Text style={styles.helperText}>
            {isKo ? "인증된 학교:" : "Verified university:"}{" "}
            {verifiedUniversity?.shortName ?? verifiedUniversity?.name ?? verifiedUniversityId}
          </Text>
        ) : null}

        {state.selectedSectionCode !== "fun" &&
        !verifiedUniversityId &&
        state.selectedUniversitySlug ? (
          <Text style={styles.helperText}>
            {isKo ? "선택한 학교:" : "Selected university:"}{" "}
            {state.universityOptions.find((item) => item.slug === state.selectedUniversitySlug)
              ?.shortName ??
              state.universityOptions.find((item) => item.slug === state.selectedUniversitySlug)
                ?.name ??
              state.selectedUniversitySlug}
          </Text>
        ) : null}

        {!universitySelectionLocked ? (
          <View style={styles.optionWrap}>
            {state.universityOptions.map((university) => {
              const selected = state.selectedUniversitySlug === university.slug;
              const disabled = universitySelectorDisabled || isLoading;

              return (
                <Pressable
                  key={university.id}
                  disabled={disabled}
                  onPress={() => selectUniversity(university.slug)}
                  style={[
                    styles.optionChip,
                    selected && styles.optionChipSelected,
                    disabled && styles.optionChipDisabled
                  ]}
                >
                  <Text style={[styles.optionChipLabel, selected && styles.optionChipLabelSelected]}>
                    {university.shortName || university.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {universitySelectionLocked && state.selectedUniversitySlug ? (
          <Text style={styles.helperText}>
            {isKo ? "작성 가능한 학교는 인증된 학교로 제한됩니다." : "Posting is limited to your verified university."}
          </Text>
        ) : null}

        {universityRequired ? (
          <Text style={styles.helperText}>
            {isKo ? "브론즈 Q&A 게시글은 학교 선택이 필요합니다." : "Bronze Q&A posts require university selection."}
          </Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "제목" : "Title"}</Text>
        <TextInput
          editable={!isLoading}
          placeholder={isKo ? "간결한 제목을 입력하세요" : "Write a concise title"}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "요약" : "Abstract"}</Text>
        <TextInput
          editable={!isLoading}
          placeholder={isKo ? "미리보기에 표시할 짧은 요약" : "Short summary for previews"}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.abstract}
          onChangeText={setAbstract}
        />
        <Text style={styles.helperText}>
          {state.selectedCategorySlug === "fun-church-intro"
            ? (isKo
                ? "교회 소개는 대표 카드 내용을 저장합니다. 요약은 선택 사항입니다."
                : "Church Intro stores the main card content. Abstract is optional.")
            : (isKo ? "요약은 필수입니다." : "Abstract is required.")}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "내용" : "Content"}</Text>
        <View style={styles.editorSection}>
          {state.blocks.map((block, index) => (
            <View key={block.id} style={styles.blockCard}>
              {block.type === "paragraph" ? (
                <TextInput
                  editable={!isLoading}
                  multiline
                  placeholder={isKo ? "문단 내용을 입력하세요" : "Write a paragraph"}
                  placeholderTextColor="#94a3b8"
                  style={[styles.input, styles.paragraphInput]}
                  textAlignVertical="top"
                  value={block.text}
                  onChangeText={(text) => updateParagraphText(block.id, text)}
                />
              ) : (
                <View style={styles.imageBlock}>
                  {block.localUri || block.imageUrl ? (
                    <Image source={{ uri: block.imageUrl ?? block.localUri }} style={styles.imagePreview} />
                  ) : (
                    <Text style={styles.helperText}>{isKo ? "이미지를 표시할 수 없습니다." : "Image not available."}</Text>
                  )}
                  <Pressable
                    disabled={isLoading}
                    onPress={() => selectThumbnail(block.id)}
                    style={[
                      styles.actionChip,
                      state.thumbnailBlockId === block.id && styles.actionChipSelected,
                      isLoading && styles.buttonDisabled
                    ]}
                  >
                    <Text
                      style={[
                        styles.actionChipLabel,
                        state.thumbnailBlockId === block.id && styles.actionChipLabelSelected
                      ]}
                    >
                      {state.thumbnailBlockId === block.id
                        ? (isKo ? "썸네일 선택됨" : "Thumbnail Selected")
                        : (isKo ? "썸네일 지정" : "Set Thumbnail")}
                    </Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.blockActions}>
                <Pressable
                  disabled={isLoading}
                  onPress={() => addParagraphAfter(index)}
                  style={[styles.actionChip, isLoading && styles.buttonDisabled]}
                >
                  <Text style={styles.actionChipLabel}>{isKo ? "문단 추가" : "Add Paragraph"}</Text>
                </Pressable>

                <Pressable
                  disabled={isLoading}
                  onPress={() => insertImageAfter(index)}
                  style={[styles.actionChip, isLoading && styles.buttonDisabled]}
                >
                  <Text style={styles.actionChipLabel}>
                    {isSelectingImages ? (isKo ? "선택 중..." : "Selecting...") : (isKo ? "이미지 삽입" : "Insert Image")}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={isLoading}
                  onPress={() => removeBlock(block.id)}
                  style={[styles.actionChip, styles.actionChipDanger, isLoading && styles.buttonDisabled]}
                >
                  <Text style={styles.actionChipLabelDanger}>{isKo ? "삭제" : "Remove"}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "위치 (선택)" : "Location (optional)"}</Text>
        <TextInput
          editable={!isLoading}
          placeholder={isKo ? "캠퍼스 위치" : "Campus location"}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.locationText}
          onChangeText={setLocationText}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{isKo ? "태그 (선택)" : "Tags (optional)"}</Text>
        <TextInput
          editable={!isLoading}
          placeholder={isKo ? "태그1, 태그2" : "tag1, tag2"}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.tagsInput}
          onChangeText={setTagsInput}
        />
      </View>

      {state.imageUploadFailures.length > 0 ? (
        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>{isKo ? "이미지 업로드 이슈" : "Image Upload Issues"}</Text>
          {state.imageUploadFailures.map((failure) => (
            <Text key={failure.localUri} style={styles.failureText}>
              {failure.fileName}: {failure.message}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonLabel}>{isSubmitting ? (isKo ? "게시 중..." : "Publishing...") : (isKo ? "게시하기" : "Publish")}</Text>
      </Pressable>

      {process.env.NODE_ENV !== "production" && !canSubmit && localizedPublishDisabledReason ? (
        <Text style={styles.helperText}>
          {isKo ? "게시 비활성화 사유:" : "Publish disabled:"} {localizedPublishDisabledReason}
        </Text>
      ) : null}

      {localizedInfoMessage ? <Text style={styles.infoText}>{localizedInfoMessage}</Text> : null}
      {state.createdPostId ? <Text style={styles.metaText}>{isKo ? "게시글 ID:" : "Post ID:"} {state.createdPostId}</Text> : null}
      {localizedErrorMessage ? <Text style={styles.errorText}>{localizedErrorMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background
  },
  heading: {
    fontSize: typography.title,
    fontWeight: "700",
    color: colors.textPrimary
  },
  text: {
    fontSize: typography.body,
    color: colors.textSecondary
  },
  metaText: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  fieldGroup: {
    gap: spacing.sm
  },
  label: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary
  },
  helperText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.body,
    color: colors.textPrimary
  },
  paragraphInput: {
    minHeight: 120
  },
  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  optionChipSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary
  },
  optionChipDisabled: {
    opacity: 0.5
  },
  optionChipLabel: {
    fontSize: typography.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary
  },
  optionChipLabelSelected: {
    color: colors.background
  },
  editorSection: {
    gap: spacing.sm
  },
  blockCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: spacing.sm
  },
  imageBlock: {
    gap: spacing.sm
  },
  imagePreview: {
    width: "100%",
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted
  },
  blockActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  actionChip: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  actionChipSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary
  },
  actionChipLabel: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textPrimary
  },
  actionChipLabelSelected: {
    color: colors.background
  },
  actionChipDanger: {
    borderColor: colors.error
  },
  actionChipLabelDanger: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.error
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 18
  },
  primaryButtonLabel: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.background
  },
  buttonDisabled: {
    opacity: 0.5
  },
  failureCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 12
  },
  failureTitle: {
    fontSize: typography.bodySmall,
    fontWeight: "700",
    color: colors.error
  },
  failureText: {
    fontSize: typography.caption,
    color: colors.error
  },
  infoText: {
    fontSize: typography.bodySmall,
    color: colors.success
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  }
});
