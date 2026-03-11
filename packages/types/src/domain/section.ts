import type { BaseEntity, EntityId } from "./common";

export type Section = BaseEntity & {
  universityId: EntityId;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};
