import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { supabase } from "../../lib/supabase/client";
import type {
  ImageUploadFailure,
  SelectedComposeImage,
  UploadPostImagesResult,
  UploadedPostImage
} from "./compose.types";

const POST_IMAGES_BUCKET = "post-images";

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
    const data = await readImageData(image);

    const storagePath = createStoragePath(postId, userId, image, index);

    const uploadResult = await supabase.storage
      .from(POST_IMAGES_BUCKET)
      .upload(storagePath, data, {
        contentType: image.mimeType,
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
        storagePath,
        imageUrl: publicUrlResult.data.publicUrl,
        fileName: image.fileName
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

  const uploaded: UploadedPostImage[] = [];
  const failed: ImageUploadFailure[] = [];

  for (let index = 0; index < images.length; index += 1) {
    const result = await uploadSingleImage({
      postId,
      userId,
      image: images[index],
      index
    });

    if (result.uploaded) {
      uploaded.push(result.uploaded);
    }

    if (result.failed) {
      failed.push(result.failed);
    }
  }

  return { uploaded, failed };
}
