import type { BaseEntity, EntityId } from "./common";

export type UniversityDomain = BaseEntity & {
  universityId: EntityId;
  domain: string;
  isPrimary: boolean;
  isActive: boolean;
};
