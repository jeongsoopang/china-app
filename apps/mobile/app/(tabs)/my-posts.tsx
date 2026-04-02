import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useAuthSession } from "../../src/features/auth/auth-session";
import {
  pickComposeImages,
  uploadComposeImages
} from "../../src/features/compose/compose-images.service";
import {
  getAccessTier,
  getCategoryOptionsForSection,
  getComposeSectionOptions,
  getDefaultSection,
  updatePostMetadata
} from "../../src/features/compose/compose.service";
import type {
  CategoryOption,
  ComposeSectionCode,
  ComposeSectionOption,
  SelectedComposeImage
} from "../../src/features/compose/compose.types";
import { supabase } from "../../src/lib/supabase/client";
import { colors, radius, spacing, typography } from "../../src/ui/theme";

type MyPost = {
  id: number;
  title: string;
  body: string;
  abstract: string | null;
  thumbnailImageUrl: string | null;
  thumbnailStoragePath: string | null;
  sectionCode: ComposeSectionCode | null;
  categorySlug: string | null;
  createdAt: string;
};

type EditDraft = {
  id: number;
  title: string;
  blocks: EditBlock[];
  thumbnailBlockId: string | null;
  selectedSectionCode: ComposeSectionCode | null;
  selectedCategorySlug: string | null;
  sectionOptions: ComposeSectionOption[];
  categoryOptions: CategoryOption[];
};

type EditParagraphBlock = {
  id: string;
  type: "paragraph";
  text: string;
};

type EditImageBlock = {
  id: string;
  type: "image";
  imageUrl?: string;
  storagePath?: string;
  localUri?: string;
  fileName?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
};

type EditBlock = EditParagraphBlock | EditImageBlock;

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

function unescapeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createParagraphBlock(text = ""): EditParagraphBlock {
  return {
    id: createBlockId("paragraph"),
    type: "paragraph",
    text
  };
}

function parseBodyToBlocks(body: string): EditBlock[] {
  const source = body ?? "";
  const blocks: EditBlock[] = [];
  const pattern = /<p>(.*?)<\/p>|<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gis;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    if (match[1] !== undefined) {
      const text = unescapeHtml(match[1]).trim();
      blocks.push(createParagraphBlock(text));
      continue;
    }

    const imageUrl = match[2];
    if (imageUrl) {
      blocks.push({
        id: createBlockId("image"),
        type: "image",
        imageUrl
      });
    }
  }

  if (blocks.length > 0) {
    return blocks;
  }

  const textOnly = stripBodyPreview(source);
  return [createParagraphBlock(textOnly)];
}

function serializeBlocksToBody(params: {
  blocks: EditBlock[];
  imageUrlByLocalUri?: Map<string, string>;
}): string {
  const { blocks, imageUrlByLocalUri } = params;

  return blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return `<p>${escapeHtml(block.text)}</p>`;
      }

      const localUri = block.localUri ?? null;
      const imageUrl = localUri ? imageUrlByLocalUri?.get(localUri) ?? block.imageUrl : block.imageUrl;

      if (!imageUrl) {
        return "";
      }

      return `<img src="${imageUrl}" />`;
    })
    .filter((chunk) => chunk.length > 0)
    .join("\n");
}

function dedupeSelectedImages(images: SelectedComposeImage[]): SelectedComposeImage[] {
  const seen = new Set<string>();

  return images.filter((image) => {
    if (seen.has(image.localUri)) {
      return false;
    }

    seen.add(image.localUri);
    return true;
  });
}

function collectLocalImages(blocks: EditBlock[]): SelectedComposeImage[] {
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
        width: block.width ?? null,
        height: block.height ?? null
      }
    ];
  });
}

function hasEditableContent(blocks: EditBlock[]): boolean {
  return blocks.some((block) => {
    if (block.type === "paragraph") {
      return block.text.trim().length > 0;
    }

    return Boolean(block.imageUrl || block.localUri);
  });
}

function mapErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
}

function getThumbnailCandidate(params: {
  blocks: EditBlock[];
  thumbnailBlockId: string | null;
  imageUrlByLocalUri?: Map<string, string>;
  storagePathByLocalUri?: Map<string, string>;
  storagePathByImageUrl?: Map<string, string>;
}): { imageUrl: string | null; storagePath: string | null } {
  const {
    blocks,
    thumbnailBlockId,
    imageUrlByLocalUri,
    storagePathByLocalUri,
    storagePathByImageUrl
  } = params;

  const imageBlocks = blocks.filter((block) => block.type === "image");
  const preferred =
    thumbnailBlockId && imageBlocks.find((block) => block.id === thumbnailBlockId);
  const candidate = preferred ?? imageBlocks[0];

  if (!candidate || candidate.type !== "image") {
    return {
      imageUrl: null,
      storagePath: null
    };
  }

  const localUri = candidate.localUri ?? null;
  const imageUrl = localUri
    ? imageUrlByLocalUri?.get(localUri) ?? candidate.imageUrl ?? null
    : candidate.imageUrl ?? null;
  const storagePath = localUri
    ? storagePathByLocalUri?.get(localUri) ??
      candidate.storagePath ??
      (imageUrl ? storagePathByImageUrl?.get(imageUrl) ?? null : null)
    : candidate.storagePath ?? (imageUrl ? storagePathByImageUrl?.get(imageUrl) ?? null : null);

  return {
    imageUrl,
    storagePath
  };
}

function buildAbstractFromBody(body: string): string | null {
  const summary = stripBodyPreview(body);

  if (summary.length === 0) {
    return null;
  }

  if (summary.length > 140) {
    return `${summary.slice(0, 137)}...`;
  }

  return summary;
}

function buildFinalPostImageRows(params: {
  postId: number;
  blocks: EditBlock[];
  imageUrlByLocalUri: Map<string, string>;
  storagePathByLocalUri: Map<string, string>;
  existingImageRows: Array<{ image_url: string; storage_path: string }>;
}): {
  rows: Array<{
    post_id: number;
    image_url: string;
    storage_path: string;
    sort_order: number;
  }>;
  unresolvedImageUrls: string[];
} {
  const { postId, blocks, imageUrlByLocalUri, storagePathByLocalUri, existingImageRows } = params;
  const existingStoragePathsByImageUrl = new Map<string, string[]>();

  existingImageRows.forEach((row) => {
    const queue = existingStoragePathsByImageUrl.get(row.image_url) ?? [];
    queue.push(row.storage_path);
    existingStoragePathsByImageUrl.set(row.image_url, queue);
  });

  const rows: Array<{
    post_id: number;
    image_url: string;
    storage_path: string;
    sort_order: number;
  }> = [];
  const unresolvedImageUrls = new Set<string>();

  blocks.forEach((block) => {
    if (block.type !== "image") {
      return;
    }

    const localUri = block.localUri ?? null;
    const imageUrl = localUri
      ? imageUrlByLocalUri.get(localUri) ?? block.imageUrl ?? null
      : block.imageUrl ?? null;

    if (!imageUrl) {
      return;
    }

    let storagePath = localUri
      ? storagePathByLocalUri.get(localUri) ?? block.storagePath ?? null
      : block.storagePath ?? null;

    if (!storagePath) {
      const queue = existingStoragePathsByImageUrl.get(imageUrl);
      if (queue && queue.length > 0) {
        storagePath = queue.shift() ?? null;
      }
    }

    if (!storagePath) {
      unresolvedImageUrls.add(imageUrl);
      return;
    }

    rows.push({
      post_id: postId,
      image_url: imageUrl,
      storage_path: storagePath,
      sort_order: rows.length
    });
  });

  return {
    rows,
    unresolvedImageUrls: [...unresolvedImageUrls]
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function normalizeComposeSectionCode(value: string | null | undefined): ComposeSectionCode | null {
  if (value === "life" || value === "study" || value === "qa" || value === "fun") {
    return value;
  }

  return null;
}

function getSectionLabel(code: ComposeSectionCode): string {
  if (code === "life") {
    return "School";
  }
  if (code === "study") {
    return "Study";
  }
  if (code === "qa") {
    return "Q&A";
  }

  return "Shanghai";
}

export default function MyPostsScreen() {
  const auth = useAuthSession();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isPickingImages, setIsPickingImages] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [imageLoadStateByBlockId, setImageLoadStateByBlockId] = useState<
    Record<string, "loading" | "loaded" | "error">
  >({});

  const authUserId = auth.user?.authUser.id ?? null;
  const authProfile = auth.user?.profile ?? null;
  const accessTier = useMemo(() => {
    if (!authProfile) {
      return null;
    }

    return getAccessTier(authProfile);
  }, [authProfile]);
  const baseSectionOptions = useMemo<ComposeSectionOption[]>(() => {
    if (!accessTier) {
      return [];
    }

    return getComposeSectionOptions(accessTier);
  }, [accessTier]);
  const resolvedReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const safeReturnTo = resolvedReturnTo ?? "/me";
  const currentPageReturnTo = `/my-posts?returnTo=${encodeURIComponent(safeReturnTo)}`;

  const loadPosts = useCallback(async () => {
    setErrorMessage(null);
    setPosts([]);

    if (!authUserId) {
      return;
    }

    setIsLoading(true);

    const attemptWithMetadata = async () => {
      return supabase
        .from("posts")
        .select(
          "id, title, body, abstract, thumbnail_image_url, thumbnail_storage_path, created_at, sections ( code ), categories ( slug )"
        )
        .eq("author_id", authUserId)
        .order("created_at", { ascending: false });
    };

    const attemptWithoutMetadata = async () => {
      return supabase
        .from("posts")
        .select("id, title, body, created_at, sections ( code ), categories ( slug )")
        .eq("author_id", authUserId)
        .order("created_at", { ascending: false });
    };

    let data: unknown = null;
    let error: { message: string } | null = null;

    const withMetadata = await attemptWithMetadata();
    data = withMetadata.data;
    error = withMetadata.error ? { message: withMetadata.error.message } : null;

    if (
      error &&
      /column/i.test(error.message) &&
      /abstract|thumbnail_image_url|thumbnail_storage_path/i.test(error.message)
    ) {
      const withoutMetadata = await attemptWithoutMetadata();
      data = withoutMetadata.data;
      error = withoutMetadata.error ? { message: withoutMetadata.error.message } : null;
    }

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as Array<{
      id: number;
      title: string;
      body: string;
      abstract?: string | null;
      thumbnail_image_url?: string | null;
      thumbnail_storage_path?: string | null;
      sections?: { code: string | null } | null;
      categories?: { slug: string | null } | null;
      created_at: string;
    }>;

    setPosts(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        abstract: typeof row.abstract === "string" ? row.abstract : null,
        thumbnailImageUrl:
          typeof row.thumbnail_image_url === "string" ? row.thumbnail_image_url : null,
        thumbnailStoragePath:
          typeof row.thumbnail_storage_path === "string" ? row.thumbnail_storage_path : null,
        sectionCode: normalizeComposeSectionCode(row.sections?.code ?? null),
        categorySlug: typeof row.categories?.slug === "string" ? row.categories.slug : null,
        createdAt: row.created_at
      }))
    );
    setIsLoading(false);
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      void loadPosts();
    }, [loadPosts])
  );

  useEffect(() => {
    if (!editDraft) {
      setImageLoadStateByBlockId({});
      return;
    }

    const initialState: Record<string, "loading" | "loaded" | "error"> = {};
    const remoteUris = new Set<string>();

    editDraft.blocks.forEach((block) => {
      if (block.type !== "image") {
        return;
      }

      if (block.localUri) {
        initialState[block.id] = "loaded";
        return;
      }

      if (block.imageUrl) {
        initialState[block.id] = "loading";
        remoteUris.add(block.imageUrl);
      }
    });

    setImageLoadStateByBlockId(initialState);

    remoteUris.forEach((uri) => {
      void Image.prefetch(uri);
    });
  }, [editDraft]);

  const isSignedIn = auth.isSignedIn && auth.user;

  const canSaveEdit = useMemo(() => {
    return Boolean(
      editDraft &&
        editDraft.title.trim().length > 0 &&
        editDraft.selectedSectionCode &&
        editDraft.selectedCategorySlug &&
        hasEditableContent(editDraft.blocks) &&
        !isSavingEdit &&
        !isPickingImages
    );
  }, [editDraft, isPickingImages, isSavingEdit]);

  const isEditingBusy = isSavingEdit || isPickingImages;

  function openEditDraft(post: MyPost) {
    if (!authProfile || !accessTier) {
      setErrorMessage("프로필 정보를 확인한 뒤 다시 시도해 주세요.");
      return;
    }

    const blocks = parseBodyToBlocks(post.body);
    const firstImage = blocks.find((block) => block.type === "image");
    const defaultSectionCode = getDefaultSection(baseSectionOptions)?.code ?? null;
    const selectedSectionCode = post.sectionCode ?? defaultSectionCode;

    const sectionOptions = [...baseSectionOptions];
    if (
      selectedSectionCode &&
      !sectionOptions.some((option) => option.code === selectedSectionCode)
    ) {
      sectionOptions.unshift({
        code: selectedSectionCode,
        label: `${getSectionLabel(selectedSectionCode)} (현재)`,
        sectionCode: selectedSectionCode
      });
    }

    const baseCategoryOptions = selectedSectionCode
      ? getCategoryOptionsForSection(selectedSectionCode, accessTier, authProfile)
      : [];
    const categoryOptions = [...baseCategoryOptions];
    if (
      selectedSectionCode &&
      post.categorySlug &&
      !categoryOptions.some((option) => option.slug === post.categorySlug)
    ) {
      categoryOptions.unshift({
        slug: post.categorySlug,
        label: `${post.categorySlug} (현재)`,
        sectionCode: selectedSectionCode
      });
    }

    const selectedCategorySlug =
      post.categorySlug && categoryOptions.some((option) => option.slug === post.categorySlug)
        ? post.categorySlug
        : categoryOptions[0]?.slug ?? null;

    setEditDraft({
      id: post.id,
      title: post.title,
      blocks,
      thumbnailBlockId: firstImage?.id ?? null,
      selectedSectionCode,
      selectedCategorySlug,
      sectionOptions,
      categoryOptions
    });
  }

  function selectEditSection(code: ComposeSectionCode) {
    if (!authProfile || !accessTier) {
      return;
    }

    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      const categoryOptions = getCategoryOptionsForSection(code, accessTier, authProfile);
      return {
        ...current,
        selectedSectionCode: code,
        categoryOptions,
        selectedCategorySlug: categoryOptions[0]?.slug ?? null
      };
    });
  }

  function selectEditCategory(slug: string) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        selectedCategorySlug: slug
      };
    });
  }

  function updateParagraphBlock(blockId: string, text: string) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        blocks: current.blocks.map((block) =>
          block.id === blockId && block.type === "paragraph" ? { ...block, text } : block
        )
      };
    });
  }

  function addParagraphBlock() {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        blocks: [...current.blocks, createParagraphBlock()]
      };
    });
  }

  function removeEditBlock(blockId: string) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      const nextBlocks = current.blocks.filter((block) => block.id !== blockId);
      return {
        ...current,
        blocks: nextBlocks.length > 0 ? nextBlocks : [createParagraphBlock()],
        thumbnailBlockId:
          current.thumbnailBlockId === blockId ? null : current.thumbnailBlockId
      };
    });
  }

  function selectThumbnailBlock(blockId: string) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        thumbnailBlockId: blockId
      };
    });
  }

  async function insertEditImages() {
    if (!editDraft || isEditingBusy) {
      return;
    }

    setErrorMessage(null);
    setIsPickingImages(true);

    try {
      const selected = await pickComposeImages([]);
      const unique = dedupeSelectedImages(selected);

      if (unique.length === 0) {
        setIsPickingImages(false);
        return;
      }

      const nextImageBlocks: EditImageBlock[] = unique.map((image) => ({
        id: createBlockId("image"),
        type: "image",
        localUri: image.localUri,
        fileName: image.fileName,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height
      }));

      setEditDraft((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          blocks: [...current.blocks, ...nextImageBlocks]
        };
      });
      setIsPickingImages(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "이미지를 선택할 수 없습니다.");
      setIsPickingImages(false);
    }
  }

  async function saveEdit() {
    if (!editDraft || !authUserId || !canSaveEdit) {
      return;
    }

    setErrorMessage(null);
    setIsSavingEdit(true);

    const localImages = collectLocalImages(editDraft.blocks);
    const imageUrlByLocalUri = new Map<string, string>();
    const storagePathByLocalUri = new Map<string, string>();

    if (localImages.length > 0) {
      const uploadResult = await uploadComposeImages({
        postId: editDraft.id,
        userId: authUserId,
        images: localImages
      });

      uploadResult.uploaded.forEach((uploaded) => {
        imageUrlByLocalUri.set(uploaded.localUri, uploaded.imageUrl);
        storagePathByLocalUri.set(uploaded.localUri, uploaded.storagePath);
      });

      if (uploadResult.failed.length > 0) {
        setErrorMessage(
          `이미지 ${uploadResult.failed.length}개 업로드에 실패했습니다. 다시 시도해 주세요.`
        );
        setIsSavingEdit(false);
        return;
      }
    }

    const finalBody = serializeBlocksToBody({
      blocks: editDraft.blocks,
      imageUrlByLocalUri
    });

    if (!finalBody.trim()) {
      setErrorMessage("내용을 입력해 주세요.");
      setIsSavingEdit(false);
      return;
    }

    if (!editDraft.selectedSectionCode || !editDraft.selectedCategorySlug) {
      setErrorMessage("섹션과 카테고리를 선택해 주세요.");
      setIsSavingEdit(false);
      return;
    }

    const { data: sectionRow, error: sectionError } = await supabase
      .from("sections")
      .select("id")
      .eq("code", editDraft.selectedSectionCode)
      .maybeSingle();

    if (sectionError || !sectionRow?.id) {
      setErrorMessage("섹션 정보를 확인할 수 없습니다.");
      setIsSavingEdit(false);
      return;
    }

    const resolvedSectionIdRaw = sectionRow.id;
    const resolvedSectionId = String(sectionRow.id);

    const { data: categoryRow, error: categoryError } = await supabase
      .from("categories")
      .select("id, section_id")
      .eq("slug", editDraft.selectedCategorySlug)
      .eq("section_id", resolvedSectionIdRaw)
      .maybeSingle();

    if (categoryError || !categoryRow?.id) {
      setErrorMessage("카테고리 정보를 확인할 수 없습니다.");
      setIsSavingEdit(false);
      return;
    }

    const resolvedCategoryId = String(categoryRow.id);

    const { data: existingPostImages, error: existingPostImagesError } = await supabase
      .from("post_images")
      .select("id, image_url, storage_path, sort_order")
      .eq("post_id", editDraft.id)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (existingPostImagesError) {
      setErrorMessage(mapErrorMessage(existingPostImagesError));
      setIsSavingEdit(false);
      return;
    }

    const existingImageRows = (existingPostImages ?? []) as Array<{
      id: number;
      image_url: string;
      storage_path: string;
      sort_order: number;
    }>;

    const { rows: finalPostImageRows, unresolvedImageUrls } = buildFinalPostImageRows({
      postId: editDraft.id,
      blocks: editDraft.blocks,
      imageUrlByLocalUri,
      storagePathByLocalUri,
      existingImageRows
    });

    if (unresolvedImageUrls.length > 0) {
      setErrorMessage("일부 이미지 정보를 확인할 수 없어 저장할 수 없습니다.");
      setIsSavingEdit(false);
      return;
    }

    const { error } = await supabase
      .from("posts")
      .update({
        title: editDraft.title.trim(),
        body: finalBody,
        section_id: resolvedSectionId,
        category_id: resolvedCategoryId
      })
      .eq("id", editDraft.id)
      .eq("author_id", authUserId);

    if (error) {
      setErrorMessage(error.message);
      setIsSavingEdit(false);
      return;
    }

    const { error: deletePostImagesError } = await supabase
      .from("post_images")
      .delete()
      .eq("post_id", editDraft.id);

    if (deletePostImagesError) {
      setErrorMessage(mapErrorMessage(deletePostImagesError));
      setIsSavingEdit(false);
      return;
    }

    if (finalPostImageRows.length > 0) {
      const { error: insertPostImagesError } = await supabase
        .from("post_images")
        .insert(finalPostImageRows);

      if (insertPostImagesError) {
        if (existingImageRows.length > 0) {
          await supabase.from("post_images").insert(
            existingImageRows.map((row) => ({
              post_id: editDraft.id,
              image_url: row.image_url,
              storage_path: row.storage_path,
              sort_order: row.sort_order
            }))
          );
        }

        setErrorMessage(mapErrorMessage(insertPostImagesError));
        setIsSavingEdit(false);
        return;
      }
    }

    const storagePathByImageUrl = new Map<string, string>();
    finalPostImageRows.forEach((row) => {
      if (!storagePathByImageUrl.has(row.image_url)) {
        storagePathByImageUrl.set(row.image_url, row.storage_path);
      }
    });

    const thumbnailCandidate = getThumbnailCandidate({
      blocks: editDraft.blocks,
      thumbnailBlockId: editDraft.thumbnailBlockId,
      imageUrlByLocalUri,
      storagePathByLocalUri,
      storagePathByImageUrl
    });

    try {
      await updatePostMetadata({
        postId: editDraft.id,
        abstract: buildAbstractFromBody(finalBody),
        thumbnailImageUrl: thumbnailCandidate.imageUrl,
        thumbnailStoragePath: thumbnailCandidate.storagePath
      });
    } catch {
      setErrorMessage("글은 저장되었지만 썸네일 동기화에 실패했습니다.");
    }

    setEditDraft(null);
    setIsSavingEdit(false);
    await loadPosts();
  }

  async function deletePost(postId: number) {
    if (!authUserId || isDeleting !== null) {
      return;
    }

    setIsDeleting(postId);
    setErrorMessage(null);

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("author_id", authUserId);

    if (error) {
      setErrorMessage(error.message);
      setIsDeleting(null);
      return;
    }

    setIsDeleting(null);
    await loadPosts();
  }

  function confirmDelete(postId: number) {
    Alert.alert("글 삭제", "이 글을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => {
          void deletePost(postId);
        }
      }
    ]);
  }

  if (auth.isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>내가 쓴 글</Text>
        <Text style={styles.metaText}>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.title}>내가 쓴 글</Text>
        <Text style={styles.metaText}>Sign in required.</Text>
        <Link asChild href="/auth/sign-in">
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>Sign In</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>내가 쓴 글</Text>

        {isLoading ? <Text style={styles.metaText}>Loading posts...</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {!isLoading && posts.length === 0 && !errorMessage ? (
          <Text style={styles.metaText}>작성한 글이 없습니다.</Text>
        ) : null}

        {posts.map((post) => {
          const preview = stripBodyPreview(post.body);
          const deleting = isDeleting === post.id;

          return (
            <View key={post.id} style={styles.postCard}>
              <Link
                asChild
                href={{
                  pathname: "/posts/[postId]",
                  params: {
                    postId: String(post.id),
                    returnTo: currentPageReturnTo
                  }
                }}
              >
                <Pressable>
                  <Text style={styles.postTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                  {preview ? (
                    <Text style={styles.postPreview} numberOfLines={3}>
                      {preview}
                    </Text>
                  ) : null}
                </Pressable>
              </Link>

              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openEditDraft(post)}
                >
                  <Text style={styles.secondaryButtonLabel}>수정</Text>
                </Pressable>
                <Pressable
                  style={[styles.deleteButton, deleting && styles.buttonDisabled]}
                  onPress={() => confirmDelete(post.id)}
                  disabled={deleting}
                >
                  <Text style={styles.deleteButtonLabel}>{deleting ? "삭제 중..." : "삭제"}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={Boolean(editDraft)} transparent animationType="fade" onRequestClose={() => setEditDraft(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEditDraft(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalTitle}>글 수정</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>제목</Text>
                <TextInput
                  value={editDraft?.title ?? ""}
                  onChangeText={(value) =>
                    setEditDraft((current) => (current ? { ...current, title: value } : current))
                  }
                  style={styles.fieldInput}
                  placeholder="제목"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>섹션</Text>
                <View style={styles.selectorRow}>
                  {editDraft?.sectionOptions.map((option) => {
                    const isSelected = editDraft.selectedSectionCode === option.code;
                    return (
                      <Pressable
                        key={`edit-section-${option.code}`}
                        style={[styles.selectorChip, isSelected ? styles.selectorChipSelected : null]}
                        onPress={() => selectEditSection(option.code)}
                      >
                        <Text
                          style={[styles.selectorChipLabel, isSelected ? styles.selectorChipLabelSelected : null]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>카테고리</Text>
                <View style={styles.selectorRow}>
                  {editDraft?.categoryOptions.map((option) => {
                    const isSelected = editDraft.selectedCategorySlug === option.slug;
                    return (
                      <Pressable
                        key={`edit-category-${option.slug}`}
                        style={[styles.selectorChip, isSelected ? styles.selectorChipSelected : null]}
                        onPress={() => selectEditCategory(option.slug)}
                      >
                        <Text
                          style={[styles.selectorChipLabel, isSelected ? styles.selectorChipLabelSelected : null]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>내용 블록</Text>
                {editDraft?.blocks.map((block, index) => {
                  if (block.type === "paragraph") {
                    return (
                      <View key={block.id} style={styles.blockCard}>
                        <Text style={styles.blockLabel}>문단 {index + 1}</Text>
                        <TextInput
                          value={block.text}
                          onChangeText={(value) => updateParagraphBlock(block.id, value)}
                          style={[styles.fieldInput, styles.bodyInput]}
                          placeholder="내용을 입력하세요."
                          placeholderTextColor={colors.textMuted}
                          multiline
                          textAlignVertical="top"
                        />
                        <View style={styles.blockActionRow}>
                          <Pressable
                            style={styles.secondaryButton}
                            onPress={() => removeEditBlock(block.id)}
                          >
                            <Text style={styles.secondaryButtonLabel}>블록 삭제</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }

                  const imageUri = block.localUri ?? block.imageUrl ?? "";
                  const isThumbnail = editDraft?.thumbnailBlockId === block.id;
                  const loadState =
                    imageLoadStateByBlockId[block.id] ?? (block.localUri ? "loaded" : "loading");
                  const isImageReady = loadState === "loaded";

                  return (
                    <View key={block.id} style={styles.blockCard}>
                      <Text style={styles.blockLabel}>이미지 {index + 1}</Text>
                      {imageUri.length > 0 ? (
                        <View style={styles.imagePreviewContainer}>
                          {!isImageReady ? (
                            <View style={styles.imagePreviewPlaceholder}>
                              <Text style={styles.imagePreviewPlaceholderLabel}>
                                {loadState === "error"
                                  ? "이미지를 불러올 수 없습니다."
                                  : "이미지 불러오는 중..."}
                              </Text>
                            </View>
                          ) : null}
                          <Image
                            source={{ uri: imageUri }}
                            style={[styles.imagePreview, !isImageReady && styles.imagePreviewHidden]}
                            resizeMode="cover"
                            onLoadStart={() =>
                              setImageLoadStateByBlockId((current) => ({
                                ...current,
                                [block.id]: "loading"
                              }))
                            }
                            onLoadEnd={() =>
                              setImageLoadStateByBlockId((current) => ({
                                ...current,
                                [block.id]: "loaded"
                              }))
                            }
                            onError={() =>
                              setImageLoadStateByBlockId((current) => ({
                                ...current,
                                [block.id]: "error"
                              }))
                            }
                          />
                        </View>
                      ) : (
                        <Text style={styles.metaText}>이미지 미리보기를 불러올 수 없습니다.</Text>
                      )}
                      <Text style={styles.metaText}>
                        {block.localUri ? "새 이미지 (저장 시 업로드)" : "기존 이미지"}
                      </Text>
                      <View style={styles.blockActionRow}>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => selectThumbnailBlock(block.id)}
                        >
                          <Text style={styles.secondaryButtonLabel}>
                            {isThumbnail ? "썸네일 선택됨" : "썸네일 선택"}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => removeEditBlock(block.id)}
                        >
                          <Text style={styles.secondaryButtonLabel}>블록 삭제</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.insertRow}>
                  <Pressable style={styles.secondaryButton} onPress={addParagraphBlock}>
                    <Text style={styles.secondaryButtonLabel}>문단 추가</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.secondaryButton, isEditingBusy && styles.buttonDisabled]}
                    onPress={() => {
                      void insertEditImages();
                    }}
                    disabled={isEditingBusy}
                  >
                    <Text style={styles.secondaryButtonLabel}>
                      {isPickingImages ? "이미지 선택 중..." : "이미지 추가"}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.modalActionRow}>
                <Pressable style={styles.secondaryButton} onPress={() => setEditDraft(null)}>
                  <Text style={styles.secondaryButtonLabel}>취소</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, !canSaveEdit && styles.buttonDisabled]}
                  disabled={!canSaveEdit}
                  onPress={() => {
                    void saveEdit();
                  }}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {isSavingEdit ? "저장 중..." : "저장"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  centeredContainer: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  title: {
    fontSize: typography.titleLarge,
    fontWeight: "700",
    color: colors.textPrimary
  },
  metaText: {
    fontSize: typography.bodySmall,
    color: colors.textMuted
  },
  errorText: {
    fontSize: typography.bodySmall,
    color: colors.error
  },
  postCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm
  },
  postTitle: {
    fontSize: typography.body,
    fontWeight: "700",
    color: colors.textPrimary
  },
  postDate: {
    marginTop: 4,
    fontSize: typography.caption,
    color: colors.textMuted
  },
  postPreview: {
    marginTop: 4,
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  primaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 11,
    paddingHorizontal: 14,
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
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: typography.bodySmall
  },
  deleteButton: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#f2bcbc",
    backgroundColor: "#fff6f6",
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  deleteButtonLabel: {
    color: colors.error,
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
  modalCard: {
    maxHeight: "90%",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md
  },
  modalTitle: {
    fontSize: typography.subtitle,
    fontWeight: "700",
    color: colors.textPrimary
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textMuted
  },
  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  selectorChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  selectorChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent
  },
  selectorChipLabel: {
    fontSize: typography.caption,
    fontWeight: "600",
    color: colors.textPrimary
  },
  selectorChipLabelSelected: {
    color: "#f8fafc"
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: typography.body,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bodyInput: {
    minHeight: 120
  },
  blockCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm
  },
  blockLabel: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.textMuted
  },
  blockActionRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.border
  },
  imagePreviewContainer: {
    width: "100%",
    height: 180
  },
  imagePreviewHidden: {
    opacity: 0
  },
  imagePreviewPlaceholder: {
    position: "absolute",
    inset: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1
  },
  imagePreviewPlaceholderLabel: {
    fontSize: typography.caption,
    color: colors.textMuted
  },
  insertRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  modalScroll: {
    maxHeight: "100%"
  },
  modalScrollContent: {
    gap: spacing.md
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm
  }
});
