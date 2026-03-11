import type { BaseEntity, EntityId } from "./common";

export type Category = BaseEntity & {
  sectionId: EntityId;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};
