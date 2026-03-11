import type { DbUserTier, UserProfileRow } from "@foryou/types";
import { useEffect, useMemo, useState } from "react";
import {
  pickComposeImages,
  uploadComposeImages
} from "./compose-images.service";
import {
  attachPostImages,
  createPostViaRpc,
  fetchActiveUniversities,
  fetchUniversityById,
  getAccessTier,
  getCategoryOptionsForSection,
  getComposeSectionOptions,
  getDefaultSection,
  getUniversityOptionsForTier,
  isElevatedTier,
  isUniversityRequired,
  isUniversitySelectorDisabled,
  mapCreatePostError,
  normalizeTags,
  parsePostId,
  updatePostBody,
  updatePostMetadata
} from "./compose.service";
import type {
  ComposeBlock,
  CategoryOption,
  ComposeSectionCode,
  ComposeSectionOption,
  ImageUploadFailure,
  SelectedComposeImage,
  UniversityOption,
  VerifiedUniversity
} from "./compose.types";

type ComposeAction = "bootstrapping" | "idle" | "selecting_images" | "submitting";

type ComposeState = {
  action: ComposeAction;
  profile: UserProfileRow | null;
  tier: DbUserTier | null;
  ownUniversitySlug: string | null;
  verifiedUniversity: VerifiedUniversity | null;
  sectionOptions: ComposeSectionOption[];
  categoryOptions: CategoryOption[];
  selectedSectionCode: ComposeSectionCode | null;
  selectedCategorySlug: string | null;
  universityOptions: UniversityOption[];
  selectedUniversitySlug: string | null;
  title: string;
  abstract: string;
  blocks: ComposeBlock[];
  thumbnailBlockId: string | null;
  locationText: string;
  tagsInput: string;
  imageUploadFailures: ImageUploadFailure[];
  errorMessage: string | null;
  infoMessage: string | null;
  createdPostId: string | null;
  createdPostRoute: string | null;
};

const INITIAL_STATE: ComposeState = {
  action: "bootstrapping",
  profile: null,
  tier: null,
  ownUniversitySlug: null,
  verifiedUniversity: null,
  sectionOptions: [],
  categoryOptions: [],
  selectedSectionCode: null,
  selectedCategorySlug: null,
  universityOptions: [],
  selectedUniversitySlug: null,
  title: "",
  abstract: "",
  blocks: [],
  thumbnailBlockId: null,
  locationText: "",
  tagsInput: "",
  imageUploadFailures: [],
  errorMessage: null,
  infoMessage: null,
  createdPostId: null,
  createdPostRoute: null
};

function findOwnUniversitySlug(
  profile: UserProfileRow,
  universities: UniversityOption[]
): string | null {
  const universityId = profile.verified_university_id ?? profile.university_id;

  if (!universityId) {
    return null;
  }

  const ownUniversity = universities.find(
    (university) => university.id === universityId
  );

  return ownUniversity?.slug ?? null;
}

function dedupeImages(images: SelectedComposeImage[]): SelectedComposeImage[] {
  const seen = new Set<string>();

  return images.filter((image) => {
    if (seen.has(image.localUri)) {
      return false;
    }

    seen.add(image.localUri);
    return true;
  });
}

function createBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createParagraphBlock(text = ""): ComposeBlock {
  return {
    id: createBlockId("paragraph"),
    type: "paragraph",
    text
  };
}

function createImageBlock(image: SelectedComposeImage): ComposeBlock {
  return {
    id: createBlockId("image"),
    type: "image",
    localUri: image.localUri,
    fileName: image.fileName,
    mimeType: image.mimeType
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeBlocks(params: {
  blocks: ComposeBlock[];
  imageUrlByLocalUri?: Map<string, string>;
  missingImageFallback?: string;
}): string {
  const { blocks, imageUrlByLocalUri, missingImageFallback } = params;

  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return `<p>${escapeHtml(block.text)}</p>`;
      }

      const localUri = block.localUri ?? null;
      const imageUrl = localUri ? imageUrlByLocalUri?.get(localUri) ?? block.imageUrl : block.imageUrl;

      if (imageUrl) {
        return `<img src="${imageUrl}" />`;
      }

      if (missingImageFallback) {
        return `<p>${escapeHtml(missingImageFallback)}</p>`;
      }

      return `<img data-local-uri="${escapeHtml(localUri ?? "unknown")}" />`;
    })
    .join("\n");
}

function collectImageBlocks(blocks: ComposeBlock[]): SelectedComposeImage[] {
  return blocks.flatMap((block) => {
    if (block.type !== "image") {
      return [];
    }

    if (!block.localUri || !block.fileName || !block.mimeType) {
      return [];
    }

    return [
      {
        localUri: block.localUri,
        fileName: block.fileName,
        mimeType: block.mimeType,
        width: null,
        height: null
      }
    ];
  });
}

export function useComposePost(params?: { profile?: UserProfileRow | null }) {
  const profile = params?.profile ?? null;
  const [state, setState] = useState<ComposeState>(INITIAL_STATE);

  const selectedSection = useMemo(() => {
    return state.sectionOptions.find((section) => section.code === state.selectedSectionCode) ?? null;
  }, [state.sectionOptions, state.selectedSectionCode]);

  const selectedCategory = useMemo(() => {
    return state.categoryOptions.find((category) => category.slug === state.selectedCategorySlug) ?? null;
  }, [state.categoryOptions, state.selectedCategorySlug]);

  const isLoading = state.action !== "idle";
  const isSignedIn = profile !== null;
  const hasVerifiedUniversity = Boolean(
    profile?.verified_university_id ?? profile?.university_id
  );
  const verifiedUniversityId = profile?.verified_university_id ?? null;

  const universityRequired = useMemo(() => {
    if (!state.tier || !state.selectedSectionCode) {
      return false;
    }

    return isUniversityRequired(state.tier, state.selectedSectionCode);
  }, [state.selectedSectionCode, state.tier]);

  const universitySelectorDisabled = useMemo(() => {
    if (!state.selectedSectionCode) {
      return true;
    }

    return isUniversitySelectorDisabled(state.selectedSectionCode);
  }, [state.selectedSectionCode]);

  const universitySelectionLocked = useMemo(() => {
    if (!state.tier || !state.selectedSectionCode) {
      return false;
    }

    if (state.selectedSectionCode === "fun") {
      return false;
    }

    return isElevatedTier(state.tier) && hasVerifiedUniversity;
  }, [hasVerifiedUniversity, state.selectedSectionCode, state.tier]);

  const hasEditorContent = useMemo(() => {
    return state.blocks.some((block) => {
      if (block.type === "paragraph") {
        return block.text.trim().length > 0;
      }

      return Boolean(block.localUri || block.imageUrl);
    });
  }, [state.blocks]);

  const canSubmit = useMemo(() => {
    if (!isSignedIn || isLoading) {
      return false;
    }

    if (!selectedSection) {
      return false;
    }

    if (!state.selectedCategorySlug || !selectedCategory) {
      return false;
    }

    if (!state.title.trim() || !hasEditorContent) {
      return false;
    }

    if (universityRequired && !state.selectedUniversitySlug && !verifiedUniversityId) {
      return false;
    }

    if (!universitySelectorDisabled && !state.selectedUniversitySlug && !verifiedUniversityId) {
      return false;
    }

    return true;
  }, [
    isLoading,
    isSignedIn,
    selectedSection,
    selectedCategory,
    hasEditorContent,
    state.selectedUniversitySlug,
    state.title,
    universityRequired,
    universitySelectorDisabled,
    state.selectedCategorySlug
  ]);

  const publishDisabledReason = useMemo(() => {
    if (!isSignedIn) {
      return "Sign in to create a post.";
    }

    if (!profile) {
      return "Profile is still loading.";
    }

    if (isLoading) {
      return "Composer is loading.";
    }

    if (!selectedSection) {
      return "Select a post type.";
    }

    if (state.categoryOptions.length === 0) {
      return "No categories are available for the selected post type.";
    }

    if (!selectedCategory) {
      return "Select a category.";
    }

    if (!state.title.trim()) {
      return "Title is required.";
    }

    if (!hasEditorContent) {
      return "Add at least one paragraph or image.";
    }

    if (universityRequired && !state.selectedUniversitySlug && !verifiedUniversityId) {
      return "Select a university for this post.";
    }

    if (!universitySelectorDisabled && !state.selectedUniversitySlug && !verifiedUniversityId) {
      if (state.universityOptions.length === 0) {
        return "University list is unavailable. Try again shortly.";
      }

      return "Select a university or switch to FUN.";
    }

    return null;
  }, [
    isLoading,
    isSignedIn,
    profile,
    selectedSection,
    selectedCategory,
    hasEditorContent,
    state.categoryOptions.length,
    state.selectedUniversitySlug,
    state.title,
    universityRequired,
    universitySelectorDisabled,
    verifiedUniversityId
  ]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setState((current) => ({
        ...current,
        action: "bootstrapping",
        errorMessage: null,
        infoMessage: null
      }));

      if (!profile) {
        setState((current) => ({
          ...current,
          action: "idle",
          profile: null,
          tier: null,
          ownUniversitySlug: null,
          sectionOptions: [],
          categoryOptions: [],
          selectedSectionCode: null,
          selectedCategorySlug: null,
          universityOptions: [],
          selectedUniversitySlug: null,
          errorMessage: null
        }));
        return;
      }

      const tier = getAccessTier(profile);
      const sectionOptions = getComposeSectionOptions(tier);
      const defaultSection = getDefaultSection(sectionOptions);
      const selectedSectionCode = defaultSection?.code ?? null;
      const categoryOptions = selectedSectionCode
        ? getCategoryOptionsForSection(selectedSectionCode)
        : [];
      const selectedCategorySlug = categoryOptions[0]?.slug ?? null;

      let universities: UniversityOption[] = [];
      let universityError: string | null = null;
      let verifiedUniversity: VerifiedUniversity | null = null;

      try {
        universities = await fetchActiveUniversities();
      } catch (error) {
        universityError = mapCreatePostError(error);
      }

      if (verifiedUniversityId) {
        try {
          verifiedUniversity = await fetchUniversityById(verifiedUniversityId);
        } catch (error) {
          if (!universityError) {
            universityError = mapCreatePostError(error);
          }
        }
      }

      if (cancelled) {
        return;
      }

      const ownUniversitySlug = verifiedUniversity?.slug ?? findOwnUniversitySlug(profile, universities);
      const universityOptions = getUniversityOptionsForTier(tier, universities, ownUniversitySlug);
      const isFun = selectedSectionCode === "fun";
      const selectedUniversitySlug =
        isFun
          ? null
          : isElevatedTier(tier) && (ownUniversitySlug ?? verifiedUniversityId)
            ? ownUniversitySlug
            : tier === "bronze"
              ? ownUniversitySlug
              : ownUniversitySlug;

      setState((current) => ({
        ...current,
        action: "idle",
        profile,
        tier,
        ownUniversitySlug,
        verifiedUniversity,
        sectionOptions,
        categoryOptions,
        selectedSectionCode,
        selectedCategorySlug,
        universityOptions,
        selectedUniversitySlug,
        blocks: current.blocks.length > 0 ? current.blocks : [createParagraphBlock()],
        errorMessage: universityError,
        infoMessage: null
      }));
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.updated_at]);

  function setTitle(value: string) {
    setState((current) => ({
      ...current,
      title: value,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function setAbstract(value: string) {
    setState((current) => ({
      ...current,
      abstract: value,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function setLocationText(value: string) {
    setState((current) => ({
      ...current,
      locationText: value,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function setTagsInput(value: string) {
    setState((current) => ({
      ...current,
      tagsInput: value,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function selectSection(code: ComposeSectionCode) {
    setState((current) => {
      if (!current.tier) {
        return current;
      }

      const ownUniversitySlug = current.ownUniversitySlug;
      const categoryOptions = getCategoryOptionsForSection(code);
      const selectedCategorySlug = categoryOptions[0]?.slug ?? null;
      const isFun = code === "fun";
      const selectedUniversitySlug = isFun
        ? null
        : isElevatedTier(current.tier) && (ownUniversitySlug ?? current.verifiedUniversity?.id)
          ? ownUniversitySlug
          : current.selectedUniversitySlug ?? ownUniversitySlug;

      return {
        ...current,
        selectedSectionCode: code,
        categoryOptions,
        selectedCategorySlug,
        selectedUniversitySlug,
        errorMessage: null,
        infoMessage: null
      };
    });
  }

  function updateParagraphText(blockId: string, text: string) {
    setState((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId && block.type === "paragraph"
          ? { ...block, text }
          : block
      ),
      errorMessage: null,
      infoMessage: null
    }));
  }

  function insertBlocksAt(index: number, blocks: ComposeBlock[]) {
    setState((current) => {
      const safeIndex = Math.max(0, Math.min(index, current.blocks.length));
      const nextBlocks = [
        ...current.blocks.slice(0, safeIndex),
        ...blocks,
        ...current.blocks.slice(safeIndex)
      ];

      return {
        ...current,
        blocks: nextBlocks,
        errorMessage: null,
        infoMessage: null
      };
    });
  }

  function addParagraphAfter(index: number) {
    insertBlocksAt(index + 1, [createParagraphBlock()]);
  }

  async function insertImageAfter(index: number) {
    if (state.action !== "idle") {
      return;
    }

    setState((current) => ({
      ...current,
      action: "selecting_images",
      errorMessage: null,
      infoMessage: null
    }));

    try {
      const selectedImages = await pickComposeImages([]);
      const uniqueImages = dedupeImages(selectedImages);
      const imageBlocks = uniqueImages.map(createImageBlock);
      insertBlocksAt(index + 1, imageBlocks);
      setState((current) => ({
        ...current,
        action: "idle",
        imageUploadFailures: []
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "idle",
        errorMessage: mapCreatePostError(error)
      }));
    }
  }

  function removeBlock(blockId: string) {
    setState((current) => {
      const nextBlocks = current.blocks.filter((block) => block.id !== blockId);
      return {
        ...current,
        blocks: nextBlocks.length > 0 ? nextBlocks : [createParagraphBlock()],
        thumbnailBlockId: current.thumbnailBlockId === blockId ? null : current.thumbnailBlockId,
        errorMessage: null,
        infoMessage: null
      };
    });
  }

  function selectUniversity(slug: string) {
    setState((current) => ({
      ...current,
      selectedUniversitySlug: slug,
      errorMessage: null,
      infoMessage: null
    }));
  }

  function selectCategory(slug: string) {
    setState((current) => ({
      ...current,
      selectedCategorySlug: slug,
      errorMessage: null,
      infoMessage: null
    }));
  }

  async function submit() {
    if (state.action !== "idle") {
      return;
    }

    if (!state.profile || !state.tier || !selectedSection) {
      setState((current) => ({
        ...current,
        errorMessage: "Sign in and select a valid post type to continue."
      }));
      return;
    }

    if (!state.selectedCategorySlug || !selectedCategory) {
      setState((current) => ({
        ...current,
        errorMessage: "Select a category to continue."
      }));
      return;
    }

    if (!state.title.trim()) {
      setState((current) => ({ ...current, errorMessage: "Title is required." }));
      return;
    }

    if (!hasEditorContent) {
      setState((current) => ({ ...current, errorMessage: "Add at least one paragraph or image." }));
      return;
    }

    if (universityRequired && !state.selectedUniversitySlug && !verifiedUniversityId) {
      setState((current) => ({
        ...current,
        errorMessage: "University selection is required for Bronze Q&A posts."
      }));
      return;
    }

    if (!universitySelectorDisabled && !state.selectedUniversitySlug && !verifiedUniversityId) {
      setState((current) => ({
        ...current,
        errorMessage: "Select a university or switch to FUN."
      }));
      return;
    }

    setState((current) => ({
      ...current,
      action: "submitting",
      errorMessage: null,
      infoMessage: null,
      createdPostId: null,
      createdPostRoute: null,
      imageUploadFailures: []
    }));

    try {
      let resolvedUniversitySlug = state.selectedUniversitySlug;

      if (!universitySelectorDisabled && !resolvedUniversitySlug && verifiedUniversityId) {
        if (state.verifiedUniversity?.slug) {
          resolvedUniversitySlug = state.verifiedUniversity.slug;
        } else {
          const resolved = await fetchUniversityById(verifiedUniversityId);
          resolvedUniversitySlug = resolved?.slug ?? null;
        }
      }

      if (!universitySelectorDisabled && !resolvedUniversitySlug && selectedSection.code !== "fun") {
        throw new Error("Verified university is unavailable. Try again shortly.");
      }

      const draftBody = serializeBlocks({
        blocks: state.blocks,
        missingImageFallback: "[Image pending upload]"
      });

      const postResult = await createPostViaRpc({
        sectionCode: selectedSection.sectionCode,
        categorySlug: state.selectedCategorySlug,
        title: state.title.trim(),
        body: draftBody,
        universitySlug: selectedSection.code === "fun" ? null : resolvedUniversitySlug,
        locationText: state.locationText.trim() || null,
        tags: normalizeTags(state.tagsInput)
      });

      const infoMessages: string[] = [postResult.message ?? "Post created successfully."];
      const postIdNumeric = parsePostId(postResult.postId);
      let uploadFailures: ImageUploadFailure[] = [];
      let finalBody = draftBody;

      if (postIdNumeric) {
        try {
          await updatePostMetadata({
            postId: postIdNumeric,
            abstract: state.abstract.trim() || null
          });
        } catch (error) {
          infoMessages.push(`Post saved, but metadata update failed: ${mapCreatePostError(error)}`);
        }
      }

      const imageUploads = collectImageBlocks(state.blocks);

      if (imageUploads.length > 0) {
        if (!postIdNumeric) {
          infoMessages.push("Post created, but image attachment was skipped due to invalid post ID.");
        } else {
          const uploadResult = await uploadComposeImages({
            postId: postIdNumeric,
            userId: state.profile.id,
            images: imageUploads
          });

          uploadFailures = uploadResult.failed;

          const imageUrlByLocalUri = new Map<string, string>();
          const storagePathByLocalUri = new Map<string, string>();
          uploadResult.uploaded.forEach((uploaded, index) => {
            const source = imageUploads[index];
            if (source?.localUri) {
              imageUrlByLocalUri.set(source.localUri, uploaded.imageUrl);
              storagePathByLocalUri.set(source.localUri, uploaded.storagePath);
            }
          });

          const nextBlocks = state.blocks.map((block) => {
            if (block.type !== "image" || !block.localUri) {
              return block;
            }

            return {
              ...block,
              imageUrl: imageUrlByLocalUri.get(block.localUri) ?? block.imageUrl,
              storagePath: storagePathByLocalUri.get(block.localUri) ?? block.storagePath
            };
          });

          finalBody = serializeBlocks({
            blocks: nextBlocks,
            imageUrlByLocalUri,
            missingImageFallback: "[Image failed to upload]"
          });

          const thumbnailCandidate = getThumbnailCandidate({
            blocks: nextBlocks,
            thumbnailBlockId: state.thumbnailBlockId,
            imageUrlByLocalUri
          });

          if (postIdNumeric) {
            try {
              await updatePostMetadata({
                postId: postIdNumeric,
                thumbnailImageUrl: thumbnailCandidate.imageUrl,
                thumbnailStoragePath: thumbnailCandidate.storagePath
              });
            } catch (error) {
              infoMessages.push(`Post saved, but metadata update failed: ${mapCreatePostError(error)}`);
            }
          }

          if (uploadResult.uploaded.length > 0) {
            try {
              const attachResult = await attachPostImages(postIdNumeric, uploadResult.uploaded);
              if (typeof attachResult.attachedCount === "number") {
                infoMessages.push(`Attached ${attachResult.attachedCount} image(s).`);
              } else if (attachResult.message) {
                infoMessages.push(attachResult.message);
              }
            } catch (error) {
              infoMessages.push(
                `Post created, but failed to attach uploaded images: ${mapCreatePostError(error)}`
              );
            }
          }

          if (uploadFailures.length > 0) {
            infoMessages.push(
              `${uploadFailures.length} image(s) failed to upload. You can retry on your next post.`
            );
          }
        }
      }

      if (postIdNumeric && finalBody !== draftBody) {
        try {
          await updatePostBody(postIdNumeric, finalBody);
        } catch (error) {
          infoMessages.push(`Post saved, but body update failed: ${mapCreatePostError(error)}`);
        }
      }

      setState((current) => ({
        ...current,
        action: "idle",
        title: "",
        abstract: "",
        blocks: [createParagraphBlock()],
        thumbnailBlockId: null,
        locationText: "",
        tagsInput: "",
        imageUploadFailures: uploadFailures,
        createdPostId: postResult.postId,
        createdPostRoute: postResult.postId ? `/posts/${postResult.postId}` : null,
        infoMessage: infoMessages.join(" "),
        errorMessage: null
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        action: "idle",
        errorMessage: mapCreatePostError(error)
      }));
    }
  }

  function selectThumbnail(blockId: string) {
    setState((current) => ({
      ...current,
      thumbnailBlockId: blockId,
      errorMessage: null,
      infoMessage: null
    }));
  }


  return {
    state,
    isSignedIn,
    isLoading,
    canSubmit,
    universityRequired,
    universitySelectorDisabled,
    universitySelectionLocked,
    publishDisabledReason,
    verifiedUniversity: state.verifiedUniversity,
    setTitle,
    setAbstract,
    updateParagraphText,
    setLocationText,
    setTagsInput,
    selectSection,
    selectCategory,
    selectUniversity,
    addParagraphAfter,
    insertImageAfter,
    selectThumbnail,
    removeBlock,
    submit
  };
}
function getThumbnailCandidate(params: {
  blocks: ComposeBlock[];
  thumbnailBlockId: string | null;
  imageUrlByLocalUri?: Map<string, string>;
}): { imageUrl: string | null; storagePath: string | null } {
  const { blocks, thumbnailBlockId, imageUrlByLocalUri } = params;

  const imageBlocks = blocks.filter((block) => block.type === "image");
  const preferred =
    thumbnailBlockId && imageBlocks.find((block) => block.id === thumbnailBlockId);

  const candidate = preferred ?? imageBlocks[0];

  if (!candidate || candidate.type !== "image") {
    return { imageUrl: null, storagePath: null };
  }

  const localUri = candidate.localUri ?? null;
  const imageUrl = localUri ? imageUrlByLocalUri?.get(localUri) ?? candidate.imageUrl : candidate.imageUrl ?? null;

  return {
    imageUrl: imageUrl ?? null,
    storagePath: candidate.storagePath ?? null
  };
}
