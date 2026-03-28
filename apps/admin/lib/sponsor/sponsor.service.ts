import { requireGrandMasterAccess } from "../auth/grandmaster";
import { createAdminServiceClient } from "../supabase/server";

export type EventPageBanner = {
  id: number;
  title: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EventPageSponsor = {
  id: number;
  name: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SponsorPageData = {
  banners: EventPageBanner[];
  sponsors: EventPageSponsor[];
};

function errorMessageFromUnknown(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

type UnsafeClient = {
  from: (table: string) => any;
};

function mutationErrorMessage(error: unknown, fallback: string): string {
  return errorMessageFromUnknown(error, fallback);
}

export async function fetchSponsorPageData(): Promise<SponsorPageData> {
  await requireGrandMasterAccess();

  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const [bannerResult, sponsorResult] = await Promise.all([
    client
      .from("event_page_banners")
      .select("id, title, image_url, sort_order, is_active, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    client
      .from("event_page_sponsors")
      .select("id, name, image_url, link_url, sort_order, is_active, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
  ]);

  if (bannerResult.error) {
    throw new Error(errorMessageFromUnknown(bannerResult.error, "Failed to load event banners."));
  }

  if (sponsorResult.error) {
    throw new Error(errorMessageFromUnknown(sponsorResult.error, "Failed to load event sponsors."));
  }

  return {
    banners: (bannerResult.data ?? []) as EventPageBanner[],
    sponsors: (sponsorResult.data ?? []) as EventPageSponsor[]
  };
}

export async function createEventPageBanner(input: {
  title: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}) {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const { error } = await client.from("event_page_banners").insert({
    title: input.title,
    image_url: input.imageUrl,
    sort_order: input.sortOrder,
    is_active: input.isActive
  });

  if (error) {
    throw new Error(mutationErrorMessage(error, "Failed to create event banner."));
  }
}

export async function updateEventPageBanner(input: {
  id: number;
  title: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}) {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const { error } = await client
    .from("event_page_banners")
    .update({
      title: input.title,
      image_url: input.imageUrl,
      sort_order: input.sortOrder,
      is_active: input.isActive
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(mutationErrorMessage(error, "Failed to update event banner."));
  }
}

export async function deleteEventPageBanner(id: number) {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const { error } = await client.from("event_page_banners").delete().eq("id", id);
  if (error) {
    throw new Error(mutationErrorMessage(error, "Failed to delete event banner."));
  }
}

export async function createEventPageSponsor(input: {
  name: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const { error } = await client.from("event_page_sponsors").insert({
    name: input.name,
    image_url: input.imageUrl,
    link_url: input.linkUrl,
    sort_order: input.sortOrder,
    is_active: input.isActive
  });

  if (error) {
    throw new Error(mutationErrorMessage(error, "Failed to create event sponsor."));
  }
}

export async function updateEventPageSponsor(input: {
  id: number;
  name: string;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const { error } = await client
    .from("event_page_sponsors")
    .update({
      name: input.name,
      image_url: input.imageUrl,
      link_url: input.linkUrl,
      sort_order: input.sortOrder,
      is_active: input.isActive
    })
    .eq("id", input.id);

  if (error) {
    throw new Error(mutationErrorMessage(error, "Failed to update event sponsor."));
  }
}

export async function deleteEventPageSponsor(id: number) {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const { error } = await client.from("event_page_sponsors").delete().eq("id", id);
  if (error) {
    throw new Error(mutationErrorMessage(error, "Failed to delete event sponsor."));
  }
}

async function moveSortOrder(
  table: "event_page_banners" | "event_page_sponsors",
  id: number,
  direction: "up" | "down"
) {
  await requireGrandMasterAccess();
  const client = createAdminServiceClient() as unknown as UnsafeClient;

  const result = await client
    .from(table)
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (result.error) {
    throw new Error(mutationErrorMessage(result.error, `Failed to reorder ${table}.`));
  }

  const rows = (result.data ?? []) as Array<{ id: number; sort_order: number }>;
  const index = rows.findIndex((row) => row.id === id);

  if (index === -1) {
    throw new Error("Target item not found.");
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) {
    return;
  }

  const current = rows[index];
  const adjacent = rows[swapIndex];
  if (!current || !adjacent) {
    return;
  }

  const updateCurrent = await client
    .from(table)
    .update({ sort_order: adjacent.sort_order })
    .eq("id", current.id);

  if (updateCurrent.error) {
    throw new Error(mutationErrorMessage(updateCurrent.error, `Failed to reorder ${table}.`));
  }

  const updateAdjacent = await client
    .from(table)
    .update({ sort_order: current.sort_order })
    .eq("id", adjacent.id);

  if (updateAdjacent.error) {
    throw new Error(mutationErrorMessage(updateAdjacent.error, `Failed to reorder ${table}.`));
  }
}

export async function moveEventPageBanner(id: number, direction: "up" | "down") {
  await moveSortOrder("event_page_banners", id, direction);
}

export async function moveEventPageSponsor(id: number, direction: "up" | "down") {
  await moveSortOrder("event_page_sponsors", id, direction);
}
