import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { supabase } from "../../lib/supabase/client";
import type {
  ImageUploadFailure,
  SelectedComposeImage,
  UploadComposeThumbnailResult,
  UploadPostImagesResult,
  UploadedPostImage
} from "./compose.types";

const POST_IMAGES_BUCKET = "post-images";
const COMPOSE_UPLOAD_MAX_LONG_EDGE = 1600;
const COMPOSE_UPLOAD_COMPRESS = 0.82;
const COMPOSE_THUMBNAIL_MAX_LONG_EDGE = 640;
const COMPOSE_THUMBNAIL_COMPRESS = 0.72;
const CACHE_CONTROL_ONE_YEAR_SECONDS = "31536000";

function inferFileExtension(image: SelectedComposeImage): string {
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

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function createStoragePath(postId: number, userId: string, image: SelectedComposeImage, index: number): string {
  const timestamp = Date.now();
  const extension = inferFileExtension(image);
  const safeUserId = sanitizeSegment(userId);

  return `${safeUserId}/${postId}/${timestamp}-${index}.${extension}`;
}

function createThumbnailStoragePath(
  postId: number,
  userId: string,
  image: SelectedComposeImage,
  index: number
): string {
  const timestamp = Date.now();
  const extension = inferFileExtension(image);
  const safeUserId = sanitizeSegment(userId);

  return `${safeUserId}/${postId}/thumbs/${timestamp}-${index}-thumb.${extension}`;
}

function toSelectedImage(asset: ImagePicker.ImagePickerAsset): SelectedComposeImage {
  const fallbackName = `image-${Date.now()}.jpg`;

  return {
    localUri: asset.uri,
    fileName: asset.fileName ?? fallbackName,
    mimeType: asset.mimeType ?? "image/jpeg",
    width: typeof asset.width === "number" ? asset.width : null,
    height: typeof asset.height === "number" ? asset.height : null
  };
}

function replaceFileExtension(fileName: string, nextExtension: string): string {
  const extensionPattern = /\.[a-z0-9]+$/i;
  if (extensionPattern.test(fileName)) {
    return fileName.replace(extensionPattern, `.${nextExtension}`);
  }

  return `${fileName}.${nextExtension}`;
}

async function optimizeComposeImageForUpload(
  image: SelectedComposeImage
): Promise<SelectedComposeImage> {
  if (Platform.OS === "web") {
    return image;
  }

  const width = typeof image.width === "number" ? image.width : null;
  const height = typeof image.height === "number" ? image.height : null;

  if (!width || !height || width <= 0 || height <= 0) {
    return image;
  }

  const longEdge = Math.max(width, height);
  if (longEdge <= COMPOSE_UPLOAD_MAX_LONG_EDGE) {
    return image;
  }

  const scale = COMPOSE_UPLOAD_MAX_LONG_EDGE / longEdge;
  const resizedWidth = Math.max(1, Math.round(width * scale));
  const resizedHeight = Math.max(1, Math.round(height * scale));
  const usePng = image.mimeType.toLowerCase().includes("png");
  const format = usePng ? SaveFormat.PNG : SaveFormat.JPEG;
  const nextMimeType = usePng ? "image/png" : "image/jpeg";
  const nextExtension = usePng ? "png" : "jpg";

  const resized = await manipulateAsync(
    image.localUri,
    [{ resize: { width: resizedWidth, height: resizedHeight } }],
    { compress: COMPOSE_UPLOAD_COMPRESS, format }
  );

  return {
    ...image,
    localUri: resized.uri,
    fileName: replaceFileExtension(image.fileName, nextExtension),
    mimeType: nextMimeType,
    width: resized.width,
    height: resized.height
  };
}

async function optimizeComposeThumbnailForUpload(
  image: SelectedComposeImage
): Promise<SelectedComposeImage> {
  if (Platform.OS === "web") {
    return image;
  }

  const width = typeof image.width === "number" ? image.width : null;
  const height = typeof image.height === "number" ? image.height : null;

  if (!width || !height || width <= 0 || height <= 0) {
    return image;
  }

  const longEdge = Math.max(width, height);
  if (longEdge <= COMPOSE_THUMBNAIL_MAX_LONG_EDGE) {
    return image;
  }

  const scale = COMPOSE_THUMBNAIL_MAX_LONG_EDGE / longEdge;
  const resizedWidth = Math.max(1, Math.round(width * scale));
  const resizedHeight = Math.max(1, Math.round(height * scale));
  const usePng = image.mimeType.toLowerCase().includes("png");
  const format = usePng ? SaveFormat.PNG : SaveFormat.JPEG;
  const nextMimeType = usePng ? "image/png" : "image/jpeg";
  const nextExtension = usePng ? "png" : "jpg";

  const resized = await manipulateAsync(
    image.localUri,
    [{ resize: { width: resizedWidth, height: resizedHeight } }],
    { compress: COMPOSE_THUMBNAIL_COMPRESS, format }
  );

  return {
    ...image,
    localUri: resized.uri,
    fileName: replaceFileExtension(image.fileName, nextExtension),
    mimeType: nextMimeType,
    width: resized.width,
    height: resized.height
  };
}

export async function pickComposeImages(
  current: SelectedComposeImage[]
): Promise<SelectedComposeImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Media library permission is required to select images.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    allowsMultipleSelection: true,
    quality: 1,
    selectionLimit: 8
  });

  if (result.canceled) {
    return current;
  }

  const selected = result.assets.map(toSelectedImage);
  return [...current, ...selected];
}

async function uploadSingleImage(params: {
  postId: number;
  userId: string;
  image: SelectedComposeImage;
  index: number;
}): Promise<{ uploaded?: UploadedPostImage; failed?: ImageUploadFailure }> {
  const { postId, userId, image, index } = params;

  try {
    const optimizedImage = await optimizeComposeImageForUpload(image);
    const data = await readImageData(optimizedImage);

    const storagePath = createStoragePath(postId, userId, optimizedImage, index);

    const uploadResult = await supabase.storage
      .from(POST_IMAGES_BUCKET)
      .upload(storagePath, data, {
        contentType: optimizedImage.mimeType,
        cacheControl: CACHE_CONTROL_ONE_YEAR_SECONDS,
        upsert: false
      });

    if (uploadResult.error) {
      return {
        failed: {
          fileName: image.fileName,
          localUri: image.localUri,
          message: uploadResult.error.message
        }
      };
    }

    const publicUrlResult = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(storagePath);

    return {
      uploaded: {
        localUri: image.localUri,
        storagePath,
        imageUrl: publicUrlResult.data.publicUrl,
        fileName: optimizedImage.fileName
      }
    };
  } catch (error) {
    return {
      failed: {
        fileName: image.fileName,
        localUri: image.localUri,
        message: error instanceof Error ? error.message : "Image upload failed."
      }
    };
  }
}

async function readImageData(image: SelectedComposeImage): Promise<ArrayBuffer | Blob> {
  if (Platform.OS === "web") {
    const response = await fetch(image.localUri);
    if (!response.ok) {
      throw new Error("Unable to read selected image.");
    }

    return await response.blob();
  }

  const base64 = await FileSystem.readAsStringAsync(image.localUri, {
    encoding: FileSystem.EncodingType.Base64
  });

  return decode(base64);
}

export async function uploadComposeImages(params: {
  postId: number;
  userId: string;
  images: SelectedComposeImage[];
}): Promise<UploadPostImagesResult> {
  const { postId, userId, images } = params;

  const results = await Promise.all(
    images.map((image, index) =>
      uploadSingleImage({
        postId,
        userId,
        image,
        index
      })
    )
  );

  const uploaded: UploadedPostImage[] = [];
  const failed: ImageUploadFailure[] = [];

  results.forEach((result) => {
    if (result.uploaded) {
      uploaded.push(result.uploaded);
    }
    if (result.failed) {
      failed.push(result.failed);
    }
  });

  return { uploaded, failed };
}

export async function uploadComposeThumbnail(params: {
  postId: number;
  userId: string;
  image: SelectedComposeImage;
  index?: number;
}): Promise<UploadComposeThumbnailResult> {
  const { postId, userId, image, index = 0 } = params;

  try {
    const optimizedImage = await optimizeComposeThumbnailForUpload(image);
    const data = await readImageData(optimizedImage);
    const storagePath = createThumbnailStoragePath(postId, userId, optimizedImage, index);

    const uploadResult = await supabase.storage
      .from(POST_IMAGES_BUCKET)
      .upload(storagePath, data, {
        contentType: optimizedImage.mimeType,
        cacheControl: CACHE_CONTROL_ONE_YEAR_SECONDS,
        upsert: false
      });

    if (uploadResult.error) {
      return {
        uploaded: null,
        failed: {
          fileName: image.fileName,
          localUri: image.localUri,
          message: uploadResult.error.message
        }
      };
    }

    const publicUrlResult = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(storagePath);

    return {
      uploaded: {
        localUri: image.localUri,
        storagePath,
        imageUrl: publicUrlResult.data.publicUrl,
        fileName: optimizedImage.fileName
      },
      failed: null
    };
  } catch (error) {
    return {
      uploaded: null,
      failed: {
        fileName: image.fileName,
        localUri: image.localUri,
        message: error instanceof Error ? error.message : "Thumbnail upload failed."
      }
    };
  }
}
