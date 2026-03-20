import type { DbUserTier, UserProfileRow } from "@foryou/types";

export type ComposeSectionCode = "life" | "study" | "qa" | "fun";
export type StudyDegree = "bachelor" | "master" | "phd";

export type ComposeSectionOption = {
  code: ComposeSectionCode;
  label: string;
  sectionCode: string;
};

export type CategoryOption = {
  slug: string;
  label: string;
  sectionCode: ComposeSectionCode;
};

export type UniversityOption = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
};

export type VerifiedUniversity = {
  id: string;
  slug: string | null;
  name: string | null;
  shortName: string | null;
};

export type ComposeBootstrap = {
  profile: UserProfileRow;
  tier: DbUserTier;
  ownUniversitySlug: string | null;
  universities: UniversityOption[];
};

export type CreatePostInput = {
  sectionCode: string;
  categorySlug: string;
  title: string;
  body: string;
  universitySlug: string | null;
  locationText: string | null;
  tags: string[];
  degree?: StudyDegree | null;
};

export type CreatePostResult = {
  postId: string | null;
  message: string | null;
};

export type ComposeParagraphBlock = {
  id: string;
  type: "paragraph";
  text: string;
};

export type ComposeImageBlock = {
  id: string;
  type: "image";
  localUri?: string;
  imageUrl?: string;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
};

export type ComposeBlock = ComposeParagraphBlock | ComposeImageBlock;

export type SelectedComposeImage = {
  localUri: string;
  fileName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
};

export type UploadedPostImage = {
  storagePath: string;
  imageUrl: string;
  fileName: string;
};

export type ImageUploadFailure = {
  fileName: string;
  localUri: string;
  message: string;
};

export type UploadPostImagesResult = {
  uploaded: UploadedPostImage[];
  failed: ImageUploadFailure[];
};

export type AttachPostImagesResult = {
  attachedCount: number | null;
  message: string | null;
};
