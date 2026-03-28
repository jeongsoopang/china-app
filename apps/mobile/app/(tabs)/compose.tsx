import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import {
  getShanghaiMainCategoryFromSlug,
  getShanghaiSubcategoryOptions
} from "../../src/features/compose/compose.service";
import { useComposePost } from "../../src/features/compose/use-compose-post";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

const STUDY_DEGREES = [
  { value: "bachelor", label: "Bachelor" },
  { value: "master", label: "Master" },
  { value: "phd", label: "PhD" }
] as const;

export default function ComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ presetSection?: string | string[]; presetCategory?: string | string[] }>();
  const auth = useAuthSession();
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
      return [] as Array<{ key: "food" | "place" | "church"; label: string }>;
    }

    const hasFood = state.categoryOptions.some((category) => category.slug.startsWith("fun-food-"));
    const hasPlace = state.categoryOptions.some((category) => category.slug === "fun-place");
    const hasChurch = state.categoryOptions.some((category) => category.slug.startsWith("fun-church-"));

    const result: Array<{ key: "food" | "place" | "church"; label: string }> = [];
    if (hasFood) {
      result.push({ key: "food", label: "Food" });
    }
    if (hasPlace) {
      result.push({ key: "place", label: "Place" });
    }
    if (hasChurch) {
      result.push({ key: "church", label: "Church" });
    }

    return result;
  }, [state.categoryOptions, state.selectedSectionCode]);

  if (auth.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.heading}>Compose</Text>
        <Text style={styles.text}>Checking session...</Text>
      </View>
    );
  }

  if (!auth.isSignedIn) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.heading}>Compose</Text>
        <Text style={styles.errorText}>Sign in to create a post.</Text>
        <Link
          asChild
          href={{
            pathname: "/auth/sign-in",
            params: { redirectTo: "/(tabs)/compose" }
          }}
        >
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>Sign In</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.heading}>Compose</Text>
        <Text style={styles.text}>Loading composer context...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Compose</Text>
      <Text style={styles.metaText}>School verified: {isVerified ? "Yes" : "No"}</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Post Type</Text>
        {state.sectionOptions.length === 0 ? (
          <Text style={styles.helperText}>No post types are available for this account.</Text>
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
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {state.selectedSectionCode === "study" ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Degree</Text>
          <Text style={styles.helperText}>Select the degree before choosing a study category.</Text>
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
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Category</Text>
        {state.selectedSectionCode && state.categoryOptions.length === 0 ? (
          <Text style={styles.helperText}>No categories available for this section.</Text>
        ) : null}

        {state.selectedSectionCode === "fun" ? (
          <>
            <Text style={styles.helperText}>Select Shanghai category.</Text>
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
                      {main.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedShanghaiMainCategory === "church" || selectedShanghaiMainCategory === "food" ? (
              <View style={styles.optionWrap}>
                {shanghaiSubcategories.map((option) => {
                  const selected = state.selectedCategorySlug === option.slug;
                  const label = option.label.split("·")[1]?.trim() ?? option.label;
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
                Church 소개 saves one canonical intro card instead of creating multiple posts.
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
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>University</Text>

        {state.selectedSectionCode === "fun" ? (
          <Text style={styles.helperText}>Shanghai posts do not use university.</Text>
        ) : null}

        {state.selectedSectionCode !== "fun" && verifiedUniversityId ? (
          <Text style={styles.helperText}>
            Verified university:{" "}
            {verifiedUniversity?.shortName ?? verifiedUniversity?.name ?? verifiedUniversityId}
          </Text>
        ) : null}

        {state.selectedSectionCode !== "fun" &&
        !verifiedUniversityId &&
        state.selectedUniversitySlug ? (
          <Text style={styles.helperText}>
            Selected university:{" "}
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
          <Text style={styles.helperText}>Posting is limited to your verified university.</Text>
        ) : null}

        {universityRequired ? (
          <Text style={styles.helperText}>Bronze Q&A posts require university selection.</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          editable={!isLoading}
          placeholder="Write a concise title"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.title}
          onChangeText={setTitle}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Abstract</Text>
        <TextInput
          editable={!isLoading}
          placeholder="Short summary for previews"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.abstract}
          onChangeText={setAbstract}
        />
        <Text style={styles.helperText}>
          {state.selectedCategorySlug === "fun-church-intro"
            ? "Church 소개 stores the main card content. Abstract is optional."
            : "Abstract is required."}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Content</Text>
        <View style={styles.editorSection}>
          {state.blocks.map((block, index) => (
            <View key={block.id} style={styles.blockCard}>
              {block.type === "paragraph" ? (
                <TextInput
                  editable={!isLoading}
                  multiline
                  placeholder="Write a paragraph"
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
                    <Text style={styles.helperText}>Image not available.</Text>
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
                      {state.thumbnailBlockId === block.id ? "Thumbnail Selected" : "Set Thumbnail"}
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
                  <Text style={styles.actionChipLabel}>Add Paragraph</Text>
                </Pressable>

                <Pressable
                  disabled={isLoading}
                  onPress={() => insertImageAfter(index)}
                  style={[styles.actionChip, isLoading && styles.buttonDisabled]}
                >
                  <Text style={styles.actionChipLabel}>
                    {isSelectingImages ? "Selecting..." : "Insert Image"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={isLoading}
                  onPress={() => removeBlock(block.id)}
                  style={[styles.actionChip, styles.actionChipDanger, isLoading && styles.buttonDisabled]}
                >
                  <Text style={styles.actionChipLabelDanger}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Location (optional)</Text>
        <TextInput
          editable={!isLoading}
          placeholder="Campus location"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.locationText}
          onChangeText={setLocationText}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Tags (optional)</Text>
        <TextInput
          editable={!isLoading}
          placeholder="tag1, tag2"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={state.tagsInput}
          onChangeText={setTagsInput}
        />
      </View>

      {state.imageUploadFailures.length > 0 ? (
        <View style={styles.failureCard}>
          <Text style={styles.failureTitle}>Image Upload Issues</Text>
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
        <Text style={styles.primaryButtonLabel}>{isSubmitting ? "Publishing..." : "Publish"}</Text>
      </Pressable>

      {process.env.NODE_ENV !== "production" && !canSubmit && publishDisabledReason ? (
        <Text style={styles.helperText}>Publish disabled: {publishDisabledReason}</Text>
      ) : null}

      {state.infoMessage ? <Text style={styles.infoText}>{state.infoMessage}</Text> : null}
      {state.createdPostId ? <Text style={styles.metaText}>Post ID: {state.createdPostId}</Text> : null}
      {state.errorMessage ? <Text style={styles.errorText}>{state.errorMessage}</Text> : null}
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
